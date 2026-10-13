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

type DraftState = Pick<DashboardDraftData, "content_hash" | "draft_version">;

interface PatchResult {
  dashboard_id: string;
  revision: number;
  revision_id: string;
  document: DashboardDocumentV1;
  content_hash: string;
  draft_version: number;
}

interface OperationMutationResult {
  dashboard_id: string;
  content_hash: string;
  draft_version: number;
  operation: DashboardOperation;
}

interface RemoveOperationResult {
  dashboard_id: string;
  content_hash: string;
  draft_version: number;
  removed: string;
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
      headers: this.draft.preconditions(),
      body: JSON.stringify(operation),
    });
    this.draft.applyOperation(response.data.operation, response.data);
    return response.data.operation;
  }

  async remove(key: string): Promise<void> {
    const response = await this.draft.request<ApiResponse<RemoveOperationResult>>(
      `/draft/operations/${segment(key)}`,
      {
        method: "DELETE",
        headers: this.draft.preconditions(),
      },
    );
    this.draft.removeOperation(response.data.removed, response.data);
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

/**
 * A dashboard draft. API keys author drafts only: publishing, sharing and
 * lifecycle actions happen in the GluonDB editor at `editorUrl`.
 */
export class DashboardDraft {
  public readonly operations: DashboardOperations;
  public readonly blocks: DashboardBlocks;

  private summaryValue: DashboardSummary;
  private revisionValue: number;
  private revisionIdValue: string;
  private documentValue: DashboardDocumentV1;
  private contentHashValue: string;
  private draftVersionValue: number;
  private operationValues: DashboardOperation[];
  private editorUrlValue: string | undefined;

  constructor(
    private readonly client: GluonClient,
    data: DashboardDraftData,
  ) {
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

  /** Advances on every document or operation edit, including other writers'. */
  get draftVersion(): number {
    return this.draftVersionValue;
  }

  /** Where a signed-in user reviews and publishes this draft. */
  get editorUrl(): string | undefined {
    return this.editorUrlValue;
  }

  get operationList(): readonly DashboardOperation[] {
    return this.operationValues;
  }

  /** Both preconditions the server requires on every draft mutation. */
  preconditions(): Record<string, string> {
    return {
      "If-Match": this.contentHashValue,
      "If-Draft-Version": String(this.draftVersionValue),
    };
  }

  request<T>(suffix: string, init?: RequestInit): Promise<T> {
    return this.client.request<T>(`/dashboards/${segment(this.id)}${suffix}`, init);
  }

  applyOperation(operation: DashboardOperation, state: DraftState): void {
    this.operationValues = [
      ...this.operationValues.filter((candidate) => candidate.key !== operation.key),
      operation,
    ];
    this.applyState(state);
  }

  removeOperation(key: string, state: DraftState): void {
    this.operationValues = this.operationValues.filter(
      (operation) => operation.key !== key,
    );
    this.applyState(state);
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
      headers: this.preconditions(),
      body: JSON.stringify({ patch }),
    });
    this.revisionValue = response.data.revision;
    this.revisionIdValue = response.data.revision_id;
    this.documentValue = response.data.document;
    this.applyState(response.data);
    return this;
  }

  private applyState(state: DraftState): void {
    this.contentHashValue = state.content_hash;
    this.draftVersionValue = state.draft_version;
  }

  private applySnapshot(data: DashboardDraftData): void {
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
  constructor(private readonly client: GluonClient) {}

  /** Dashboards in the projects this API key was granted, optionally one project. */
  async list(projectId?: string): Promise<DashboardSummary[]> {
    const query = projectId ? `?project_id=${segment(projectId)}` : "";
    const response = await this.client.request<
      ApiResponse<{ dashboards: DashboardSummary[] }>
    >(`/dashboards${query}`);
    return response.data.dashboards;
  }

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
