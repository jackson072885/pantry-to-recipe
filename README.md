# Pantry-to-Recipe

Pantry-to-Recipe is a recommendation-centered dinner decision tool built with a FastAPI backend and a Vite/React frontend.

The product answers one high-intent question:

**What can I cook tonight with what I already have?**

This is not a general recipe browser. The core loop is pantry input, recommendation ranking, one obvious best option, and a clear next action.

## First User Flow

1. Open `Tonight`.
2. Add pantry items directly or open `Pantry` for a fuller edit.
3. Generate tonight's recommendations.
4. Review the highlighted best option first.
5. Either cook now or follow the missing-items path.
6. Return later and get better ranking from tracked behavior.

## What The MVP Includes

- pantry management
- grouped recommendations
- one highlighted `best_tonight` option
- recipe detail with pantry-match guidance
- cook action with pantry deduction
- event tracking through `/events`
- behavior-aware recommendation ranking

## Core Routes

Frontend:
- `/`
- `/pantry`
- `/recommendations`
- `/results`
- `/recipes/:id`

Backend:
- `GET /`
- `GET /health`
- `GET /pantry`
- `POST /pantry/add`
- `POST /pantry/remove`
- `GET /recommendations?pantry=item&pantry=item`
- `GET|POST /match` and `GET|POST /match/v2` now return an explicit deprecation response pointing callers to `/recommendations`
- `GET /recipes`
- `GET /recipes/{id}`
- `POST /cook/{id}`
- `POST /events`

## Intentionally Non-Core

The repo also contains provider, onboarding, supply, unlock, and AI-adjacent surfaces. They remain in the codebase, but they are not part of the first-user-ready product path and are not mounted in the main app shell.

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
- the local SQLite database defaults to `%USERPROFILE%\.pantry-to-recipe\pantry.db`
- if `backend\pantry.db` exists and the home-directory DB does not, the app copies the legacy DB forward on first run

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

Frontend:
```powershell
cd frontend
npm test -- --run
npm run build
```

## First User Demo Script

1. Open `http://127.0.0.1:5173`.
2. On `Tonight`, paste pantry items such as `chicken, rice, onion, soy sauce`.
3. Click `See Tonight's Best Options`.
4. Review the highlighted best dinner option.
5. Click `Cook This Tonight` if it is ready now, or `Get Missing Ingredients` if it needs a quick store stop.
6. On the recipe page, confirm pantry match, follow the missing-items helper if needed, or use `Cook This Recipe` to complete the loop.

## Repo Reminder

If docs and runtime ever disagree, trust the mounted frontend routes in `frontend/src/App.tsx` and the backend routes and services in `backend/app/routes` and `backend/app/services`.
