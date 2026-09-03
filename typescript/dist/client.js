const DEFAULT_BASE_URL = "https://api.gluondb.com";
const DEFAULT_API_VERSION = "v1";
export class GluonAPIError extends Error {
    code;
    status;
    details;
    retryAfterMs;
    error;
    constructor(code, message, status, error = {}) {
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
export class DashboardConflictError extends GluonAPIError {
    currentHash;
    constructor(code, message, status, currentHash) {
        super(code, message, status, { current_hash: currentHash });
        this.name = "DashboardConflictError";
        this.currentHash = currentHash;
    }
}
export class RevisionChangedError extends GluonAPIError {
    currentRevision;
    constructor(message, status, currentRevision) {
        super("REVISION_CHANGED", message, status, {
            current_revision: currentRevision,
        });
        this.name = "RevisionChangedError";
        this.currentRevision = currentRevision;
    }
}
function apiError(body, status) {
    const error = body?.error ?? {};
    const code = typeof error.code === "string" ? error.code : "UNKNOWN";
    const message = typeof error.message === "string" ? error.message : `HTTP ${status}`;
    if ((code === "DRAFT_CONFLICT" || code === "CONTENT_CONFLICT") &&
        typeof error.current_hash === "string") {
        return new DashboardConflictError(code, message, status, error.current_hash);
    }
    if (code === "REVISION_CHANGED" &&
        typeof error.current_revision === "number") {
        return new RevisionChangedError(message, status, error.current_revision);
    }
    return new GluonAPIError(code, message, status, error);
}
export class GluonClient {
    baseUrl;
    apiKey;
    constructor(config) {
        if (!config.apiKey) {
            throw new Error("apiKey is required");
        }
        this.apiKey = config.apiKey;
        const version = config.apiVersion || DEFAULT_API_VERSION;
        const base = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.baseUrl = `${base}/${version}`;
    }
    async request(path, init) {
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
            let body;
            try {
                body = (await res.json());
            }
            catch {
                // ignore parse failures
            }
            throw apiError(body, res.status);
        }
        if (res.status === 204)
            return undefined;
        const contentLength = res.headers.get("content-length");
        if (contentLength === "0")
            return undefined;
        return (await res.json());
    }
}
//# sourceMappingURL=client.js.map