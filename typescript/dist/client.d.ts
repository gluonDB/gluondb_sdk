import type { GluonDBConfig } from "./types.js";
export declare class GluonAPIError extends Error {
    readonly code: string;
    readonly status: number;
    readonly details?: unknown;
    readonly retryAfterMs?: number;
    readonly error: Record<string, unknown>;
    constructor(code: string, message: string, status: number, error?: Record<string, unknown>);
}
export declare class DashboardConflictError extends GluonAPIError {
    readonly currentHash: string;
    constructor(code: string, message: string, status: number, currentHash: string);
}
export declare class RevisionChangedError extends GluonAPIError {
    readonly currentRevision: number;
    constructor(message: string, status: number, currentRevision: number);
}
export declare class GluonClient {
    private readonly baseUrl;
    private readonly apiKey;
    constructor(config: GluonDBConfig);
    request<T>(path: string, init?: RequestInit): Promise<T>;
}
//# sourceMappingURL=client.d.ts.map