import type { GluonClient } from "../client.js";
import type {
  DashboardBlock,
  DashboardDocumentV1,
  DashboardOperationPutBody,
} from "../generated/index.js";
import type { ApiResponse } from "../types.js";

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

export type JsonPatchOperation =
  | { op: "add" | "replace" | "test"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "copy" | "move"; from: string; path: string };

export type DashboardParameterValues =
  | Record<string, unknown>
  | Array<{ name: string; value: unknown }>;

export interface DashboardPreviewResult {
  data: {
    columns: Array<{ name: string; type_name: string }>;
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
  dry_run: { executed: string[]; skipped: string[] };
}

export interface DashboardPermission {
  id: string;
  email: string;
  user_id: string | null;
  role: "viewer" | "editor";
  created_at: string;
}

interface PatchResult {
  dashboard_id: string;
  revision: number;
  revision_id: string;
  document: DashboardDocumentV1;
  content_hash: string;
}

interface OperationMutationResult {
  dashboard_id: string;
  content_hash: string;
  operation: DashboardOperation;
}

interface RemoveOperationResult {
  dashboard_id: string;
  content_hash: string;
  removed: string;
}

interface ShareResult {
  dashboard_id: string;
  content_hash: string;
  permission: DashboardPermission;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

export class DashboardOperations {
  constructor(private readonly draft: DashboardDraft) {}

  async put(
    key: string,
    operation: DashboardOperationPutBody,
  ): Promise<DashboardOperation> {
    const response = await this.draft.request<
      ApiResponse<OperationMutationResult>
    >(`/draft/operations/${segment(key)}`, {
      method: "PUT",
      headers: { "If-Match": this.draft.contentHash },
      body: JSON.stringify(operation),
    });
    this.draft.applyOperation(response.data.operation, response.data.content_hash);
    return response.data.operation;
  }

  async remove(key: string): Promise<void> {
    const response = await this.draft.request<ApiResponse<RemoveOperationResult>>(
      `/draft/operations/${segment(key)}`,
      {
        method: "DELETE",
        headers: { "If-Match": this.draft.contentHash },
      },
    );
    this.draft.removeOperation(response.data.removed, response.data.content_hash);
  }

  async preview(
    key: string,
    parameters: DashboardParameterValues = {},
  ): Promise<DashboardPreviewResult> {
    return this.draft.request<DashboardPreviewResult>(
      `/draft/operations/${segment(key)}/run`,
      {
        method: "POST",
        body: JSON.stringify({ parameters }),
      },
    );
  }
}

export class DashboardBlocks {
  constructor(private readonly draft: DashboardDraft) {}

  async add(block: DashboardBlock): Promise<DashboardDraft> {
    return this.draft.patchDocument([
      { op: "add", path: "/blocks/-", value: block },
    ]);
  }
}

export class DashboardDraft {
  public readonly operations: DashboardOperations;
  public readonly blocks: DashboardBlocks;

  private summaryValue: DashboardSummary;
  private revisionValue: number;
  private revisionIdValue: string;
  private documentValue: DashboardDocumentV1;
  private contentHashValue: string;
  private operationValues: DashboardOperation[];

  constructor(
    private readonly client: GluonClient,
    data: DashboardDraftData,
  ) {
    this.summaryValue = data.dashboard;
    this.revisionValue = data.revision;
    this.revisionIdValue = data.revision_id;
    this.documentValue = data.document;
    this.contentHashValue = data.content_hash;
    this.operationValues = data.operations;
    this.operations = new DashboardOperations(this);
    this.blocks = new DashboardBlocks(this);
  }

  get id(): string {
    return this.summaryValue.id;
  }

  get summary(): DashboardSummary {
    return this.summaryValue;
  }

  get revision(): number {
    return this.revisionValue;
  }

  get revisionId(): string {
    return this.revisionIdValue;
  }

  get document(): DashboardDocumentV1 {
    return this.documentValue;
  }

  get contentHash(): string {
    return this.contentHashValue;
  }

  get operationList(): readonly DashboardOperation[] {
    return this.operationValues;
  }

  request<T>(suffix: string, init?: RequestInit): Promise<T> {
    return this.client.request<T>(`/dashboards/${segment(this.id)}${suffix}`, init);
  }

  applyOperation(operation: DashboardOperation, contentHash: string): void {
    this.operationValues = [
      ...this.operationValues.filter((candidate) => candidate.key !== operation.key),
      operation,
    ];
    this.contentHashValue = contentHash;
  }

  removeOperation(key: string, contentHash: string): void {
    this.operationValues = this.operationValues.filter(
      (operation) => operation.key !== key,
    );
    this.contentHashValue = contentHash;
  }

  async refresh(): Promise<DashboardDraft> {
    const response = await this.client.request<ApiResponse<DashboardDraftData>>(
      `/dashboards/${segment(this.id)}/draft`,
    );
    this.applySnapshot(response.data);
    return this;
  }

  async patchDocument(patch: JsonPatchOperation[]): Promise<DashboardDraft> {
    const response = await this.request<ApiResponse<PatchResult>>("/draft", {
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

  async publish(): Promise<DashboardPublishResult> {
    const response = await this.request<ApiResponse<DashboardPublishResult>>(
      "/publish",
      {
        method: "POST",
        headers: { "If-Match": this.contentHash },
      },
    );
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

  async share(
    email: string,
    role: "viewer" | "editor" = "viewer",
  ): Promise<DashboardPermission> {
    const response = await this.request<ApiResponse<ShareResult>>("/permissions", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
    this.contentHashValue = response.data.content_hash;
    return response.data.permission;
  }

  private applySnapshot(data: DashboardDraftData): void {
    this.summaryValue = data.dashboard;
    this.revisionValue = data.revision;
    this.revisionIdValue = data.revision_id;
    this.documentValue = data.document;
    this.contentHashValue = data.content_hash;
    this.operationValues = data.operations;
  }
}

export class DashboardsResource {
  constructor(private readonly client: GluonClient) {}

  async create(input: DashboardCreateInput): Promise<DashboardDraft> {
    const response = await this.client.request<ApiResponse<DashboardDraftData>>(
      "/dashboards",
      {
        method: "POST",
        body: JSON.stringify({
          project_id: input.projectId,
          name: input.name,
          description: input.description,
        }),
      },
    );
    return new DashboardDraft(this.client, response.data);
  }

  async getDraft(id: string): Promise<DashboardDraft> {
    const response = await this.client.request<ApiResponse<DashboardDraftData>>(
      `/dashboards/${segment(id)}/draft`,
    );
    return new DashboardDraft(this.client, response.data);
  }
}
