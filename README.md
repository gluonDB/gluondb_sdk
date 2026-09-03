# GluonDB SDKs

Official client libraries for the [GluonDB](https://gluondb.com) public API.

GluonDB is a unified data gateway -- connect your Postgres, MySQL, MSSQL, or other databases once, then query any of them through a single authenticated endpoint. The SDKs are the programmatic interface to that gateway.

## Available SDKs

| Language | Package | Install |
|----------|---------|---------|
| TypeScript / JavaScript | `@gluondb/sdk` | `npm install @gluondb/sdk` |
| Python | `gluondb` | `pip install gluondb` |

Package-specific docs:
- TypeScript: [`typescript/README.md`](typescript/README.md)
- Python: [`python/README.md`](python/README.md)
- Release guide: [`RELEASE.md`](RELEASE.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)

## Quick Start

### TypeScript

```typescript
import { GluonDB } from "@gluondb/sdk";

const gluon = new GluonDB({ apiKey: process.env.GLUONDB_KEY! });

// Bind to a datasource, then query it
const pg = gluon.datasource("your-datasource-id");

const result = await pg.query("SELECT * FROM users LIMIT 10");
console.log(result.data.columns); // [{ name: 'id', type: 'int4' }, ...]
console.log(result.data.rows);    // [[1, 'alice'], [2, 'bob']]

// Or bind by project + datasource name
const mysql = gluon.datasource({ projectId: "proj-uuid", name: "my-mysql" });
const r2 = await mysql.query("SELECT count(*) FROM orders");
```

### Python

```python
from gluondb import GluonDB

gluon = GluonDB(api_key="gluon_...")

# Bind to a datasource, then query it
pg = gluon.datasource("your-datasource-id")

result = pg.query("SELECT * FROM users LIMIT 10")
for row in result.rows:
    print(row)

# Convert to pandas DataFrame
df = result.to_dataframe()

# Or bind by project + datasource name
mysql = gluon.datasource(project_id="proj-uuid", name="my-mysql")
r2 = mysql.query("SELECT count(*) FROM orders")
```

## Authentication

1. Sign in to [GluonDB](https://gluondb.com)
2. Go to **API Keys** in the left menu
3. Create a new API key
4. Pass the key when creating the client

## API Reference

Both SDKs provide the same capabilities:

- **`datasource(id)`** -- Bind to a datasource by ID (or by project + name), then call `.query(sql)` on the returned handle
- **`projects.list()`** -- List your projects
- **`datasources.list(projectId)`** -- List datasources in a project
- **`dashboards.create(...)` / `dashboards.getDraft(...)`** -- Incrementally
  author typed Dashboard v2 documents and operations, preview, publish, and
  share them using optimistic concurrency

The SQL dialect depends on the connected database (Postgres, MySQL, MSSQL, etc.). Write queries using the syntax of the target database.

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `apiKey` | (required) | Your GluonDB API key (`gluon_...`) |
| `baseUrl` | `https://api.gluondb.com` | API base URL |
| `apiVersion` | `v1` | API version |

For smoke tests against a non-production environment, override `baseUrl` with `GLUONDB_BASE_URL`.

Dashboard authoring examples are in `examples/dashboard-typescript.mjs` and
`examples/dashboard-python.py`. They require an explicit base URL, API key,
project ID, and datasource ID so they cannot accidentally publish to the wrong
environment.

## License

Apache-2.0
