import { GluonClient } from "./client.js";
import { BoundDatasource } from "./bound-datasource.js";
import { ProjectsResource } from "./resources/projects.js";
import { DatasourcesResource } from "./resources/datasources.js";
import { DashboardsResource } from "./resources/dashboards.js";
export class GluonDB {
    client;
    projects;
    datasources;
    dashboards;
    constructor(config) {
        this.client = new GluonClient(config);
        this.projects = new ProjectsResource(this.client);
        this.datasources = new DatasourcesResource(this.client);
        this.dashboards = new DashboardsResource(this.client);
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
    datasource(ref) {
        return new BoundDatasource(this.client, ref);
    }
}
export { DashboardConflictError, GluonAPIError, RevisionChangedError, } from "./client.js";
export { BoundDatasource } from "./bound-datasource.js";
export { DashboardBlocks, DashboardDraft, DashboardOperations, DashboardsResource, } from "./resources/dashboards.js";
//# sourceMappingURL=index.js.map