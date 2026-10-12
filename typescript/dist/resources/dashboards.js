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
            headers: this.draft.preconditions(),
            body: JSON.stringify(operation),
        });
        this.draft.applyOperation(response.data.operation, response.data);
        return response.data.operation;
    }
    async remove(key) {
        const response = await this.draft.request(`/draft/operations/${segment(key)}`, {
            method: "DELETE",
            headers: this.draft.preconditions(),
        });
        this.draft.removeOperation(response.data.removed, response.data);
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
/**
 * A dashboard draft. API keys author drafts only: publishing, sharing and
 * lifecycle actions happen in the GluonDB editor at `editorUrl`.
 */
export class DashboardDraft {
    client;
    operations;
    blocks;
    summaryValue;
    revisionValue;
    revisionIdValue;
    documentValue;
    contentHashValue;
    draftVersionValue;
    operationValues;
    editorUrlValue;
    constructor(client, data) {
        this.client = client;
        this.summaryValue = data.dashboard;
        this.revisionValue = data.revision;
        this.revisionIdValue = data.revision_id;
        this.documentValue = data.document;
        this.contentHashValue = data.content_hash;
        this.draftVersionValue = data.draft_version;
        this.operationValues = data.operations;
        this.editorUrlValue = data.editor_url;
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
    /** Advances on every document or operation edit, including other writers'. */
    get draftVersion() {
        return this.draftVersionValue;
    }
    /** Where a signed-in user reviews and publishes this draft. */
    get editorUrl() {
        return this.editorUrlValue;
    }
    get operationList() {
        return this.operationValues;
    }
    /** Both preconditions the server requires on every draft mutation. */
    preconditions() {
        return {
            "If-Match": this.contentHashValue,
            "If-Draft-Version": String(this.draftVersionValue),
        };
    }
    request(suffix, init) {
        return this.client.request(`/dashboards/${segment(this.id)}${suffix}`, init);
    }
    applyOperation(operation, state) {
        this.operationValues = [
            ...this.operationValues.filter((candidate) => candidate.key !== operation.key),
            operation,
        ];
        this.applyState(state);
    }
    removeOperation(key, state) {
        this.operationValues = this.operationValues.filter((operation) => operation.key !== key);
        this.applyState(state);
    }
    async refresh() {
        const response = await this.client.request(`/dashboards/${segment(this.id)}/draft`);
        this.applySnapshot(response.data);
        return this;
    }
    async patchDocument(patch) {
        const response = await this.request("/draft", {
            method: "PATCH",
            headers: this.preconditions(),
            body: JSON.stringify({ patch }),
        });
        this.revisionValue = response.data.revision;
        this.revisionIdValue = response.data.revision_id;
        this.documentValue = response.data.document;
        this.applyState(response.data);
        return this;
    }
    applyState(state) {
        this.contentHashValue = state.content_hash;
        this.draftVersionValue = state.draft_version;
    }
    applySnapshot(data) {
        this.summaryValue = data.dashboard;
        this.revisionValue = data.revision;
        this.revisionIdValue = data.revision_id;
        this.documentValue = data.document;
        this.contentHashValue = data.content_hash;
        this.draftVersionValue = data.draft_version;
        this.operationValues = data.operations;
        this.editorUrlValue = data.editor_url;
    }
}
export class DashboardsResource {
    client;
    constructor(client) {
        this.client = client;
    }
    /** Dashboards in the projects this API key was granted, optionally one project. */
    async list(projectId) {
        const query = projectId ? `?project_id=${segment(projectId)}` : "";
        const response = await this.client.request(`/dashboards${query}`);
        return response.data.dashboards;
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