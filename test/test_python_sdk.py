"""Smoke tests for the GluonDB Python SDK against the live public API."""

import os
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))

from gluondb import GluonDB, AsyncGluonDB, GluonAPIError

API_KEY = os.environ["GLUONDB_KEY"]
BASE_URL = os.environ.get(
    "GLUONDB_BASE_URL", "https://api.gluondb.com"
)


def test_sync_list_projects():
    gluon = GluonDB(api_key=API_KEY, base_url=BASE_URL)
    projects = gluon.projects.list()
    print(f"  Projects ({len(projects)}):")
    assert len(projects) >= 1, "Expected at least 1 project"
    for p in projects:
        print(f"    - {p.name} ({p.id})")
    return projects[0].id


def test_sync_list_datasources(project_id: str):
    gluon = GluonDB(api_key=API_KEY, base_url=BASE_URL)
    datasources = gluon.datasources.list(project_id)
    print(f"  Datasources ({len(datasources)}):")
    for ds in datasources:
        print(f"    - {ds.name} [{ds.db_type}] ({ds.id})")
    return datasources


def test_sync_query(ds_id: str):
    gluon = GluonDB(api_key=API_KEY, base_url=BASE_URL)
    pg = gluon.datasource(ds_id)
    result = pg.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5"
    )
    print(f"  Columns: {[c.name for c in result.columns]}")
    print(f"  Rows: {result.rows[:3]}")
    print(f"  row_count={result.row_count}, exec_ms={result.execution_time_ms}")
    assert result.row_count >= 0

    df = result.to_dataframe()
    print(f"  to_dataframe() shape: {df.shape}")


def test_sync_bad_key():
    gluon = GluonDB(api_key="gluon_invalid_key_000000000000000000", base_url=BASE_URL)
    try:
        gluon.projects.list()
        assert False, "Should have raised GluonAPIError"
    except GluonAPIError as e:
        print(f"  Correctly rejected: status={e.status}, code={e.code}")
        assert e.status == 401


async def test_async_query(ds_id: str):
    gluon = AsyncGluonDB(api_key=API_KEY, base_url=BASE_URL)
    pg = gluon.datasource(ds_id)
    result = await pg.query("SELECT 1 AS n")
    print(f"  Async query result: {result.rows}")
    assert result.row_count >= 1


def main():
    print("=" * 60)
    print("GluonDB Python SDK - Smoke Tests (bound datasource API)")
    print(f"  Base URL: {BASE_URL}")
    print(f"  API Key:  {API_KEY[:14]}...")
    print("=" * 60)

    print("\n[1] Sync - list projects")
    project_id = test_sync_list_projects()
    print("  PASSED\n")

    print("[2] Sync - list datasources")
    datasources = test_sync_list_datasources(project_id)
    print("  PASSED\n")

    ds_id = datasources[0].id if datasources else None

    if ds_id:
        print("[3] Sync - bound datasource query + to_dataframe()")
        test_sync_query(ds_id)
        print("  PASSED\n")

        print("[4] Async - bound datasource query")
        import asyncio
        asyncio.run(test_async_query(ds_id))
        print("  PASSED\n")
    else:
        print("[3] SKIPPED - no datasources\n")
        print("[4] SKIPPED - no datasources\n")

    print("[5] Sync - bad API key rejection")
    test_sync_bad_key()
    print("  PASSED\n")

    print("=" * 60)
    print("All tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
