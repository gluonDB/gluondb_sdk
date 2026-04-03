---
name: gluondb-sdk
description: Use the GluonDB SDK to query datasources, list projects, and build dashboards or applications. Use when building apps that connect to databases via GluonDB, creating dashboards, running SQL queries programmatically, or when the user mentions GluonDB SDK, API key, datasource, or querying data.
---

# GluonDB SDK

GluonDB is a unified data gateway — think PgBouncer, but for all your databases. You connect your Postgres, MySQL, MSSQL, or other datasources once, and GluonDB provides a single authenticated endpoint to query any of them. Connection pooling, auth, and routing are handled for you.

The SDK is the programmatic interface to that gateway. Available in **TypeScript/JavaScript** (`@gluondb/sdk`) and **Python** (`gluondb`).

## Authentication

Every request requires an API key (prefix `gluon_`). Pass it when creating the client. Never hard-code keys; use environment variables.

## SQL dialect

Queries are executed directly on the connected database. The SQL dialect depends on the datasource's `db_type` (e.g. `postgres`, `mysql`, `mssql`). Write queries using the syntax of the target database, not a generic SQL.

## Core concept: bound datasource

The primary API revolves around **bound datasources**. You create a client, get a handle to a specific datasource, then query it:

```
client  ->  datasource handle  ->  .query(sql)
```

No connection management or cleanup needed — it is pure HTTP.

## TypeScript / JavaScript

### Install

```bash
npm install @gluondb/sdk
```

### Quick start

```typescript
import { GluonDB } from "@gluondb/sdk";

const gluon = new GluonDB({ apiKey: process.env.GLUONDB_KEY! });

// Bind to a datasource by ID
const pg = gluon.datasource("ds-uuid");

const result = await pg.query("SELECT * FROM users LIMIT 10");
console.log(result.data.columns); // [{ name, type }, ...]
console.log(result.data.rows);    // [[...], ...]
console.log(result.meta.execution_time_ms);

// Or bind by project + datasource name
const mysql = gluon.datasource({ projectId: "proj-uuid", name: "my-mysql" });
const r2 = await mysql.query("SELECT count(*) FROM orders");
```

### Config

```typescript
interface GluonDBConfig {
  apiKey: string;      // required, "gluon_..." 
  baseUrl?: string;    // default: "https://api.gluondb.com"
  apiVersion?: string; // default: "v1"
}
```

### Types

| Type | Fields |
|------|--------|
| `QueryResponse` | `data: { columns, rows, row_count }`, `meta: { datasource_id, execution_time_ms, api_version }` |
| `Project` | `id`, `name`, `created_at` |
| `Datasource` | `id`, `name`, `db_type`, `created_at` |
| `Column` | `name`, `type` |

### Error handling

```typescript
import { GluonDB, GluonAPIError } from "@gluondb/sdk";

try {
  await pg.query("SELECT 1");
} catch (e) {
  if (e instanceof GluonAPIError) {
    console.error(e.code, e.message, e.status); // "NOT_FOUND", "...", 404
  }
}
```

## Python

### Install

```bash
pip install gluondb
# With pandas support:
pip install gluondb[pandas]
```

### Quick start (sync)

```python
from gluondb import GluonDB

gluon = GluonDB(api_key="gluon_...")

# Bind to a datasource by ID
pg = gluon.datasource("ds-uuid")

result = pg.query("SELECT * FROM users LIMIT 10")
print(result.columns)   # [Column(name=..., type=...), ...]
print(result.rows)      # [[...], ...]
print(result.row_count)

# Convert to pandas DataFrame
df = result.to_dataframe()
print(df.head())

# Or bind by project + datasource name
mysql = gluon.datasource(project_id="proj-uuid", name="my-mysql")
r2 = mysql.query("SELECT count(*) FROM orders")
```

### Quick start (async)

```python
from gluondb import AsyncGluonDB

gluon = AsyncGluonDB(api_key="gluon_...")
pg = gluon.datasource("ds-uuid")
result = await pg.query("SELECT 1")
```

### Constructor

```python
GluonDB(
    api_key: str,           # required
    base_url: str = "https://api.gluondb.com",
    api_version: str = "v1",
    timeout: float = 30.0,
)
```

### Types (dataclasses)

| Type | Fields |
|------|--------|
| `QueryResult` | `columns: list[Column]`, `rows`, `row_count`, `datasource_id`, `execution_time_ms`, `api_version` |
| `Project` | `id`, `name`, `created_at` |
| `Datasource` | `id`, `name`, `db_type`, `created_at` |
| `Column` | `name: str`, `type: str` |

`QueryResult.to_dataframe()` returns a `pandas.DataFrame` (requires `pandas`).

### Error handling

```python
from gluondb import GluonDB, GluonAPIError

try:
    pg.query("SELECT 1")
except GluonAPIError as e:
    print(e.code, e.status, str(e))  # "NOT_FOUND" 404 "..."
```

## Common patterns

### Dashboard: fetch and render multiple queries

```python
queries = {
    "revenue": "SELECT date, sum(amount) FROM orders GROUP BY date",
    "users":   "SELECT count(*) FROM users WHERE created_at > now() - interval '7 days'",
}
gluon = GluonDB(api_key=key)
pg = gluon.datasource(ds_id)
results = {name: pg.query(sql).to_dataframe() for name, sql in queries.items()}
```

### Next.js API route

```typescript
import { GluonDB } from "@gluondb/sdk";
import { NextResponse } from "next/server";

const gluon = new GluonDB({ apiKey: process.env.GLUONDB_KEY! });
const pg = gluon.datasource(process.env.DS_ID!);

export async function GET() {
  const result = await pg.query(
    "SELECT * FROM metrics ORDER BY ts DESC LIMIT 100",
  );
  return NextResponse.json(result.data);
}
```

### Discover datasources dynamically

```typescript
const { data: projects } = await gluon.projects.list();
for (const proj of projects) {
  const { data: sources } = await gluon.datasources.list(proj.id);
  console.log(`${proj.name}: ${sources.map(s => s.name).join(", ")}`);
}
```

## API reference

For full source, see [reference.md](reference.md).
