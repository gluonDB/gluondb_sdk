# Dashboard v1 contract snapshot

These schemas and fixtures are exact snapshots of the canonical artifacts in
`gluonDB/gluondb_front/public-api/src/dashboard-contract`. The SDK generates
language models from them; it does not maintain a second dashboard schema or
perform the server's cross-field validation.

`contract.lock.json` records the source revision and content checksums. Refresh
the snapshot from the `gluondb_front` staging worktree, update the lock, then
run the TypeScript and Python generation checks before merging either side of a
contract change.
