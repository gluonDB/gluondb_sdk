import type { GluonDBConfig } from "./types.js";
export declare class GluonAPIError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, message: string, status: number);
}
export declare class GluonClient {
    private readonly baseUrl;
    private readonly apiKey;
    constructor(config: GluonDBConfig);
    request<T>(path: string, init?: RequestInit): Promise<T>;
}
//# sourceMappingURL=client.d.ts.map