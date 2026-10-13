from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List, cast

import httpx
import pytest

from gluondb import (
    AsyncGluonDB,
    DashboardConflictError,
    DashboardOperationPutBody,
    GluonDB,
    GluonAPIError,
    RevisionChangedError,
)


CONTRACT_ROOT = Path(__file__).resolve().parents[2] / "contracts" / "dashboard-v1"
DOCUMENT = json.loads(
    (CONTRACT_ROOT / "fixtures" / "valid" / "representative.json").read_text()
)
OPERATION = json.loads(
    (
        CONTRACT_ROOT
        / "fixtures"
        / "operations"
        / "valid"
        / "representative.json"
    ).read_text()
)
INVALID_DOCUMENT = json.loads(
    (CONTRACT_ROOT / "fixtures" / "invalid" / "unknown-field.json").read_text()
)
SUMMARY = {
    "id": "dashboard-1",
    "project_id": "project-1",
    "owner_user_id": "user-1",
    "name": "Revenue",
    "description": None,
    "draft_revision_id": "revision-1",
    "published_revision_id": None,
    "archived_at": None,
    "created_at": "2026-09-02T00:00:00Z",
    "updated_at": "2026-09-02T00:00:00Z",
    "can_edit": True,
    "can_manage": False,
    "allowed_actions": ["get_draft", "patch_document", "put_operation"],
    # A field this SDK version does not know about must not break parsing.
    "added_by_a_later_server": True,
}


def envelope(data: Dict[str, Any]) -> Dict[str, Any]:
    return {"data": data, "meta": {"api_version": "v1"}}


def draft(content_hash: str = "sha256:one", draft_version: int = 1) -> Dict[str, Any]:
    return envelope(
        {
            "dashboard": SUMMARY,
            "editor_url": "https://app.test/dashboards/dashboard-1/edit",
            "revision": 1,
            "revision_id": "revision-1",
            "document": DOCUMENT,
            "content_hash": content_hash,
            "draft_version": draft_version,
            "operations": [],
        }
    )


def sync_client(handler: Any) -> GluonDB:
    gluon = GluonDB(api_key="gluon_test", base_url="https://api.test")
    gluon._client._client = httpx.Client(
        base_url="https://api.test/v1", transport=httpx.MockTransport(handler)
    )
    return gluon


def test_sync_builder_carries_and_advances_hash_and_version() -> None:
    requests: List[httpx.Request] = []
    replies = [
        httpx.Response(201, json=draft()),
        httpx.Response(
            200,
            json=envelope(
                {
                    "dashboard_id": "dashboard-1",
                    "content_hash": "sha256:one",
                    "draft_version": 2,
                    "operation": {**OPERATION, "query_hash": "sha256:query"},
                }
            ),
        ),
        httpx.Response(
            200,
            json=envelope(
                {
                    "dashboard_id": "dashboard-1",
                    "revision": 1,
                    "revision_id": "revision-1",
                    "document": {**DOCUMENT, "theme": "dark"},
                    "content_hash": "sha256:two",
                    "draft_version": 3,
                }
            ),
        ),
        httpx.Response(
            200,
            json=envelope(
                {
                    "dashboard_id": "dashboard-1",
                    "content_hash": "sha256:two",
                    "draft_version": 4,
                    "removed": OPERATION["key"],
                }
            ),
        ),
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return replies.pop(0)

    gluon = sync_client(handler)
    dashboard = gluon.dashboards.create(project_id="project-1", name="Revenue")
    assert dashboard.content_hash == "sha256:one"
    assert dashboard.draft_version == 1
    assert dashboard.editor_url == "https://app.test/dashboards/dashboard-1/edit"
    assert dashboard.summary.allowed_actions[0] == "get_draft"

    body = {key: value for key, value in OPERATION.items() if key != "key"}
    dashboard.operations.put(OPERATION["key"], cast(DashboardOperationPutBody, body))
    assert requests[1].headers["if-match"] == "sha256:one"
    assert requests[1].headers["if-draft-version"] == "1"
    assert dashboard.operation_list[0].key == OPERATION["key"]
    assert dashboard.draft_version == 2

    dashboard.patch_document(
        [{"op": "replace", "path": "/theme", "value": "dark"}]
    )
    assert requests[2].headers["if-match"] == "sha256:one"
    assert requests[2].headers["if-draft-version"] == "2"
    assert dashboard.content_hash == "sha256:two"
    assert dashboard.draft_version == 3

    dashboard.operations.remove(OPERATION["key"])
    assert requests[3].method == "DELETE"
    assert requests[3].headers["if-match"] == "sha256:two"
    assert requests[3].headers["if-draft-version"] == "3"
    assert dashboard.operation_list == ()
    assert dashboard.draft_version == 4


def test_api_keys_author_drafts_only() -> None:
    gluon = sync_client(lambda request: httpx.Response(200, json=draft()))
    dashboard = gluon.dashboards.get_draft("dashboard-1")
    for method in ("publish", "share", "archive", "restore", "delete"):
        assert not hasattr(dashboard, method)
        assert not hasattr(gluon.dashboards, method)


def test_lists_dashboards_optionally_for_one_project() -> None:
    requests: List[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=envelope({"dashboards": [SUMMARY]}))

    gluon = sync_client(handler)
    assert [item.id for item in gluon.dashboards.list()] == ["dashboard-1"]
    gluon.dashboards.list("project 1")
    assert [str(request.url) for request in requests] == [
        "https://api.test/v1/dashboards",
        "https://api.test/v1/dashboards?project_id=project%201",
    ]


def test_stale_draft_version_surfaces_current_version_without_retry() -> None:
    replies = [
        httpx.Response(200, json=draft()),
        httpx.Response(
            412,
            json={
                "error": {
                    "code": "DRAFT_CONFLICT",
                    "message": "Draft changed; reload and review before retrying",
                    "current_draft_version": 5,
                }
            },
        ),
    ]
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return replies.pop(0)

    gluon = sync_client(handler)
    dashboard = gluon.dashboards.get_draft("dashboard-1")
    with pytest.raises(DashboardConflictError) as raised:
        dashboard.patch_document([{"op": "replace", "path": "/theme", "value": "dark"}])
    assert raised.value.status == 412
    assert raised.value.current_draft_version == 5
    assert raised.value.current_hash is None
    assert calls == 2
    assert dashboard.draft_version == 1


@pytest.mark.parametrize(
    ("payload", "error_type", "attribute", "expected"),
    [
        (
            {
                "error": {
                    "code": "DRAFT_CONFLICT",
                    "message": "Draft changed",
                    "current_hash": "sha256:current",
                }
            },
            DashboardConflictError,
            "current_hash",
            "sha256:current",
        ),
        (
            {
                "error": {
                    "code": "REVISION_CHANGED",
                    "message": "Reload",
                    "current_revision": 7,
                }
            },
            RevisionChangedError,
            "current_revision",
            7,
        ),
    ],
)
def test_typed_dashboard_errors(
    payload: Dict[str, Any],
    error_type: type[Exception],
    attribute: str,
    expected: Any,
) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(412 if attribute == "current_hash" else 409, json=payload)

    gluon = GluonDB(api_key="gluon_test", base_url="https://api.test")
    gluon._client._client = httpx.Client(
        base_url="https://api.test/v1", transport=httpx.MockTransport(handler)
    )
    with pytest.raises(error_type) as raised:
        gluon.dashboards.get_draft("dashboard-1")
    assert getattr(raised.value, attribute) == expected
    assert calls == 1


def test_async_builder_uses_the_same_contract() -> None:
    requests: List[httpx.Request] = []
    replies = [
        httpx.Response(201, json=draft()),
        httpx.Response(
            200,
            json=envelope(
                {
                    "dashboard_id": "dashboard-1",
                    "content_hash": "sha256:one",
                    "draft_version": 2,
                    "removed": "revenue_by_day",
                }
            ),
        ),
        httpx.Response(200, json=envelope({"dashboards": [SUMMARY]})),
    ]

    async def run() -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return replies.pop(0)

        gluon = AsyncGluonDB(api_key="gluon_test", base_url="https://api.test")
        gluon._client._client = httpx.AsyncClient(
            base_url="https://api.test/v1", transport=httpx.MockTransport(handler)
        )
        dashboard = await gluon.dashboards.create(
            project_id="project-1", name="Revenue"
        )
        await dashboard.operations.remove("revenue_by_day")
        assert requests[1].method == "DELETE"
        assert requests[1].headers["if-match"] == "sha256:one"
        assert requests[1].headers["if-draft-version"] == "1"
        assert dashboard.draft_version == 2
        assert not hasattr(dashboard, "publish")
        assert [item.id for item in await gluon.dashboards.list()] == ["dashboard-1"]
        await gluon._client._client.aclose()

    asyncio.run(run())


def test_invalid_fixture_reaches_server_and_preserves_validation_details() -> None:
    requests: List[httpx.Request] = []
    replies = [
        httpx.Response(200, json=draft()),
        httpx.Response(
            422,
            json={
                "error": {
                    "code": "INVALID_DOCUMENT",
                    "message": "Patched document is not valid",
                    "details": [
                        {"path": ["unexpected"], "message": "Unknown field"}
                    ],
                }
            },
        ),
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return replies.pop(0)

    gluon = GluonDB(api_key="gluon_test", base_url="https://api.test")
    gluon._client._client = httpx.Client(
        base_url="https://api.test/v1", transport=httpx.MockTransport(handler)
    )
    dashboard = gluon.dashboards.get_draft("dashboard-1")
    with pytest.raises(GluonAPIError) as raised:
        dashboard.patch_document(
            [{"op": "replace", "path": "", "value": INVALID_DOCUMENT}]
        )
    assert raised.value.details == [
        {"path": ["unexpected"], "message": "Unknown field"}
    ]
    assert json.loads(requests[1].content)["patch"][0]["value"] == INVALID_DOCUMENT
