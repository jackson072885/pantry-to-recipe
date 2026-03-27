# Backend Architecture

## Source Of Truth
Pantry inventory is the source of truth for recommendations and cooking.

Current core routes:
- `/pantry`
- `/recommendations`
- `/recipes`
- `/cook`
- `/events`
- `/health`

Secondary non-core routes remain in the codebase under:
- `/insights`
- `/plan`
- `/supply`
- `/unlock`
- `/ai/recipe`

## Core Runtime Behavior
- Recommendation ranking combines pantry coverage, missing-count pressure, time, simplicity, and stored user-action signals.
- Cooking a recipe verifies sufficiency, deducts inventory atomically, and blocks negative inventory.
- Frontend analytics events are accepted through `/events` and persisted as `user_actions`.
- Request logging is focused on the primary product paths: `/recommendations`, `/pantry`, `/recipes`, `/cook`, and `/events`.

## Database Behavior
- SQLite is the local development database.
- The default path is a guaranteed user-writable home directory location.
- On first run, a legacy `backend/pantry.db` is copied into the user-writable location if present.

## Canonical Units
All quantities are normalized for comparison:
- Volume -> milliliters (`ml`)
- Weight -> grams (`g`)
- Count -> each (`ea`)

## Test Expectations
The stabilization baseline is:
- backend route tests pass
- frontend tests pass
- frontend build passes

Do not remove or weaken tests just to force green. Update tests only when the current product wording or markup has intentionally changed.
