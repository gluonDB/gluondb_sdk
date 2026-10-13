import type { GluonClient } from "../client.js";
import type { DashboardBlock, DashboardDocumentV1, DashboardOperationPutBody } from "../generated/index.js";
export interface DashboardCreateInput {
    projectId: string;
    name: string;
    description?: string | null;
}
export interface DashboardSummary {
    id: string;
    project_id: string;
    owner_user_id: string;
    name: string;
    description: string | null;
    draft_revision_id: string | null;
    published_revision_id: string | null;
    archived_at?: string | null;
    created_at: string;
    updated_at: string;
    /** What this API key may do with the dashboard; the server still enforces it. */
    can_edit?: boolean;
    can_manage?: boolean;
    allowed_actions?: string[];
}
export interface DashboardOperation extends DashboardOperationPutBody {
    key: string;
    query_hash: string;
}
export interface DashboardDraftData {
    dashboard: DashboardSummary;
    revision: number;
    revision_id: string;
    document: DashboardDocumentV1;
    content_hash: string;
    draft_version: number;
    operations: DashboardOperation[];
    editor_url?: string;
}
export type JsonPatchOperation = {
    op: "add" | "replace" | "test";
    path: string;
    value: unknown;
} | {
    op: "remove";
    path: string;
} | {
    op: "copy" | "move";
    from: string;
    path: string;
};
export type DashboardParameterValues = Record<string, unknown> | Array<{
    name: string;
    value: unknown;
}>;
export interface DashboardPreviewResult {
    data: {
        columns: Array<{
            name: string;
            type_name: string;
        }>;
        rows: unknown[][];
    };
    meta: {
        api_version: string;
        dashboard_id: string;
        operation_key: string;
        row_count: number;
        execution_time_ms: number;
        truncated: boolean;
        truncation_reason?: string;
    };
}
type DraftState = Pick<DashboardDraftData, "content_hash" | "draft_version">;
export declare class DashboardOperations {
    private readonly draft;
    constructor(draft: DashboardDraft);
    put(key: string, operation: DashboardOperationPutBody): Promise<DashboardOperation>;
    remove(key: string): Promise<void>;
    preview(key: string, parameters?: DashboardParameterValues): Promise<DashboardPreviewResult>;
}
export declare class DashboardBlocks {
    private readonly draft;
    constructor(draft: DashboardDraft);
    add(block: DashboardBlock): Promise<DashboardDraft>;
}
/**
 * A dashboard draft. API keys author drafts only: publishing, sharing and
 * lifecycle actions happen in the GluonDB editor at `editorUrl`.
 */
export declare class DashboardDraft {
    private readonly client;
    readonly operations: DashboardOperations;
    readonly blocks: DashboardBlocks;
    private summaryValue;
    private revisionValue;
    private revisionIdValue;
    private documentValue;
    private contentHashValue;
    private draftVersionValue;
    private operationValues;
    private editorUrlValue;
    constructor(client: GluonClient, data: DashboardDraftData);
    get id(): string;
    get summary(): DashboardSummary;
    get revision(): number;
    get revisionId(): string;
    get document(): DashboardDocumentV1;
    get contentHash(): string;
    /** Advances on every document or operation edit, including other writers'. */
    get draftVersion(): number;
    /** Where a signed-in user reviews and publishes this draft. */
    get editorUrl(): string | undefined;
    get operationList(): readonly DashboardOperation[];
    /** Both preconditions the server requires on every draft mutation. */
    preconditions(): Record<string, string>;
    request<T>(suffix: string, init?: RequestInit): Promise<T>;
    applyOperation(operation: DashboardOperation, state: DraftState): void;
    removeOperation(key: string, state: DraftState): void;
    refresh(): Promise<DashboardDraft>;
    patchDocument(patch: JsonPatchOperation[]): Promise<DashboardDraft>;
    private applyState;
    private applySnapshot;
}
export declare class DashboardsResource {
    private readonly client;
    constructor(client: GluonClient);
    /** Dashboards in the projects this API key was granted, optionally one project. */
    list(projectId?: string): Promise<DashboardSummary[]>;
    create(input: DashboardCreateInput): Promise<DashboardDraft>;
    getDraft(id: string): Promise<DashboardDraft>;
}
export {};
//# sourceMappingURL=dashboards.d.ts.map