import type { GluonClient } from "./client.js";
import type { QueryResponse } from "./types.js";

export interface DatasourceByName {
  projectId: string;
  name: string;
}

export type DatasourceRef = string | DatasourceByName;

function isById(ref: DatasourceRef): ref is string {
  return typeof ref === "string";
}

export class BoundDatasource {
  private readonly client: GluonClient;
  private readonly ref: DatasourceRef;

  constructor(client: GluonClient, ref: DatasourceRef) {
    this.client = client;
    this.ref = ref;
  }

  async query(sql: string): Promise<QueryResponse> {
    const body = isById(this.ref)
      ? { datasource_id: this.ref, query: sql }
      : {
          project_id: this.ref.projectId,
          datasource_name: this.ref.name,
          query: sql,
        };

    return this.client.request<QueryResponse>("/query", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}
