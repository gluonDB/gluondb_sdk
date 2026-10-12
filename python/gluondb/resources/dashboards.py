from __future__ import annotations

from dataclasses import dataclass, field, fields
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple, Union
from urllib.parse import quote

from ..client import AsyncGluonClient, GluonClient
from ..generated import DashboardBlock, DashboardDocumentV1, DashboardOperationPutBody

DashboardParameterValues = Union[
    Mapping[str, Any], Sequence[Mapping[str, Any]]
]
JsonPatch = Sequence[Mapping[str, Any]]


@dataclass
class DashboardSummary:
    id: str
    project_id: str
    owner_user_id: str
    name: str
    description: Optional[str]
    draft_revision_id: Optional[str]
    published_revision_id: Optional[str]
    created_at: str
    updated_at: str
    archived_at: Optional[str] = None
    # What this API key may do with the dashboard; the server still enforces it.
    can_edit: bool = False
    can_manage: bool = False
    allowed_actions: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "DashboardSummary":
        # The server adds summary fields over time; unknown ones must not break parsing.
        known = {item.name for item in fields(cls)}
        return cls(**{key: item for key, item in value.items() if key in known})


@dataclass
class DashboardOperation:
    key: str
    datasource_id: str
    sql: str
    parameters: Dict[str, Any]
    result_schema: Optional[Dict[str, Any]]
    query_hash: str

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "DashboardOperation":
        return cls(
            key=value["key"],
            datasource_id=value["datasource_id"],
            sql=value["sql"],
            parameters=dict(value.get("parameters", {})),
            result_schema=value.get("result_schema"),
            query_hash=value["query_hash"],
        )


@dataclass
class DashboardPreviewResult:
    columns: List[Dict[str, str]]
    rows: List[List[Any]]
    row_count: int
    execution_time_ms: int
    truncated: bool
    truncation_reason: Optional[str]


def _segment(value: str) -> str:
    return quote(value, safe="")


def _preview_result(response: Mapping[str, Any]) -> DashboardPreviewResult:
    data = response["data"]
    meta = response["meta"]
    return DashboardPreviewResult(
        columns=data["columns"],
        rows=data["rows"],
        row_count=meta["row_count"],
        execution_time_ms=meta["execution_time_ms"],
        truncated=meta["truncated"],
        truncation_reason=meta.get("truncation_reason"),
    )


class _DashboardDraftState:
    def __init__(self, data: Mapping[str, Any]) -> None:
        self._apply_snapshot(data)

    def _apply_snapshot(self, data: Mapping[str, Any]) -> None:
        self.summary = DashboardSummary.from_dict(data["dashboard"])
        self.revision = data["revision"]
        self.revision_id = data["revision_id"]
        self.document: DashboardDocumentV1 = data["document"]
        self.content_hash = data["content_hash"]
        # Advances on every document or operation edit, including other writers'.
        self.draft_version: int = data["draft_version"]
        # Where a signed-in user reviews and publishes this draft.
        self.editor_url: Optional[str] = data.get("editor_url")
        self._operation_list = [
            DashboardOperation.from_dict(operation)
            for operation in data.get("operations", [])
        ]

    @property
    def id(self) -> str:
        return self.summary.id

    @property
    def operation_list(self) -> Tuple[DashboardOperation, ...]:
        return tuple(self._operation_list)

    def _preconditions(self) -> Dict[str, str]:
        """Both preconditions the server requires on every draft mutation."""
        return {
            "If-Match": self.content_hash,
            "If-Draft-Version": str(self.draft_version),
        }

    def _apply_state(self, data: Mapping[str, Any]) -> None:
        self.content_hash = data["content_hash"]
        self.draft_version = data["draft_version"]

    def _apply_operation(
        self, operation: DashboardOperation, data: Mapping[str, Any]
    ) -> None:
        self._operation_list = [
            current
            for current in self._operation_list
            if current.key != operation.key
        ] + [operation]
        self._apply_state(data)

    def _remove_operation(self, key: str, data: Mapping[str, Any]) -> None:
        self._operation_list = [
            operation for operation in self._operation_list if operation.key != key
        ]
        self._apply_state(data)


class DashboardOperations:
    def __init__(self, draft: "DashboardDraft") -> None:
        self._draft = draft

    def put(
        self, key: str, operation: DashboardOperationPutBody
    ) -> DashboardOperation:
        response = self._draft._request(
            "PUT",
            f"/draft/operations/{_segment(key)}",
            json=operation,
            headers=self._draft._preconditions(),
        )
        data = response["data"]
        stored = DashboardOperation.from_dict(data["operation"])
        self._draft._apply_operation(stored, data)
        return stored

    def remove(self, key: str) -> None:
        response = self._draft._request(
            "DELETE",
            f"/draft/operations/{_segment(key)}",
            headers=self._draft._preconditions(),
        )
        data = response["data"]
        self._draft._remove_operation(data["removed"], data)

    def preview(
        self, key: str, parameters: Optional[DashboardParameterValues] = None
    ) -> DashboardPreviewResult:
        response = self._draft._request(
            "POST",
            f"/draft/operations/{_segment(key)}/run",
            json={"parameters": {} if parameters is None else parameters},
        )
        return _preview_result(response)


class DashboardBlocks:
    def __init__(self, draft: "DashboardDraft") -> None:
        self._draft = draft

    def add(self, block: DashboardBlock) -> "DashboardDraft":
        return self._draft.patch_document(
            [{"op": "add", "path": "/blocks/-", "value": block}]
        )


class DashboardDraft(_DashboardDraftState):
    """A dashboard draft.

    API keys author drafts only: publishing, sharing and lifecycle actions
    happen in the GluonDB editor at ``editor_url``.
    """

    def __init__(self, client: GluonClient, data: Mapping[str, Any]) -> None:
        super().__init__(data)
        self._client = client
        self.operations = DashboardOperations(self)
        self.blocks = DashboardBlocks(self)

    def _request(
        self,
        method: str,
        suffix: str,
        *,
        json: Optional[Any] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Any:
        return self._client.request(
            method,
            f"/dashboards/{_segment(self.id)}{suffix}",
            json=json,
            headers=headers,
        )

    def refresh(self) -> "DashboardDraft":
        response = self._request("GET", "/draft")
        self._apply_snapshot(response["data"])
        return self

    def patch_document(self, patch: JsonPatch) -> "DashboardDraft":
        response = self._request(
            "PATCH",
            "/draft",
            json={"patch": patch},
            headers=self._preconditions(),
        )
        data = response["data"]
        self.revision = data["revision"]
        self.revision_id = data["revision_id"]
        self.document = data["document"]
        self._apply_state(data)
        return self


class AsyncDashboardOperations:
    def __init__(self, draft: "AsyncDashboardDraft") -> None:
        self._draft = draft

    async def put(
        self, key: str, operation: DashboardOperationPutBody
    ) -> DashboardOperation:
        response = await self._draft._request(
            "PUT",
            f"/draft/operations/{_segment(key)}",
            json=operation,
            headers=self._draft._preconditions(),
        )
        data = response["data"]
        stored = DashboardOperation.from_dict(data["operation"])
        self._draft._apply_operation(stored, data)
        return stored

    async def remove(self, key: str) -> None:
        response = await self._draft._request(
            "DELETE",
            f"/draft/operations/{_segment(key)}",
            headers=self._draft._preconditions(),
        )
        data = response["data"]
        self._draft._remove_operation(data["removed"], data)

    async def preview(
        self, key: str, parameters: Optional[DashboardParameterValues] = None
    ) -> DashboardPreviewResult:
        response = await self._draft._request(
            "POST",
            f"/draft/operations/{_segment(key)}/run",
            json={"parameters": {} if parameters is None else parameters},
        )
        return _preview_result(response)


class AsyncDashboardBlocks:
    def __init__(self, draft: "AsyncDashboardDraft") -> None:
        self._draft = draft

    async def add(self, block: DashboardBlock) -> "AsyncDashboardDraft":
        return await self._draft.patch_document(
            [{"op": "add", "path": "/blocks/-", "value": block}]
        )


class AsyncDashboardDraft(_DashboardDraftState):
    """Async variant of :class:`DashboardDraft`."""

    def __init__(self, client: AsyncGluonClient, data: Mapping[str, Any]) -> None:
        super().__init__(data)
        self._client = client
        self.operations = AsyncDashboardOperations(self)
        self.blocks = AsyncDashboardBlocks(self)

    async def _request(
        self,
        method: str,
        suffix: str,
        *,
        json: Optional[Any] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Any:
        return await self._client.request(
            method,
            f"/dashboards/{_segment(self.id)}{suffix}",
            json=json,
            headers=headers,
        )

    async def refresh(self) -> "AsyncDashboardDraft":
        response = await self._request("GET", "/draft")
        self._apply_snapshot(response["data"])
        return self

    async def patch_document(self, patch: JsonPatch) -> "AsyncDashboardDraft":
        response = await self._request(
            "PATCH",
            "/draft",
            json={"patch": patch},
            headers=self._preconditions(),
        )
        data = response["data"]
        self.revision = data["revision"]
        self.revision_id = data["revision_id"]
        self.document = data["document"]
        self._apply_state(data)
        return self


def _list_path(project_id: Optional[str]) -> str:
    return f"/dashboards?project_id={_segment(project_id)}" if project_id else "/dashboards"


def _summaries(response: Mapping[str, Any]) -> List[DashboardSummary]:
    return [
        DashboardSummary.from_dict(item) for item in response["data"]["dashboards"]
    ]


class DashboardsResource:
    def __init__(self, client: GluonClient) -> None:
        self._client = client

    def list(self, project_id: Optional[str] = None) -> List[DashboardSummary]:
        """Dashboards in the projects this API key was granted, optionally one project."""
        return _summaries(self._client.request("GET", _list_path(project_id)))

    def create(
        self, *, project_id: str, name: str, description: Optional[str] = None
    ) -> DashboardDraft:
        response = self._client.request(
            "POST",
            "/dashboards",
            json={
                "project_id": project_id,
                "name": name,
                "description": description,
            },
        )
        return DashboardDraft(self._client, response["data"])

    def get_draft(self, dashboard_id: str) -> DashboardDraft:
        response = self._client.request(
            "GET", f"/dashboards/{_segment(dashboard_id)}/draft"
        )
        return DashboardDraft(self._client, response["data"])


class AsyncDashboardsResource:
    def __init__(self, client: AsyncGluonClient) -> None:
        self._client = client

    async def list(self, project_id: Optional[str] = None) -> List[DashboardSummary]:
        """Dashboards in the projects this API key was granted, optionally one project."""
        return _summaries(await self._client.request("GET", _list_path(project_id)))

    async def create(
        self, *, project_id: str, name: str, description: Optional[str] = None
    ) -> AsyncDashboardDraft:
        response = await self._client.request(
            "POST",
            "/dashboards",
            json={
                "project_id": project_id,
                "name": name,
                "description": description,
            },
        )
        return AsyncDashboardDraft(self._client, response["data"])

    async def get_draft(self, dashboard_id: str) -> AsyncDashboardDraft:
        response = await self._client.request(
            "GET", f"/dashboards/{_segment(dashboard_id)}/draft"
        )
        return AsyncDashboardDraft(self._client, response["data"])
