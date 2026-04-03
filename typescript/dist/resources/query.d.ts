import type { GluonClient } from "../client.js";
import type { QueryParams, QueryResponse } from "../types.js";
export declare class QueryResource {
    private client;
    constructor(client: GluonClient);
    execute(params: QueryParams): Promise<QueryResponse>;
}
//# sourceMappingURL=query.d.ts.map