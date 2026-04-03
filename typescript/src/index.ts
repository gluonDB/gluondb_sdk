import { GluonClient } from "./client.js";
import { BoundDatasource } from "./bound-datasource.js";
import { ProjectsResource } from "./resources/projects.js";
import { DatasourcesResource } from "./resources/datasources.js";
import type { GluonDBConfig } from "./types.js";
import type { DatasourceRef } from "./bound-datasource.js";

export class GluonDB {
  private readonly client: GluonClient;

  public readonly projects: ProjectsResource;
  public readonly datasources: DatasourcesResource;

  constructor(config: GluonDBConfig) {
    this.client = new GluonClient(config);
    this.projects = new ProjectsResource(this.client);
    this.datasources = new DatasourcesResource(this.client);
  }

  /**
   * Return a bound datasource handle.
   *
   * @example
   * const pg = gluon.datasource("ds-uuid");
   * const result = await pg.query("SELECT 1");
   *
   * @example
   * const pg = gluon.datasource({ projectId: "uuid", name: "my-pg" });
   * const result = await pg.query("SELECT 1");
   */
  datasource(ref: DatasourceRef): BoundDatasource {
    return new BoundDatasource(this.client, ref);
  }
}

export { GluonAPIError } from "./client.js";
export { BoundDatasource } from "./bound-datasource.js";
export type { DatasourceRef, DatasourceByName } from "./bound-datasource.js";
export type {
  GluonDBConfig,
  QueryResponse,
  QueryData,
  Column,
  QueryMeta,
  Project,
  Datasource,
  ApiResponse,
  ApiMeta,
  ApiErrorBody,
} from "./types.js";
