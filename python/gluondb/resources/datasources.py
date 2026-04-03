from __future__ import annotations

from typing import Any, Dict, List
from urllib.parse import quote

from ..client import GluonClient, AsyncGluonClient
from ..types import Datasource


def _parse_datasources(data: Dict[str, Any]) -> List[Datasource]:
    return [
        Datasource(
            id=d["id"],
            name=d["name"],
            db_type=d["db_type"],
            created_at=d["created_at"],
        )
        for d in data.get("data", [])
    ]


class DatasourcesResource:
    def __init__(self, client: GluonClient) -> None:
        self._client = client

    def list(self, project_id: str) -> List[Datasource]:
        path = f"/projects/{quote(project_id, safe='')}/datasources"
        data = self._client.request("GET", path)
        return _parse_datasources(data)


class AsyncDatasourcesResource:
    def __init__(self, client: AsyncGluonClient) -> None:
        self._client = client

    async def list(self, project_id: str) -> List[Datasource]:
        path = f"/projects/{quote(project_id, safe='')}/datasources"
        data = await self._client.request("GET", path)
        return _parse_datasources(data)
