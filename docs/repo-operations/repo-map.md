# Repo Map

This is a practical plain-English map of the Pantry to Plate repository.

## Top-level areas

### `backend/`
Backend application area.
Expected to contain:
- app code
- backend tests
- scripts
- local runtime artifacts such as `.runtime`
- local virtual environment such as `.venv`

### `frontend/`
Frontend application area.
Expected to contain:
- source UI code
- frontend tests
- local dependency installation in `node_modules`
- generated output such as `dist`
- Playwright outputs such as `playwright-report` and `test-results`

### `docs/`
Documentation area.
Expected to contain:
- product standards
- repo operation docs
- audits
- planning material
- execution notes

### `.git/`
Git metadata. Do not treat as normal project content.

### `.vscode/`
Editor-local settings. Local-only.

### `.codex/`
Local tool state. Local-only.

## Important interpretation rule
Repo folder size is not the same thing as source code size.

A large portion of local repo weight may come from:
- `backend/.venv`
- `frontend/node_modules`
- runtime DBs
- generated output
- test/debug artifacts

## Practical rule
When evaluating repo health, separate:
1. real project assets
2. local environment weight
3. temporary debug or verification clutter
