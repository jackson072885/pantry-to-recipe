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

- `GET /pantry`
- `POST /pantry/add`
- `POST /pantry/remove`
- `GET /recommendations`
- `GET /recipes`
- `GET /recipes/{id}`
- `POST /cook/{id}`
- `POST /events`
- `GET /health`

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

## Database Notes

- The default SQLite database path is user-writable.
- On Windows the default path is `%USERPROFILE%\.pantry-to-recipe\pantry.db`.
- Schema creation runs on startup.
- Seed logic is also invoked on startup when available.

## Secondary Surfaces

Provider-oriented and experimental routes still exist in the backend, including `/insights`, `/plan`, `/supply`, `/unlock`, `/onboarding`, `/ai/recipe`, and `/search/density`.

They are real code, but they are not the main product flow.
