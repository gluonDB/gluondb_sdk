from __future__ import annotations

from typing import Any, Dict, List

from ..client import GluonClient, AsyncGluonClient
from ..types import Project


def _parse_projects(data: Dict[str, Any]) -> List[Project]:
    return [
        Project(id=p["id"], name=p["name"], created_at=p["created_at"])
        for p in data.get("data", [])
    ]


class ProjectsResource:
    def __init__(self, client: GluonClient) -> None:
        self._client = client

    def list(self) -> List[Project]:
        data = self._client.request("GET", "/projects")
        return _parse_projects(data)


class AsyncProjectsResource:
    def __init__(self, client: AsyncGluonClient) -> None:
        self._client = client

    async def list(self) -> List[Project]:
        data = await self._client.request("GET", "/projects")
        return _parse_projects(data)
