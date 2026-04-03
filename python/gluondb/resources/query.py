"""Query helpers shared by BoundDatasource and AsyncBoundDatasource."""

from __future__ import annotations

from typing import Any, Dict, Optional

from ..types import Column, QueryResult


def _parse_result(data: Dict[str, Any]) -> QueryResult:
    raw_data = data["data"]
    meta = data.get("meta", {})
    columns = [
        Column(name=c.get("name", ""), type=c.get("type", c.get("type_name", "")))
        for c in raw_data.get("columns", [])
    ]
    return QueryResult(
        columns=columns,
        rows=raw_data.get("rows", []),
        row_count=raw_data.get("row_count", 0),
        datasource_id=meta.get("datasource_id", ""),
        execution_time_ms=meta.get("execution_time_ms", 0),
        api_version=meta.get("api_version", ""),
    )


def _build_body(
    sql: str,
    datasource_id: Optional[str],
    project_id: Optional[str],
    datasource: Optional[str],
) -> Dict[str, Any]:
    if datasource_id:
        return {"datasource_id": datasource_id, "query": sql}
    if project_id and datasource:
        return {
            "project_id": project_id,
            "datasource_name": datasource,
            "query": sql,
        }
    raise ValueError(
        "Provide datasource_id, or project_id + datasource"
    )
