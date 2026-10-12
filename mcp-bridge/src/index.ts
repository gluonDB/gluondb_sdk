#!/usr/bin/env node
/**
 * @gluondb/mcp — a transparent stdio-to-HTTP bridge for the GluonDB MCP server.
 *
 * MCP clients that only speak stdio (e.g. Claude Desktop) can't talk to the
 * GluonDB streamable-HTTP endpoint directly. This bridge reads newline-delimited
 * JSON-RPC messages on stdin, forwards each to the HTTP `/mcp` endpoint with the
 * caller's API key, and writes the JSON-RPC replies back to stdout.
 *
 * It is intentionally protocol-agnostic: it does not parse or rewrite MCP
 * semantics, it just relays frames. The GluonDB server runs stateless in
 * JSON-response mode, so no session bookkeeping is required here.
 *
 * Config (environment variables):
 *   GLUONDB_API_KEY  (required) — a `gluon_*` Personal Access Token.
 *   GLUONDB_MCP_URL  (optional) — override the endpoint. Defaults to prod.
 *   DEBUG=gluondb:*  (optional) — log activity to stderr.
 */

import { createInterface } from "node:readline";

const API_KEY = process.env.GLUONDB_API_KEY;
const MCP_URL = process.env.GLUONDB_MCP_URL ?? "https://mcp.gluondb.com/mcp";
const DEBUG = /\bgluondb\b/i.test(process.env.DEBUG ?? "");

function debug(...parts: unknown[]): void {
	if (DEBUG) process.stderr.write(`[gluondb:mcp] ${parts.join(" ")}\n`);
}

if (!API_KEY) {
	process.stderr.write(
		"gluondb mcp bridge: the GLUONDB_API_KEY environment variable is required.\n",
	);
	process.exit(1);
}

interface JsonRpcMessage {
	jsonrpc?: string;
	id?: string | number | null;
	method?: string;
	[key: string]: unknown;
}

function writeMessage(msg: unknown): void {
	process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function isRequest(message: JsonRpcMessage): boolean {
	// A request expects a reply (has an id). Notifications do not.
	return message.id !== undefined && message.id !== null;
}

function isJsonRpc(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as JsonRpcMessage).jsonrpc === "2.0"
	);
}

function replyError(message: JsonRpcMessage, code: number, text: string): void {
	if (!isRequest(message)) return;
	writeMessage({ jsonrpc: "2.0", id: message.id, error: { code, message: text } });
}

function httpErrorDetail(parsed: unknown): string {
	const error = (parsed as { error?: { message?: unknown } | string } | null)
		?.error;
	if (typeof error === "string") return error;
	if (typeof error?.message === "string") return error.message;
	return "request rejected";
}

async function forward(message: JsonRpcMessage): Promise<void> {
	let res: Response;
	try {
		res = await fetch(MCP_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				Authorization: `Bearer ${API_KEY}`,
			},
			body: JSON.stringify(message),
		});
	} catch (err) {
		debug("transport error:", (err as Error).message);
		replyError(
			message,
			-32000,
			`GluonDB bridge transport error: ${(err as Error).message}`,
		);
		return;
	}

	// 202/204 mean "accepted, no body" (e.g. for notifications/responses).
	if (res.status === 202 || res.status === 204) return;

	const contentType = res.headers.get("content-type") ?? "";

	if (contentType.includes("text/event-stream")) {
		// Relay any JSON-RPC frames carried as SSE `data:` lines.
		const text = await res.text();
		for (const line of text.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) continue;
			const payload = trimmed.slice("data:".length).trim();
			if (!payload) continue;
			try {
				writeMessage(JSON.parse(payload));
			} catch {
				debug("skipping unparseable SSE data frame");
			}
		}
		return;
	}

	const bodyText = await res.text();
	if (!bodyText) {
		if (!res.ok) replyError(message, -32000, `GluonDB returned HTTP ${res.status}.`);
		return;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(bodyText);
	} catch {
		debug("non-JSON response", String(res.status));
		replyError(
			message,
			-32700,
			`GluonDB returned a non-JSON response (HTTP ${res.status}).`,
		);
		return;
	}

	// Auth and gateway failures arrive as plain HTTP error bodies, not JSON-RPC.
	// Relayed as-is they match no request id and the client waits forever.
	if (!res.ok && !Array.isArray(parsed) && !isJsonRpc(parsed)) {
		debug("HTTP error", String(res.status));
		replyError(
			message,
			-32000,
			`GluonDB returned HTTP ${res.status}: ${httpErrorDetail(parsed)}`,
		);
		return;
	}

	if (Array.isArray(parsed)) {
		for (const m of parsed) writeMessage(m);
	} else {
		writeMessage(parsed);
	}
}

const rl = createInterface({ input: process.stdin });

// Replies still in flight when stdin closes must reach stdout before exit.
let inFlight = 0;
let stdinClosed = false;

rl.on("line", (line) => {
	const trimmed = line.trim();
	if (!trimmed) return;
	let message: JsonRpcMessage;
	try {
		message = JSON.parse(trimmed) as JsonRpcMessage;
	} catch {
		debug("dropping non-JSON stdin line");
		return;
	}
	inFlight++;
	void forward(message).finally(() => {
		inFlight--;
		if (stdinClosed && inFlight === 0) process.exit(0);
	});
});

rl.on("close", () => {
	stdinClosed = true;
	if (inFlight === 0) process.exit(0);
});

debug(`bridge started -> ${MCP_URL}`);
