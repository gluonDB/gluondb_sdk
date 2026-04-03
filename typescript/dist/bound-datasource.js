function isById(ref) {
    return typeof ref === "string";
}
export class BoundDatasource {
    client;
    ref;
    constructor(client, ref) {
        this.client = client;
        this.ref = ref;
    }
    async query(sql) {
        const body = isById(this.ref)
            ? { datasource_id: this.ref, query: sql }
            : {
                project_id: this.ref.projectId,
                datasource_name: this.ref.name,
                query: sql,
            };
        return this.client.request("/query", {
            method: "POST",
            body: JSON.stringify(body),
        });
    }
}
//# sourceMappingURL=bound-datasource.js.map