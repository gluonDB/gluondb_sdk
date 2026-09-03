# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added
- Typed TypeScript and synchronous/asynchronous Python Dashboard v2 builders.
- Generated dashboard document and operation models sourced from the canonical
  GluonDB JSON Schema artifacts.
- Typed draft-conflict and published-revision-changed errors.
- Representative staging examples for building and publishing a dashboard.

### Changed
- HTTP clients now preserve structured error details, accept conditional
  request headers, and support successful empty responses.

## [0.1.0] - 2026-04-03

### Added
- Package-specific README files for Python and TypeScript SDKs.
- Apache-2.0 license files for root, Python package, and TypeScript package.
- `py.typed` marker for Python typing support.
- GitHub Actions CI and release workflows for npm and PyPI publishing.
- Release process documentation in `RELEASE.md`.

### Changed
- SDK metadata updated for Apache-2.0 licensing.
- TypeScript publish configuration updated for public scoped publishing.
- Smoke-test default API endpoint normalized to `https://api.gluondb.com`.
- Repository `.gitignore` hardened for SDK project hygiene.
