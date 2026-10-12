# GluonDB TypeScript SDK

Official TypeScript/JavaScript SDK for the GluonDB public API.

## Install

```bash
npm install @gluondb/sdk
```

## Quick Start

```typescript
import { GluonDB } from "@gluondb/sdk";

const gluon = new GluonDB({ apiKey: process.env.GLUONDB_KEY! });
const pg = gluon.datasource("your-datasource-id");

const result = await pg.query("SELECT * FROM users LIMIT 10");
console.log(result.data.rows);
```

## Runtime

- Node.js `>=18` is required.
- For non-Node runtimes, provide a compatible `fetch` implementation.

## Configuration

- `apiKey` (required): GluonDB API key.
- `baseUrl` (default: `https://api.gluondb.com`): API base URL.
- `apiVersion` (default: `v1`): API version segment.

## Dashboard authoring

Give the API key **Dashboard drafter** permissions in GluonDB and explicitly
select its dashboard projects and datasource/schema access. Selected projects
permit reading saved SQL and text. Query execution remains separately scoped;
removing query capability also disables previews. API keys cannot publish,
share, archive, restore or delete dashboards: open `dashboard.editorUrl` to
review and publish as a signed-in user.

```typescript
const dashboard = await gluon.dashboards.create({
  projectId,
  name: "Revenue",
});

await dashboard.operations.put("revenue_by_day", {
  datasource_id: datasourceId,
  sql: "SELECT order_date AS day, SUM(total) AS revenue FROM orders GROUP BY 1",
  parameters: {},
  result_schema: {
    columns: [
      { name: "day", type: "date" },
      { name: "revenue", type: "numeric" },
    ],
  },
});
await dashboard.blocks.add({
  id: "revenue",
  type: "line_chart",
  operation: "revenue_by_day",
  position: { x: 0, y: 0, w: 8, h: 5 },
  mapping: { x: "day", y: ["revenue"] },
});
console.log("Open draft in GluonDB:", dashboard.editorUrl);
```

`gluon.dashboards.list(projectId?)` returns the dashboards the key can reach,
and `gluon.dashboards.getDraft(id)` reopens one.

The handle sends its current draft hash (`If-Match`) and draft version
(`If-Draft-Version`) with every mutation and updates both only after success.
Every document or operation edit advances the version. On a 412,
`DashboardConflictError` carries `currentHash` or `currentDraftVersion`; the SDK
does not retry or overwrite concurrent edits. Call `dashboard.refresh()` and
explicitly rebase your intended change. Saving an operation neither executes
its SQL nor certifies access.

Document and operation types are generated from the canonical server JSON
Schemas. Runtime validation and authorization remain server-owned.

## License

Apache-2.0
