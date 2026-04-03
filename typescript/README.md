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

## License

Apache-2.0
