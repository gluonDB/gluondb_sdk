# GluonDB SDK Release Process

This repository publishes:
- Python package: `gluondb` (PyPI)
- TypeScript package: `@gluondb/sdk` (npm)

## Prerequisites

- GitHub Actions secrets:
  - `PYPI_API_TOKEN`
  - `NPM_TOKEN`
- Version numbers updated in:
  - `python/pyproject.toml`
  - `typescript/package.json`
- Changelog updated in `CHANGELOG.md`.

## Repository packaging policy

- `typescript/dist/` stays committed so users can inspect shipped artifacts.
- CI and release workflows still run `npm run build` to verify output is reproducible.

## Pre-release checklist

1. Update versions in Python and TypeScript manifests.
2. Update `CHANGELOG.md` under the new version heading.
3. Validate locally:
   - `python -m build ./python`
   - `twine check python/dist/*`
   - `npm ci --prefix typescript`
   - `npm run build --prefix typescript`
   - `npm pack --prefix typescript --dry-run`
4. Commit and push to main.
5. Create an annotated tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
6. Push tag: `git push origin vX.Y.Z`.

## Publish flow

- Tag push triggers `.github/workflows/release.yml`.
- Python job builds and uploads to PyPI with `twine`.
- TypeScript job builds and publishes to npm with `npm publish --access public`.

## Post-release verification

1. Confirm the GitHub release workflow succeeded.
2. Verify package pages:
   - PyPI: `https://pypi.org/project/gluondb/`
   - npm: `https://www.npmjs.com/package/@gluondb/sdk`
3. Install both packages in a clean environment and run a smoke query.
