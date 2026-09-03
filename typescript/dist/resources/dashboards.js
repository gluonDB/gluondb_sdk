function segment(value) {
    return encodeURIComponent(value);
}
export class DashboardOperations {
    draft;
    constructor(draft) {
        this.draft = draft;
    }
    async put(key, operation) {
        const response = await this.draft.request(`/draft/operations/${segment(key)}`, {
            method: "PUT",
            headers: { "If-Match": this.draft.contentHash },
            body: JSON.stringify(operation),
        });
        this.draft.applyOperation(response.data.operation, response.data.content_hash);
        return response.data.operation;
    }
    async remove(key) {
        const response = await this.draft.request(`/draft/operations/${segment(key)}`, {
            method: "DELETE",
            headers: { "If-Match": this.draft.contentHash },
        });
        this.draft.removeOperation(response.data.removed, response.data.content_hash);
    }
    async preview(key, parameters = {}) {
        return this.draft.request(`/draft/operations/${segment(key)}/run`, {
            method: "POST",
            body: JSON.stringify({ parameters }),
        });
    }
}
export class DashboardBlocks {
    draft;
    constructor(draft) {
        this.draft = draft;
    }
    async add(block) {
        return this.draft.patchDocument([
            { op: "add", path: "/blocks/-", value: block },
        ]);
    }
}
export class DashboardDraft {
    client;
    operations;
    blocks;
    summaryValue;
    revisionValue;
    revisionIdValue;
    documentValue;
    contentHashValue;
    operationValues;
    constructor(client, data) {
        this.client = client;
        this.summaryValue = data.dashboard;
        this.revisionValue = data.revision;
        this.revisionIdValue = data.revision_id;
        this.documentValue = data.document;
        this.contentHashValue = data.content_hash;
        this.operationValues = data.operations;
        this.operations = new DashboardOperations(this);
        this.blocks = new DashboardBlocks(this);
    }
    get id() {
        return this.summaryValue.id;
    }
    get summary() {
        return this.summaryValue;
    }
    get revision() {
        return this.revisionValue;
    }
    get revisionId() {
        return this.revisionIdValue;
    }
    get document() {
        return this.documentValue;
    }
    get contentHash() {
        return this.contentHashValue;
    }
    get operationList() {
        return this.operationValues;
    }
    request(suffix, init) {
        return this.client.request(`/dashboards/${segment(this.id)}${suffix}`, init);
    }
    applyOperation(operation, contentHash) {
        this.operationValues = [
            ...this.operationValues.filter((candidate) => candidate.key !== operation.key),
            operation,
        ];
        this.contentHashValue = contentHash;
    }
    removeOperation(key, contentHash) {
        this.operationValues = this.operationValues.filter((operation) => operation.key !== key);
        this.contentHashValue = contentHash;
    }
    async refresh() {
        const response = await this.client.request(`/dashboards/${segment(this.id)}/draft`);
        this.applySnapshot(response.data);
        return this;
    }
    async patchDocument(patch) {
        const response = await this.request("/draft", {
            method: "PATCH",
            headers: { "If-Match": this.contentHash },
            body: JSON.stringify({ patch }),
        });
        this.revisionValue = response.data.revision;
        this.revisionIdValue = response.data.revision_id;
        this.documentValue = response.data.document;
        this.contentHashValue = response.data.content_hash;
        return this;
    }
    async publish() {
        const response = await this.request("/publish", {
            method: "POST",
            headers: { "If-Match": this.contentHash },
        });
        this.revisionValue = response.data.next_draft_revision;
        this.revisionIdValue = response.data.next_draft_revision_id;
        this.contentHashValue = response.data.next_draft_hash;
        this.summaryValue = {
            ...this.summaryValue,
            published_revision_id: response.data.published_revision_id,
            draft_revision_id: response.data.next_draft_revision_id,
        };
        return response.data;
    }
    async share(email, role = "viewer") {
        const response = await this.request("/permissions", {
            method: "POST",
            body: JSON.stringify({ email, role }),
        });
        this.contentHashValue = response.data.content_hash;
        return response.data.permission;
    }
    applySnapshot(data) {
        this.summaryValue = data.dashboard;
        this.revisionValue = data.revision;
        this.revisionIdValue = data.revision_id;
        this.documentValue = data.document;
        this.contentHashValue = data.content_hash;
        this.operationValues = data.operations;
    }
}
export class DashboardsResource {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(input) {
        const response = await this.client.request("/dashboards", {
            method: "POST",
            body: JSON.stringify({
                project_id: input.projectId,
                name: input.name,
                description: input.description,
            }),
        });
        return new DashboardDraft(this.client, response.data);
    }
    async getDraft(id) {
        const response = await this.client.request(`/dashboards/${segment(id)}/draft`);
        return new DashboardDraft(this.client, response.data);
    }
}
//# sourceMappingURL=dashboards.js.map