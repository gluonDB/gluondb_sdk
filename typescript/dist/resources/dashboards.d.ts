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
    created_at: string;
    updated_at: string;
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
    operations: DashboardOperation[];
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
export interface DashboardPublishResult {
    dashboard_id: string;
    published_revision: number;
    published_revision_id: string;
    published_content_hash: string;
    published_at: string;
    next_draft_revision: number;
    next_draft_revision_id: string;
    next_draft_hash: string;
    reused_grant: boolean;
    dry_run: {
        executed: string[];
        skipped: string[];
    };
}
export interface DashboardPermission {
    id: string;
    email: string;
    user_id: string | null;
    role: "viewer" | "editor";
    created_at: string;
}
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
export declare class DashboardDraft {
    private readonly client;
    readonly operations: DashboardOperations;
    readonly blocks: DashboardBlocks;
    private summaryValue;
    private revisionValue;
    private revisionIdValue;
    private documentValue;
    private contentHashValue;
    private operationValues;
    constructor(client: GluonClient, data: DashboardDraftData);
    get id(): string;
    get summary(): DashboardSummary;
    get revision(): number;
    get revisionId(): string;
    get document(): DashboardDocumentV1;
    get contentHash(): string;
    get operationList(): readonly DashboardOperation[];
    request<T>(suffix: string, init?: RequestInit): Promise<T>;
    applyOperation(operation: DashboardOperation, contentHash: string): void;
    removeOperation(key: string, contentHash: string): void;
    refresh(): Promise<DashboardDraft>;
    patchDocument(patch: JsonPatchOperation[]): Promise<DashboardDraft>;
    publish(): Promise<DashboardPublishResult>;
    share(email: string, role?: "viewer" | "editor"): Promise<DashboardPermission>;
    private applySnapshot;
}
export declare class DashboardsResource {
    private readonly client;
    constructor(client: GluonClient);
    create(input: DashboardCreateInput): Promise<DashboardDraft>;
    getDraft(id: string): Promise<DashboardDraft>;
}
//# sourceMappingURL=dashboards.d.ts.map