function isQueryById(p) {
    return "datasourceId" in p;
}
export class QueryResource {
    client;
    constructor(client) {
        this.client = client;
    }
    async execute(params) {
        const body = isQueryById(params)
            ? { datasource_id: params.datasourceId, query: params.sql }
            : {
                project_id: params.projectId,
                datasource_name: params.datasource,
                query: params.sql,
            };
        return this.client.request("/query", {
            method: "POST",
            body: JSON.stringify(body),
        });
    }
}
//# sourceMappingURL=query.js.map