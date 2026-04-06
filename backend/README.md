Backend for Pantry-to-Recipe.

## What This Backend Actually Serves

The backend powers a recommendation-centered dinner flow:

- pantry state
- recommendation lookup
- best-option selection
- recipe detail retrieval
- cook execution with pantry deduction
- event tracking used for behavior-aware ranking

## Primary Routes

Canonical live paths:
- `GET /`
- `GET /pantry`
- `POST /pantry/add`
- `POST /pantry/remove`
- `POST /pantry/clear`
- `GET /recommendations`
- `GET /recipes`
- `GET /recipes/{id}`
- `POST /cook/{id}`
- `POST /events`
- `GET /health`

Compatibility note:
- the same mounted route set is also exposed under `/api/*` for deployments that hit FastAPI directly instead of going through Vite's local rewrite behavior

## Response Contract

Core routes return the standard API envelope:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

The frontend unwraps this envelope and treats `error.code` plus `error.message` as the failure contract.

## Recommendation And Tracking Loop

- `/recommendations` groups dinner options into `cook_now`, `almost_there`, and `not_worth_it`
- the response also includes `best_tonight` and `alternatives`
- `/events` stores tracked user actions
- the recommendation service reads those stored actions and boosts recipes or ingredient patterns the user has engaged with before

## Parked Surfaces

These route modules stay on disk but are intentionally not registered in the live API router:

- `/match`
- `/density`
- `/insights`
- `/plan`
- `/unlock`
- `/onboarding`
- `/ai/recipe`
- `/supply`

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
.\run-backend.ps1
```

This starts FastAPI on `http://127.0.0.1:8000`.

## Test

```powershell
python -m pytest -q app/tests
```

The default test run excludes tests marked `parked` so the suite reflects only the shipped backend surface.

To verify intentionally disconnected routes still remain outside the live API surface:

```powershell
python -m pytest -q app/tests -m parked
```

## Database Notes

- The default SQLite database path is repo-local: `backend/.runtime/pantry.db`.
- Schema creation runs on startup.
- Startup also seeds curated runtime data from `backend/app/data/recipes_real_v1.json`.
- Startup validates and converges dataset-managed recipe rows on every run.
- `backend/pantry.db` is a legacy snapshot path and is rejected by default unless `ALLOW_LEGACY_DATABASE_PATH=true` is set explicitly.
- To rebuild the default local DB from committed source data, run `.\reset-local-db.ps1`.

See `../docs/runtime-bootstrap.md` for the canonical truth path and reset flow.
