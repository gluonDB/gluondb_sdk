# GluonDB SDK — API Reference

## Public API endpoints (v1)

All endpoints require `X-API-Key` header.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/projects` | List all projects for the API key owner |
| `GET` | `/v1/projects/:projectId/datasources` | List datasources in a project |
| `POST` | `/v1/query` | Execute SQL against a datasource |

### POST /v1/query — request body

```json
// Option A: by datasource ID
{ "datasource_id": "uuid", "query": "SELECT ..." }

// Option B: by project + datasource name
{ "project_id": "uuid", "datasource_name": "my-pg", "query": "SELECT ..." }
```

### POST /v1/query — response

```json
{
  "data": {
    "columns": [{ "name": "id", "type": "int4" }, { "name": "email", "type": "text" }],
    "rows": [[1, "alice@example.com"], [2, "bob@example.com"]],
    "row_count": 2
  },
  "meta": {
    "api_version": "v1",
    "datasource_id": "uuid",
    "execution_time_ms": 42
  }
}
```

### GET /v1/projects — response

```json
{
  "data": [
    { "id": "uuid", "name": "My Project", "created_at": "2025-..." }
  ],
  "meta": { "api_version": "v1" }
}
```

### GET /v1/projects/:id/datasources — response

```json
{
  "data": [
    { "id": "uuid", "name": "prod-pg", "db_type": "postgres", "created_at": "2025-..." }
  ],
  "meta": { "api_version": "v1" }
}
```

### Error response

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or revoked API key"
  }
}
```

Error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED`, `INTERNAL_ERROR`.

## TypeScript SDK — full type definitions

```typescript
interface GluonDBConfig {
  apiKey: string;
  baseUrl?: string;    // default "https://api.gluondb.com"
  apiVersion?: string; // default "v1"
}

interface Column { name: string; type: string; }
interface QueryData { columns: Column[]; rows: any[][]; row_count: number; }
interface QueryMeta { api_version: string; datasource_id: string; execution_time_ms: number; }
type QueryResponse = { data: QueryData; meta: QueryMeta; }

interface DatasourceByName { projectId: string; name: string; }
type DatasourceRef = string | DatasourceByName;

interface Project { id: string; name: string; created_at: string; }
interface Datasource { id: string; name: string; db_type: string; created_at: string; }

interface ApiResponse<T> { data: T; meta: { api_version: string; } }

class GluonAPIError extends Error {
  code: string;
  status: number;
}
```

### Methods

```typescript
class GluonDB {
  constructor(config: GluonDBConfig);
  datasource(ref: DatasourceRef): BoundDatasource;
  projects: { list(): Promise<ApiResponse<Project[]>> };
  datasources: { list(projectId: string): Promise<ApiResponse<Datasource[]>> };
}

class BoundDatasource {
  query(sql: string): Promise<QueryResponse>;
}
```

## Python SDK — full type definitions

```python
@dataclass
class Column:
    name: str
    type: str

@dataclass
class QueryResult:
    columns: list[Column]
    rows: list[list[Any]]
    row_count: int
    datasource_id: str
    execution_time_ms: int
    api_version: str

    def to_dataframe(self) -> pd.DataFrame: ...

@dataclass
class Project:
    id: str
    name: str
    created_at: str

@dataclass
class Datasource:
    id: str
    name: str
    db_type: str
    created_at: str
```

### Methods

```python
class GluonDB:
    def __init__(self, api_key, *, base_url=..., api_version=..., timeout=30.0): ...
    def datasource(self, id=None, *, project_id=None, name=None) -> BoundDatasource: ...

    projects: ProjectsResource   # .list() -> list[Project]
    datasources: DatasourcesResource  # .list(project_id) -> list[Datasource]

class BoundDatasource:
    def query(self, sql: str) -> QueryResult: ...

class AsyncGluonDB:
    def datasource(self, id=None, *, project_id=None, name=None) -> AsyncBoundDatasource: ...
    # projects, datasources same as sync

class AsyncBoundDatasource:
    async def query(self, sql: str) -> QueryResult: ...
```
