# Backend Architecture

## Product Role

The backend is the decision engine behind the dinner flow:

1. read pantry state
2. generate ranked recommendations
3. return one best option plus grouped alternatives
4. accept tracked user actions
5. use those actions to improve future ranking
6. execute the cook action and deduct inventory

This backend is not a generic recipe browser. The recommendation loop is the primary product behavior.

## Route Inventory

### Core Routes

- `GET /pantry`
- `POST /pantry/add`
- `POST /pantry/remove`
- `GET /recommendations`
- `GET /recipes`
- `GET /recipes/{recipe_id}`
- `POST /cook/{recipe_id}`
- `POST /events`
- `GET /health`
- `GET /`

### Parked Route Modules Still Present

These route modules remain on disk for reference, but they are intentionally not mounted in `backend/app/api/router.py` and are not part of the shipped product identity:

- `/match`
- `/search/density`
- `/insights`
- `/plan`
- `/supply`
- `/unlock`
- `/onboarding`
- `/ai/recipe`

## Dependency Pattern

Route handlers use the SQLAlchemy session dependency pattern via `get_db` from `backend/app/db.py`.

- Each request gets a session from `get_db`.
- Route helpers call `route_response(...)` to standardize success and error envelopes.
- Failed actions roll back when a session is supplied.

## Standard Response Envelope

Every core route returns:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Or, on failure:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Recipe not found"
  }
}
```

## Core Route Behavior

### `/pantry`

- `GET /pantry` returns `data.items`
- `POST /pantry/add` validates `name`, `amount`, and optional `unit`, applies the mutation, then returns the updated pantry list
- `POST /pantry/remove` applies the reverse mutation and returns the updated pantry list

Pantry state is the input to both recommendation lookup and cook validation.

### `/recommendations`

`GET /recommendations?pantry=item&pantry=item`

Behavior:

- requires at least one non-empty pantry item
- normalizes pantry terms
- checks required ingredient sufficiency against pantry quantities
- groups recipes into `cook_now`, `almost_there`, and `not_worth_it`
- returns `best_tonight`, `alternatives`, and the three grouped buckets

Each recommendation entry contains:

- `recipe`
- `explanation`
- optional `tonight_score` for ranked entries like `best_tonight`

Each `recipe` object contains:

- `recipe_id`
- `recipe_name`
- `pantry_coverage_pct`
- `missing_count`
- `missing_ingredients`
- `estimated_time_minutes`
- `simplicity`

### `/recipes`

- `GET /recipes` returns a lightweight list of active recipes
- `GET /recipes/{id}` returns full detail for the selected recipe, including instructions and ingredient requirements

### `/cook/{id}`

The cook endpoint is the execution step in the core loop.

It:

- verifies the recipe exists
- checks required ingredient quantities against pantry quantities
- blocks insufficient pantry states with `INSUFFICIENT_PANTRY`
- deducts inventory atomically on success

### `/events`

`POST /events` records frontend behavior as `user_actions`.

Accepted tracked events:

- `recipe_selected`
- `cook_clicked`
- `ingredients_requested`
- `recipe_cooked_confirmed`
- `cta_rendered`
- `cta_clicked`
- `outbound_link_opened`

The endpoint returns an accepted event payload with:

- `action_id`
- `event_id`
- `event`
- `recipe_id`
- `recorded_at`
- `accepted`

## Recommendation Engine Basics

The ranking system is pantry-aware first, then behavior-aware.

Base decision factors:

- pantry coverage percentage
- missing required ingredient count
- estimated total time
- simplicity score

Behavior factors:

- direct recipe affinity from stored user actions
- ingredient-pattern affinity from actions on recipes sharing required ingredients

Behavior is loaded from `user_actions` and contributes bounded score boosts during recommendation sorting.

## Tracking Purpose

Tracking is part of product behavior, not analytics-only decoration.

It exists to:

- measure CTA usage
- capture when a recipe looked promising
- capture when missing ingredients forced an external action
- capture confirmed cooks
- feed those signals back into future recommendation ranking

## Database Behavior

- SQLite is the local development database.
- The default path is `backend/.runtime/pantry.db`.
- Startup creates schema and reseeds the runtime DB from `backend/app/data/recipes_real_v1.json`.
- `backend/pantry.db` remains a legacy snapshot and is not copied on startup.
- `backend/reset-local-db.ps1` deletes and rebuilds the default runtime DB from committed source data.

## Logging

Focused request logging is enabled for the primary product paths:

- `/recommendations`
- `/pantry`
- `/recipes`
- `/cook`
- `/events`

## Verification Baseline

```powershell
cd backend
python -m pytest -q app/tests
```

```powershell
cd frontend
npm test -- --run
npm run build
```
