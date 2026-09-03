from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import cast

from gluondb import DashboardBlock, DashboardOperationPutBody, GluonDB


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


root = Path(__file__).resolve().parents[1]
document = json.loads(
    (
        root
        / "contracts"
        / "dashboard-v1"
        / "fixtures"
        / "valid"
        / "representative.json"
    ).read_text()
)
operations = json.loads((root / "examples" / "representative-operations.json").read_text())

gluon = GluonDB(
    api_key=required("GLUONDB_KEY"),
    base_url=required("GLUONDB_BASE_URL"),
)
dashboard = gluon.dashboards.create(
    project_id=required("GLUONDB_PROJECT_ID"),
    name=f"SDK representative {datetime.now(timezone.utc).isoformat()}",
)

for declaration in operations:
    operation = {
        "datasource_id": required("GLUONDB_DATASOURCE_ID"),
        **{key: value for key, value in declaration.items() if key != "key"},
    }
    dashboard.operations.put(
        declaration["key"], cast(DashboardOperationPutBody, operation)
    )

dashboard.patch_document(
    [{"op": "replace", "path": "/parameters", "value": document["parameters"]}]
)
for block in document["blocks"]:
    dashboard.blocks.add(cast(DashboardBlock, block))

published = dashboard.publish()
print(
    json.dumps(
        {
            "dashboard_id": dashboard.id,
            "published_revision": published.published_revision,
            "next_draft_hash": dashboard.content_hash,
        },
        indent=2,
    )
)
