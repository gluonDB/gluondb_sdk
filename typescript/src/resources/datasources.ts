import type { GluonClient } from "../client.js";
import type { ApiResponse, Datasource } from "../types.js";

export class DatasourcesResource {
  constructor(private client: GluonClient) {}

  async list(projectId: string): Promise<ApiResponse<Datasource[]>> {
    return this.client.request<ApiResponse<Datasource[]>>(
      `/projects/${encodeURIComponent(projectId)}/datasources`,
    );
  }
}
