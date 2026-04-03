from __future__ import annotations

from typing import Optional

from .client import AsyncGluonClient, GluonClient
from .resources.query import _build_body, _parse_result
from .types import QueryResult


class BoundDatasource:
    """A datasource handle that knows its identity, so you just call ``.query(sql)``."""

    def __init__(
        self,
        client: GluonClient,
        *,
        datasource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        name: Optional[str] = None,
    ) -> None:
        if datasource_id:
            self._ds_id: Optional[str] = datasource_id
            self._project_id: Optional[str] = None
            self._name: Optional[str] = None
        elif project_id and name:
            self._ds_id = None
            self._project_id = project_id
            self._name = name
        else:
            raise ValueError("Provide datasource_id, or project_id + name")
        self._client = client

    def query(self, sql: str) -> QueryResult:
        body = _build_body(sql, self._ds_id, self._project_id, self._name)
        data = self._client.request("POST", "/query", json=body)
        return _parse_result(data)


class AsyncBoundDatasource:
    """Async variant of :class:`BoundDatasource`."""

    def __init__(
        self,
        client: AsyncGluonClient,
        *,
        datasource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        name: Optional[str] = None,
    ) -> None:
        if datasource_id:
            self._ds_id: Optional[str] = datasource_id
            self._project_id: Optional[str] = None
            self._name: Optional[str] = None
        elif project_id and name:
            self._ds_id = None
            self._project_id = project_id
            self._name = name
        else:
            raise ValueError("Provide datasource_id, or project_id + name")
        self._client = client

    async def query(self, sql: str) -> QueryResult:
        body = _build_body(sql, self._ds_id, self._project_id, self._name)
        data = await self._client.request("POST", "/query", json=body)
        return _parse_result(data)
