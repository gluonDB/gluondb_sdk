# @gluondb/mcp

A tiny stdio-to-HTTP bridge for the [GluonDB](https://gluondb.com) MCP server.

One MCP, all your projects, all your databases. Most MCP clients (Cursor, Claude
Code) can talk to the GluonDB HTTP endpoint directly. Clients that only speak
stdio — such as Claude Desktop — use this bridge instead.

## Usage

Create a Personal Access Token under **Settings → API Keys** in GluonDB, then
add the bridge to your client's MCP config:

```json
{
  "mcpServers": {
    "gluondb": {
      "command": "npx",
      "args": ["-y", "@gluondb/mcp"],
      "env": { "GLUONDB_API_KEY": "gluon_your_key_here" }
    }
  }
}
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `GLUONDB_API_KEY` | yes | A `gluon_*` Personal Access Token. |
| `GLUONDB_MCP_URL` | no | Override the endpoint. Defaults to `https://mcp.gluondb.com/mcp`. |
| `DEBUG=gluondb:*` | no | Log bridge activity to stderr. |

## Direct HTTP (no bridge)

If your client supports streamable-HTTP MCP servers, skip the bridge:

```json
{
  "mcpServers": {
    "gluondb": {
      "url": "https://mcp.gluondb.com/mcp",
      "headers": { "Authorization": "Bearer gluon_your_key_here" }
    }
  }
}
```

## License

Apache-2.0
