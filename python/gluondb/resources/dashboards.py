from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Mapping, Optional, Sequence, Tuple, Union
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
class DashboardPermission:
    id: str
    email: str
    user_id: Optional[str]
    role: Literal["viewer", "editor"]
    created_at: str


@dataclass
class DashboardPreviewResult:
    columns: List[Dict[str, str]]
    rows: List[List[Any]]
    row_count: int
    execution_time_ms: int
    truncated: bool
    truncation_reason: Optional[str]


@dataclass
class DashboardPublishResult:
    dashboard_id: str
    published_revision: int
    published_revision_id: str
    published_content_hash: str
    published_at: str
    next_draft_revision: int
    next_draft_revision_id: str
    next_draft_hash: str
    reused_grant: bool
    dry_run: Dict[str, List[str]]


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


def _publish_result(value: Mapping[str, Any]) -> DashboardPublishResult:
    return DashboardPublishResult(
        dashboard_id=value["dashboard_id"],
        published_revision=value["published_revision"],
        published_revision_id=value["published_revision_id"],
        published_content_hash=value["published_content_hash"],
        published_at=value["published_at"],
        next_draft_revision=value["next_draft_revision"],
        next_draft_revision_id=value["next_draft_revision_id"],
        next_draft_hash=value["next_draft_hash"],
        reused_grant=value["reused_grant"],
        dry_run=value["dry_run"],
    )


class _DashboardDraftState:
    def __init__(self, data: Mapping[str, Any]) -> None:
        self._apply_snapshot(data)

    def _apply_snapshot(self, data: Mapping[str, Any]) -> None:
        self.summary = DashboardSummary(**data["dashboard"])
        self.revision = data["revision"]
        self.revision_id = data["revision_id"]
        self.document: DashboardDocumentV1 = data["document"]
        self.content_hash = data["content_hash"]
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

    def _apply_operation(
        self, operation: DashboardOperation, content_hash: str
    ) -> None:
        self._operation_list = [
            current
            for current in self._operation_list
            if current.key != operation.key
        ] + [operation]
        self.content_hash = content_hash

    def _remove_operation(self, key: str, content_hash: str) -> None:
        self._operation_list = [
            operation for operation in self._operation_list if operation.key != key
        ]
        self.content_hash = content_hash

    def _apply_publish(self, result: DashboardPublishResult) -> None:
        self.revision = result.next_draft_revision
        self.revision_id = result.next_draft_revision_id
        self.content_hash = result.next_draft_hash
        self.summary.published_revision_id = result.published_revision_id
        self.summary.draft_revision_id = result.next_draft_revision_id


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
            headers={"If-Match": self._draft.content_hash},
        )
        data = response["data"]
        stored = DashboardOperation.from_dict(data["operation"])
        self._draft._apply_operation(stored, data["content_hash"])
        return stored

    def remove(self, key: str) -> None:
        response = self._draft._request(
            "DELETE",
            f"/draft/operations/{_segment(key)}",
            headers={"If-Match": self._draft.content_hash},
        )
        data = response["data"]
        self._draft._remove_operation(data["removed"], data["content_hash"])

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
            headers={"If-Match": self.content_hash},
        )
        data = response["data"]
        self.revision = data["revision"]
        self.revision_id = data["revision_id"]
        self.document = data["document"]
        self.content_hash = data["content_hash"]
        return self

    def publish(self) -> DashboardPublishResult:
        response = self._request(
            "POST", "/publish", headers={"If-Match": self.content_hash}
        )
        result = _publish_result(response["data"])
        self._apply_publish(result)
        return result

    def share(
        self, email: str, role: Literal["viewer", "editor"] = "viewer"
    ) -> DashboardPermission:
        response = self._request(
            "POST", "/permissions", json={"email": email, "role": role}
        )
        data = response["data"]
        self.content_hash = data["content_hash"]
        return DashboardPermission(**data["permission"])


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
            headers={"If-Match": self._draft.content_hash},
        )
        data = response["data"]
        stored = DashboardOperation.from_dict(data["operation"])
        self._draft._apply_operation(stored, data["content_hash"])
        return stored

    async def remove(self, key: str) -> None:
        response = await self._draft._request(
            "DELETE",
            f"/draft/operations/{_segment(key)}",
            headers={"If-Match": self._draft.content_hash},
        )
        data = response["data"]
        self._draft._remove_operation(data["removed"], data["content_hash"])

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
            headers={"If-Match": self.content_hash},
        )
        data = response["data"]
        self.revision = data["revision"]
        self.revision_id = data["revision_id"]
        self.document = data["document"]
        self.content_hash = data["content_hash"]
        return self

    async def publish(self) -> DashboardPublishResult:
        response = await self._request(
            "POST", "/publish", headers={"If-Match": self.content_hash}
        )
        result = _publish_result(response["data"])
        self._apply_publish(result)
        return result

    async def share(
        self, email: str, role: Literal["viewer", "editor"] = "viewer"
    ) -> DashboardPermission:
        response = await self._request(
            "POST", "/permissions", json={"email": email, "role": role}
        )
        data = response["data"]
        self.content_hash = data["content_hash"]
        return DashboardPermission(**data["permission"])


class DashboardsResource:
    def __init__(self, client: GluonClient) -> None:
        self._client = client

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
