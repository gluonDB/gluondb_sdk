import { BoundDatasource } from "./bound-datasource.js";
import { ProjectsResource } from "./resources/projects.js";
import { DatasourcesResource } from "./resources/datasources.js";
import { DashboardsResource } from "./resources/dashboards.js";
import type { GluonDBConfig } from "./types.js";
import type { DatasourceRef } from "./bound-datasource.js";
export declare class GluonDB {
    private readonly client;
    readonly projects: ProjectsResource;
    readonly datasources: DatasourcesResource;
    readonly dashboards: DashboardsResource;
    constructor(config: GluonDBConfig);
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
    datasource(ref: DatasourceRef): BoundDatasource;
}
export { DashboardConflictError, GluonAPIError, RevisionChangedError, } from "./client.js";
export { BoundDatasource } from "./bound-datasource.js";
export { DashboardBlocks, DashboardDraft, DashboardOperations, DashboardsResource, } from "./resources/dashboards.js";
export type { DatasourceRef, DatasourceByName } from "./bound-datasource.js";
export type { GluonDBConfig, QueryResponse, QueryData, Column, QueryMeta, Project, Datasource, ApiResponse, ApiMeta, ApiErrorBody, } from "./types.js";
export type { DashboardCreateInput, DashboardDraftData, DashboardOperation, DashboardParameterValues, DashboardPermission, DashboardPreviewResult, DashboardPublishResult, DashboardSummary, JsonPatchOperation, } from "./resources/dashboards.js";
export type { DashboardBlock, DashboardDocumentV1, DashboardOperationDeclaration, DashboardOperationPutBody, DashboardParameterDeclaration, OperationResultSchema, } from "./generated/index.js";
//# sourceMappingURL=index.d.ts.map