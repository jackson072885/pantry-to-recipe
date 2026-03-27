# Pantry-to-Recipe

Pantry-to-Recipe is a recommendation-centered cooking app with a FastAPI backend and a Vite/React frontend.

## Core Product Flow
- Add or update pantry inventory.
- Generate recommendation groups from the current pantry.
- Surface a single "Cook This Tonight" CTA for the best next action.
- Open a recipe detail page, review missing items, and cook.
- Track recommendation, CTA, ingredient-request, and cook events.

Primary frontend routes:
- `/` - tonight landing page with the checklist and recommendation launcher
- `/pantry` - pantry inventory management
- `/recommendations` - grouped recommendation results
- `/recipes/:id` - recipe detail, missing-item handling, and cook action

Primary backend routes:
- `GET /pantry`, `POST /pantry/add`, `POST /pantry/remove`
- `GET /recommendations`
- `GET /recipes/{id}`
- `POST /cook/{id}`
- `POST /events`
- `GET /health`

## Core Product Behaviors To Preserve
- Recommendation ranking is pantry-aware and behavior-aware.
- "Cook This Tonight" resolves either to the recipe detail page or an outbound shopping link when ingredients are missing.
- Frontend tracking writes user actions through `/events`.
- Cooking a recipe deducts inventory atomically.
- The default SQLite database lives in a user-writable home directory path.

## Secondary Surfaces
The repo also contains provider-oriented routes and UI experiments around:
- `/insights`
- `/plan`
- `/supply`
- `/unlock`
- `frontend/src/pages/Provider.tsx`
- `frontend/src/pages/ProviderOnboarding.tsx`
- `frontend/src/pages/ChefAssist.tsx`

These are real, tested surfaces, but they are not part of the main app shell or the primary demo path.

## Local Development

### Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m pytest -q app/tests
.\run-backend.ps1
```

The backend defaults the database to:
- Windows: `%USERPROFILE%\.pantry-to-recipe\pantry.db`

If an older `backend/pantry.db` exists, the app copies it into the user-writable location on first run.

### Frontend
```powershell
cd frontend
npm install
npm test -- --run
npm run build
npm run dev
```

The frontend dev server proxies API calls to `http://127.0.0.1:8000`.

## Repo Reality
- The recommendation-centered flow is the current source of truth.
- Older `/match` and broader `/search` documentation is historical and should not be treated as the current product narrative.
- Before checkpointing, verify backend tests, frontend tests, and the frontend build from the current worktree.
