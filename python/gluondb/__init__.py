"""GluonDB Python SDK -- query your datasources from anywhere."""

from __future__ import annotations

from typing import Optional, Union, overload

from .bound import AsyncBoundDatasource, BoundDatasource
from .client import (
    AsyncGluonClient,
    GluonAPIError,
    GluonClient,
)
from .resources.datasources import AsyncDatasourcesResource, DatasourcesResource
from .resources.projects import AsyncProjectsResource, ProjectsResource
from .types import Column, Datasource, Project, QueryResult

__all__ = [
    "GluonDB",
    "AsyncGluonDB",
    "BoundDatasource",
    "AsyncBoundDatasource",
    "GluonAPIError",
    "QueryResult",
    "Column",
    "Project",
    "Datasource",
]

DEFAULT_BASE_URL = "https://api.gluondb.com"
DEFAULT_API_VERSION = "v1"


class GluonDB:
    """Synchronous GluonDB client.

    Example::

        from gluondb import GluonDB

        gluon = GluonDB(api_key="gluon_...")
        pg = gluon.datasource("ds-uuid")
        result = pg.query("SELECT * FROM users")
    """

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        api_version: str = DEFAULT_API_VERSION,
        timeout: float = 30.0,
    ) -> None:
        self._client = GluonClient(
            api_key, base_url=base_url, api_version=api_version, timeout=timeout
        )
        self.projects = ProjectsResource(self._client)
        self.datasources = DatasourcesResource(self._client)

    @overload
    def datasource(self, id: str) -> BoundDatasource: ...

    @overload
    def datasource(self, *, project_id: str, name: str) -> BoundDatasource: ...

    def datasource(
        self,
        id: Optional[str] = None,
        *,
        project_id: Optional[str] = None,
        name: Optional[str] = None,
    ) -> BoundDatasource:
        """Return a bound datasource handle.

        Call with a datasource UUID, or with ``project_id`` + ``name``.
        """
        return BoundDatasource(
            self._client, datasource_id=id, project_id=project_id, name=name
        )


class AsyncGluonDB:
    """Asynchronous GluonDB client.

    Example::

        from gluondb import AsyncGluonDB

        gluon = AsyncGluonDB(api_key="gluon_...")
        pg = gluon.datasource("ds-uuid")
        result = await pg.query("SELECT * FROM users")
    """

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        api_version: str = DEFAULT_API_VERSION,
        timeout: float = 30.0,
    ) -> None:
        self._client = AsyncGluonClient(
            api_key, base_url=base_url, api_version=api_version, timeout=timeout
        )
        self.projects = AsyncProjectsResource(self._client)
        self.datasources = AsyncDatasourcesResource(self._client)

    @overload
    def datasource(self, id: str) -> AsyncBoundDatasource: ...

    @overload
    def datasource(self, *, project_id: str, name: str) -> AsyncBoundDatasource: ...

    def datasource(
        self,
        id: Optional[str] = None,
        *,
        project_id: Optional[str] = None,
        name: Optional[str] = None,
    ) -> AsyncBoundDatasource:
        """Return a bound datasource handle.

        Call with a datasource UUID, or with ``project_id`` + ``name``.
        """
        return AsyncBoundDatasource(
            self._client, datasource_id=id, project_id=project_id, name=name
        )
