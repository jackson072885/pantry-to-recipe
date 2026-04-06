# Pantry-to-Recipe

Pantry-to-Recipe is a recommendation-centered dinner decision tool built with a FastAPI backend and a Vite/React frontend.

The product answers one high-intent question:

**What can I cook tonight with what I already have?**

This is not a general recipe browser. The core loop is pantry input, recommendation ranking, one obvious best option, and a clear next action.

## Core Flow

1. Open `Tonight`.
2. Add or update ingredients on `Pantry`.
3. Return to `Tonight` to see the best dinner option first.
4. Open `Recommendations` if you want grouped backup options.
5. Open a recipe and cook it.

## Live Product Surfaces

- `Tonight` for the best current dinner pick
- `Pantry` for ingredient editing and pantry clear
- `Recommendations` for grouped backups and refresh
- `Recipe Detail` for pantry-aware instructions and cook action
- the backend APIs required for pantry, recommendations, recipe detail, cook, health, and event tracking

## Core Routes

Frontend:
- `/`
- `/pantry`
- `/recommendations`
- `/recipes/:id`

Backend:
- `GET /`
- `GET /health`
- `GET /pantry`
- `POST /pantry/add`
- `POST /pantry/remove`
- `POST /pantry/clear`
- `GET /recommendations?pantry=item&pantry=item`
- `GET /recipes`
- `GET /recipes/{id}`
- `POST /cook/{id}`
- `POST /events`

The backend also supports `/api/*` mirrors for those same mounted routes when clients hit FastAPI directly outside local Vite rewrites.

## Parked Non-Core Surfaces

These surfaces remain in the repository for reference and possible future evaluation, but they are intentionally disconnected from the live API router and should not be treated as current product priorities:

- `/match`
- `/search/density`
- `/insights`
- `/plan`
- `/unlock`
- `/onboarding`
- `/ai/recipe`
- `/supply`

Parked code exists to preserve useful experiments and internal references. If docs and code disagree about whether a surface is live, trust the mounted frontend routes in `frontend/src/App.tsx` and the routers included in `backend/app/api/router.py`.

## Run Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\run-backend.ps1
```

Backend URL: `http://127.0.0.1:8000`

Notes:
- the local SQLite database defaults to `backend\.runtime\pantry.db`
- backend startup creates schema and reseeds curated runtime data from `backend\app\data\recipes_real_v1.json`
- `backend\pantry.db` is treated as a legacy snapshot and is no longer copied forward on startup
- `backend\reset-local-db.ps1` rebuilds the default local DB from committed source data

## Run Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL: `http://127.0.0.1:5173`

## Validation

Backend:
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q app/tests
```

That default backend run intentionally excludes tests marked `parked`, so it reflects only the mounted product surface. To verify intentionally parked routes separately:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q app/tests -m parked
```

Frontend:
```powershell
cd frontend
npm test -- --run
npm run build
```

## Demo Script

1. Open `http://127.0.0.1:5173`.
2. Add pantry items such as `chicken`, `rice`, `onion`, and `soy sauce` on `Pantry`.
3. Return to `Tonight` and review the highlighted best dinner option.
4. Open `Recommendations` if you want backup picks from the same pantry snapshot.
5. On the recipe page, confirm pantry match and use `Cook This Recipe` to complete the loop.

## Repo Reminder

If docs and runtime ever disagree, trust the mounted frontend routes in `frontend/src/App.tsx` and the backend routes and services in `backend/app/routes` and `backend/app/services`.
