from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

DEFAULT_BASE_URL = "https://api.gluondb.com"
DEFAULT_API_VERSION = "v1"


class GluonAPIError(Exception):
    """Raised when the GluonDB API returns an error response."""

    def __init__(self, code: str, message: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


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
        json: Optional[Dict[str, Any]] = None,
    ) -> Any:
        resp = self._client.request(method, path, json=json)
        if resp.status_code >= 400:
            body = resp.json() if resp.content else {}
            err = body.get("error", {})
            raise GluonAPIError(
                code=err.get("code", "UNKNOWN"),
                message=err.get("message", f"HTTP {resp.status_code}"),
                status=resp.status_code,
            )
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
        json: Optional[Dict[str, Any]] = None,
    ) -> Any:
        resp = await self._client.request(method, path, json=json)
        if resp.status_code >= 400:
            body = resp.json() if resp.content else {}
            err = body.get("error", {})
            raise GluonAPIError(
                code=err.get("code", "UNKNOWN"),
                message=err.get("message", f"HTTP {resp.status_code}"),
                status=resp.status_code,
            )
        return resp.json()
