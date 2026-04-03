export class ProjectsResource {
    client;
    constructor(client) {
        this.client = client;
    }
    async list() {
        return this.client.request("/projects");
    }
}
//# sourceMappingURL=projects.js.map