import type { GluonClient } from "./client.js";
import type { QueryResponse } from "./types.js";
export interface DatasourceByName {
    projectId: string;
    name: string;
}
export type DatasourceRef = string | DatasourceByName;
export declare class BoundDatasource {
    private readonly client;
    private readonly ref;
    constructor(client: GluonClient, ref: DatasourceRef);
    query(sql: string): Promise<QueryResponse>;
}
//# sourceMappingURL=bound-datasource.d.ts.map