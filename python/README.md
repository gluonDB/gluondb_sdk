# GluonDB Python SDK

Official Python SDK for the GluonDB public API.

## Install

```bash
pip install gluondb
```

## Dashboard authoring

```python
dashboard = gluon.dashboards.create(project_id=project_id, name="Revenue")

dashboard.operations.put(
    "revenue_by_day",
    {
        "datasource_id": datasource_id,
        "sql": "SELECT order_date AS day, SUM(total) AS revenue FROM orders GROUP BY 1",
        "parameters": {},
        "result_schema": {
            "columns": [
                {"name": "day", "type": "date"},
                {"name": "revenue", "type": "numeric"},
            ]
        },
    },
)
dashboard.blocks.add(
    {
        "id": "revenue",
        "type": "line_chart",
        "operation": "revenue_by_day",
        "position": {"x": 0, "y": 0, "w": 8, "h": 5},
        "mapping": {"x": "day", "y": ["revenue"]},
    }
)
dashboard.publish()
```

`AsyncGluonDB` exposes the same action set with awaitable methods. Draft
conflicts raise `DashboardConflictError` with `current_hash`; the SDK never
retries a mutation automatically. Generated `TypedDict` models provide editor
and type-checker guidance while validation and authorization remain
server-owned.

## Quick Start

```python
from gluondb import GluonDB

gluon = GluonDB(api_key="gluon_...")
pg = gluon.datasource("your-datasource-id")

result = pg.query("SELECT * FROM users LIMIT 10")
print(result.rows)
```

## Optional pandas integration

```bash
pip install "gluondb[pandas]"
```

## Configuration

- `api_key` (required): GluonDB API key.
- `base_url` (default: `https://api.gluondb.com`): API base URL.
- `api_version` (default: `v1`): API version segment.
- `timeout` (default: `30.0`): HTTP timeout in seconds.

## License

Apache-2.0
