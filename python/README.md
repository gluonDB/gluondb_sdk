# GluonDB Python SDK

Official Python SDK for the GluonDB public API.

## Install

```bash
pip install gluondb
```

## Quick Start

```python
from gluondb import GluonDB

gluon = GluonDB(api_key="gluon_...")
pg = gluon.datasource("your-datasource-id")

result = pg.query("SELECT * FROM users LIMIT 10")
print(result.rows)
```

## Optional pandas integration

```bash
pip install "gluondb[pandas]"
```

## Configuration

- `api_key` (required): GluonDB API key.
- `base_url` (default: `https://api.gluondb.com`): API base URL.
- `api_version` (default: `v1`): API version segment.
- `timeout` (default: `30.0`): HTTP timeout in seconds.

## License

Apache-2.0
