export class DatasourcesResource {
    client;
    constructor(client) {
        this.client = client;
    }
    async list(projectId) {
        return this.client.request(`/projects/${encodeURIComponent(projectId)}/datasources`);
    }
}
//# sourceMappingURL=datasources.js.map