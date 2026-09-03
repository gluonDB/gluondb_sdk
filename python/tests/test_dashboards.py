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
    "created_at": "2026-09-02T00:00:00Z",
    "updated_at": "2026-09-02T00:00:00Z",
}


def envelope(data: Dict[str, Any]) -> Dict[str, Any]:
    return {"data": data, "meta": {"api_version": "v1"}}


def draft(content_hash: str = "sha256:one") -> Dict[str, Any]:
    return envelope(
        {
            "dashboard": SUMMARY,
            "revision": 1,
            "revision_id": "revision-1",
            "document": DOCUMENT,
            "content_hash": content_hash,
            "operations": [],
        }
    )


def test_sync_builder_carries_and_advances_hash() -> None:
    requests: List[httpx.Request] = []
    replies = [
        httpx.Response(201, json=draft()),
        httpx.Response(
            200,
            json=envelope(
                {
                    "dashboard_id": "dashboard-1",
                    "content_hash": "sha256:one",
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
                }
            ),
        ),
        httpx.Response(
            200,
            json=envelope(
                {
                    "dashboard_id": "dashboard-1",
                    "published_revision": 1,
                    "published_revision_id": "revision-1",
                    "published_content_hash": "sha256:two",
                    "published_at": "2026-09-02T01:00:00Z",
                    "next_draft_revision": 2,
                    "next_draft_revision_id": "revision-2",
                    "next_draft_hash": "sha256:three",
                    "reused_grant": False,
                    "dry_run": {"executed": [], "skipped": []},
                }
            ),
        ),
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return replies.pop(0)

    gluon = GluonDB(api_key="gluon_test", base_url="https://api.test")
    gluon._client._client = httpx.Client(
        base_url="https://api.test/v1", transport=httpx.MockTransport(handler)
    )
    dashboard = gluon.dashboards.create(project_id="project-1", name="Revenue")
    assert dashboard.content_hash == "sha256:one"

    body = {key: value for key, value in OPERATION.items() if key != "key"}
    dashboard.operations.put(OPERATION["key"], cast(DashboardOperationPutBody, body))
    assert requests[1].headers["if-match"] == "sha256:one"
    assert dashboard.operation_list[0].key == OPERATION["key"]

    dashboard.patch_document(
        [{"op": "replace", "path": "/theme", "value": "dark"}]
    )
    assert requests[2].headers["if-match"] == "sha256:one"
    assert dashboard.content_hash == "sha256:two"

    dashboard.publish()
    assert requests[3].headers["if-match"] == "sha256:two"
    assert dashboard.content_hash == "sha256:three"
    assert dashboard.revision == 2


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
                    "permission": {
                        "id": "permission-1",
                        "email": "viewer@example.com",
                        "user_id": None,
                        "role": "viewer",
                        "created_at": "2026-09-02T00:00:00Z",
                    },
                }
            ),
        ),
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
        permission = await dashboard.share("viewer@example.com")
        assert permission.role == "viewer"
        assert requests[1].url.path.endswith("/dashboards/dashboard-1/permissions")
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
