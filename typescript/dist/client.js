const DEFAULT_BASE_URL = "https://api.gluondb.com";
const DEFAULT_API_VERSION = "v1";
export class GluonAPIError extends Error {
    code;
    status;
    constructor(code, message, status) {
        super(message);
        this.name = "GluonAPIError";
        this.code = code;
        this.status = status;
    }
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
            throw new GluonAPIError(body?.error?.code || "UNKNOWN", body?.error?.message || `HTTP ${res.status}`, res.status);
        }
        return (await res.json());
    }
}
//# sourceMappingURL=client.js.map