import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const BRIDGE = fileURLToPath(new URL("../dist/index.js", import.meta.url));

/** Start a stand-in for the GluonDB `/mcp` endpoint; `respond` answers each POST. */
async function startEndpoint(respond) {
	const seen = [];
	const server = createServer((req, res) => {
		let body = "";
		req.on("data", (chunk) => (body += chunk));
		req.on("end", () => {
			const message = JSON.parse(body);
			seen.push({ message, authorization: req.headers.authorization });
			respond(message, res);
		});
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	return {
		seen,
		url: `http://127.0.0.1:${server.address().port}/mcp`,
		close: () => new Promise((resolve) => server.close(resolve)),
	};
}

/** Feed `lines` to the bridge on stdin, close stdin, and collect what it prints. */
function runBridge(url, lines, env = { GLUONDB_API_KEY: "gluon_test" }) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [BRIDGE], {
			env: { PATH: process.env.PATH, GLUONDB_MCP_URL: url, ...env },
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => (stdout += chunk));
		child.stderr.on("data", (chunk) => (stderr += chunk));
		child.on("error", reject);
		child.on("close", (code) =>
			resolve({
				code,
				stderr,
				messages: stdout
					.split("\n")
					.filter(Boolean)
					.map((line) => JSON.parse(line)),
			}),
		);
		child.stdin.end(lines.map((line) => `${JSON.stringify(line)}\n`).join(""));
	});
}

function json(res, status, body) {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
}

test("relays requests with the API key and skips replies for notifications", async () => {
	const endpoint = await startEndpoint((message, res) => {
		if (message.id === undefined) return res.writeHead(202).end();
		json(res, 200, { jsonrpc: "2.0", id: message.id, result: { ok: true } });
	});
	try {
		const run = await runBridge(endpoint.url, [
			{ jsonrpc: "2.0", id: 1, method: "tools/list" },
			{ jsonrpc: "2.0", method: "notifications/initialized" },
		]);
		assert.equal(run.code, 0);
		assert.deepEqual(run.messages, [
			{ jsonrpc: "2.0", id: 1, result: { ok: true } },
		]);
		assert.equal(endpoint.seen.length, 2);
		assert.equal(endpoint.seen[0].authorization, "Bearer gluon_test");
	} finally {
		await endpoint.close();
	}
});

test("relays JSON-RPC frames delivered as server-sent events", async () => {
	const endpoint = await startEndpoint((message, res) => {
		res.writeHead(200, { "content-type": "text/event-stream" });
		res.end(
			`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n\n`,
		);
	});
	try {
		const run = await runBridge(endpoint.url, [
			{ jsonrpc: "2.0", id: "a", method: "initialize" },
		]);
		assert.deepEqual(run.messages, [{ jsonrpc: "2.0", id: "a", result: {} }]);
	} finally {
		await endpoint.close();
	}
});

test("turns a rejected API key into a JSON-RPC error for the pending request", async () => {
	const endpoint = await startEndpoint((_message, res) =>
		json(res, 401, {
			error: { code: "UNAUTHORIZED", message: "Invalid or revoked API key" },
		}),
	);
	try {
		const run = await runBridge(endpoint.url, [
			{ jsonrpc: "2.0", id: 7, method: "initialize" },
			{ jsonrpc: "2.0", method: "notifications/initialized" },
		]);
		assert.deepEqual(run.messages, [
			{
				jsonrpc: "2.0",
				id: 7,
				error: {
					code: -32000,
					message: "GluonDB returned HTTP 401: Invalid or revoked API key",
				},
			},
		]);
	} finally {
		await endpoint.close();
	}
});

test("reports an unreachable endpoint instead of hanging", async () => {
	const endpoint = await startEndpoint(() => {});
	await endpoint.close();
	const run = await runBridge(endpoint.url, [
		{ jsonrpc: "2.0", id: 1, method: "initialize" },
	]);
	assert.equal(run.messages.length, 1);
	assert.equal(run.messages[0].id, 1);
	assert.match(run.messages[0].error.message, /transport error/);
});

test("refuses to start without an API key", async () => {
	const run = await runBridge("http://127.0.0.1:1/mcp", [], {});
	assert.equal(run.code, 1);
	assert.match(run.stderr, /GLUONDB_API_KEY/);
});
