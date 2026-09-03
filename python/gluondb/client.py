from __future__ import annotations

from typing import Any, Dict, Mapping, Optional

import httpx

DEFAULT_BASE_URL = "https://api.gluondb.com"
DEFAULT_API_VERSION = "v1"


class GluonAPIError(Exception):
    """Raised when the GluonDB API returns an error response."""

    def __init__(
        self,
        code: str,
        message: str,
        status: int,
        error: Optional[Mapping[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status = status
        self.error = dict(error or {})
        self.details = self.error.get("details")
        self.retry_after_ms = self.error.get("retry_after_ms")


class DashboardConflictError(GluonAPIError):
    """A conditional draft mutation used an out-of-date content hash."""

    def __init__(self, code: str, message: str, status: int, current_hash: str) -> None:
        super().__init__(code, message, status, {"current_hash": current_hash})
        self.current_hash = current_hash


class RevisionChangedError(GluonAPIError):
    """A published operation targeted a revision that is no longer current."""

    def __init__(self, message: str, status: int, current_revision: int) -> None:
        super().__init__(
            "REVISION_CHANGED",
            message,
            status,
            {"current_revision": current_revision},
        )
        self.current_revision = current_revision


def _api_error(response: httpx.Response) -> GluonAPIError:
    try:
        body = response.json() if response.content else {}
    except ValueError:
        body = {}
    error = body.get("error", {}) if isinstance(body, dict) else {}
    if not isinstance(error, dict):
        error = {}
    raw_code = error.get("code")
    code: str = raw_code if isinstance(raw_code, str) else "UNKNOWN"
    raw_message = error.get("message")
    message: str = (
        raw_message if isinstance(raw_message, str) else f"HTTP {response.status_code}"
    )
    current_hash = error.get("current_hash")
    if code in {"DRAFT_CONFLICT", "CONTENT_CONFLICT"} and isinstance(
        current_hash, str
    ):
        return DashboardConflictError(code, message, response.status_code, current_hash)
    current_revision = error.get("current_revision")
    if code == "REVISION_CHANGED" and isinstance(current_revision, int):
        return RevisionChangedError(message, response.status_code, current_revision)
    return GluonAPIError(code, message, response.status_code, error)


class GluonClient:
    """Low-level HTTP client for the GluonDB public API."""

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        api_version: str = DEFAULT_API_VERSION,
        timeout: float = 30.0,
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required")
        self._base_url = f"{base_url.rstrip('/')}/{api_version}"
        self._client = httpx.Client(
            base_url=self._base_url,
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            timeout=timeout,
            follow_redirects=True,
        )

    def request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[Any] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Any:
        resp = self._client.request(method, path, json=json, headers=headers)
        if resp.status_code >= 400:
            raise _api_error(resp)
        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()


class AsyncGluonClient:
    """Async variant of :class:`GluonClient`."""

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        api_version: str = DEFAULT_API_VERSION,
        timeout: float = 30.0,
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required")
        self._base_url = f"{base_url.rstrip('/')}/{api_version}"
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            timeout=timeout,
            follow_redirects=True,
        )

    async def request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[Any] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Any:
        resp = await self._client.request(method, path, json=json, headers=headers)
        if resp.status_code >= 400:
            raise _api_error(resp)
        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()
