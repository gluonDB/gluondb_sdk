import type { ApiErrorResponse, GluonDBConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://api.gluondb.com";
const DEFAULT_API_VERSION = "v1";

export class GluonAPIError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;
  public readonly retryAfterMs?: number;
  public readonly error: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    error: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "GluonAPIError";
    this.code = code;
    this.status = status;
    this.error = error;
    this.details = error.details;
    this.retryAfterMs =
      typeof error.retry_after_ms === "number" ? error.retry_after_ms : undefined;
  }
}

/** A draft mutation was based on a content hash or draft version that is no longer current. */
export class DashboardConflictError extends GluonAPIError {
  public readonly currentHash?: string;
  public readonly currentDraftVersion?: number;

  constructor(
    code: string,
    message: string,
    status: number,
    current: { currentHash?: string; currentDraftVersion?: number },
  ) {
    super(code, message, status, {
      ...(current.currentHash !== undefined && { current_hash: current.currentHash }),
      ...(current.currentDraftVersion !== undefined && {
        current_draft_version: current.currentDraftVersion,
      }),
    });
    this.name = "DashboardConflictError";
    this.currentHash = current.currentHash;
    this.currentDraftVersion = current.currentDraftVersion;
  }
}

export class RevisionChangedError extends GluonAPIError {
  public readonly currentRevision: number;

  constructor(message: string, status: number, currentRevision: number) {
    super("REVISION_CHANGED", message, status, {
      current_revision: currentRevision,
    });
    this.name = "RevisionChangedError";
    this.currentRevision = currentRevision;
  }
}

function apiError(body: ApiErrorResponse | undefined, status: number): GluonAPIError {
  const error: Record<string, unknown> = body?.error ?? {};
  const code = typeof error.code === "string" ? error.code : "UNKNOWN";
  const message =
    typeof error.message === "string" ? error.message : `HTTP ${status}`;

  const currentHash =
    typeof error.current_hash === "string" ? error.current_hash : undefined;
  const currentDraftVersion =
    typeof error.current_draft_version === "number"
      ? error.current_draft_version
      : undefined;
  if (
    (code === "DRAFT_CONFLICT" || code === "CONTENT_CONFLICT") &&
    (currentHash !== undefined || currentDraftVersion !== undefined)
  ) {
    return new DashboardConflictError(code, message, status, {
      currentHash,
      currentDraftVersion,
    });
  }
  if (
    code === "REVISION_CHANGED" &&
    typeof error.current_revision === "number"
  ) {
    return new RevisionChangedError(message, status, error.current_revision);
  }
  return new GluonAPIError(code, message, status, error);
}

export class GluonClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: GluonDBConfig) {
    if (!config.apiKey) {
      throw new Error("apiKey is required");
    }
    this.apiKey = config.apiKey;
    const version = config.apiVersion || DEFAULT_API_VERSION;
    const base = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.baseUrl = `${base}/${version}`;
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      let body: ApiErrorResponse | undefined;
      try {
        body = (await res.json()) as ApiErrorResponse;
      } catch {
        // ignore parse failures
      }
      throw apiError(body, res.status);
    }

    if (res.status === 204) return undefined as T;
    const contentLength = res.headers.get("content-length");
    if (contentLength === "0") return undefined as T;
    return (await res.json()) as T;
  }
}
