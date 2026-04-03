import { GluonClient } from "./client.js";
import { BoundDatasource } from "./bound-datasource.js";
import { ProjectsResource } from "./resources/projects.js";
import { DatasourcesResource } from "./resources/datasources.js";
export class GluonDB {
    client;
    projects;
    datasources;
    constructor(config) {
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
    datasource(ref) {
        return new BoundDatasource(this.client, ref);
    }
}
export { GluonAPIError } from "./client.js";
export { BoundDatasource } from "./bound-datasource.js";
//# sourceMappingURL=index.js.map