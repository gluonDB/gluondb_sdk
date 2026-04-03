import type { GluonClient } from "../client.js";
import type { ApiResponse, Datasource } from "../types.js";
export declare class DatasourcesResource {
    private client;
    constructor(client: GluonClient);
    list(projectId: string): Promise<ApiResponse<Datasource[]>>;
}
//# sourceMappingURL=datasources.d.ts.map