import type { GluonDBConfig } from "./types.js";
export declare class GluonAPIError extends Error {
    readonly code: string;
    readonly status: number;
    readonly details?: unknown;
    readonly retryAfterMs?: number;
    readonly error: Record<string, unknown>;
    constructor(code: string, message: string, status: number, error?: Record<string, unknown>);
}
/** A draft mutation was based on a content hash or draft version that is no longer current. */
export declare class DashboardConflictError extends GluonAPIError {
    readonly currentHash?: string;
    readonly currentDraftVersion?: number;
    constructor(code: string, message: string, status: number, current: {
        currentHash?: string;
        currentDraftVersion?: number;
    });
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