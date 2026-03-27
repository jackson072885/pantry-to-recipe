# Pantry-to-Recipe

Pantry-to-Recipe is a recommendation-centered dinner decision engine built with a FastAPI backend and a Vite/React frontend. The product is designed to answer one practical question: given what is already in the pantry, what is the best dinner option tonight?

The core loop is not recipe browsing. It is pantry input, recommendation generation, selection of the best next action, execution through a "Cook This Tonight" CTA, tracking of what the user actually does, and better ranking the next time recommendations are generated.

## Final Product Description

Pantry-to-Recipe turns pantry state into a ranked dinner decision, surfaces one best option, tracks whether the user cooked or needed missing items, and uses that behavior to improve future recommendation order.

## Core Product Flow

1. Add pantry items on the home page or pantry page.
2. Request recommendations from the current pantry.
3. Review grouped results plus one highlighted `best_tonight` option.
4. Use `Cook This Tonight`.
5. Either open the recipe detail page or follow an outbound shopping link when required items are missing.
6. Send tracking events through `/events`.
7. Re-rank future recommendations using pantry coverage plus behavior signals.

## What The App Actually Does

- Groups recommendations into `cook_now`, `almost_there`, and `not_worth_it`.
- Highlights a single `best_tonight` recipe and up to three `alternatives`.
- Uses a money-path CTA that either links to `/recipes/:id` when the recipe is viable now or opens an outbound retailer search when missing items make shopping the next action.
- Tracks CTA renders, CTA clicks, recipe selections, missing-ingredient requests, outbound-link opens, and successful cooks through `/events`.
- Uses stored behavior to influence future ranking, not just current pantry coverage.
- Deducts pantry inventory when a recipe is cooked successfully.

## Key Features

- Recommendation grouping based on pantry coverage and missing required ingredients.
- Best-option highlight for the fastest dinner decision.
- `Cook This Tonight` CTA with internal-or-external destination logic.
- Event tracking for the recommendation-to-action path.
- Behavior-aware ranking that boosts recipes and ingredient patterns the user engages with.
- Standard API response envelope across core endpoints.

## API Shape

The backend returns a standard envelope:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Errors use the same envelope with `success: false` and an `error` object:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "BAD_REQUEST",
    "message": "At least one pantry item is required"
  }
}
```

The frontend unwraps this envelope in `frontend/src/lib/apiClient.ts` and talks to the backend through the `/api` Vite proxy during local development.

## Core Backend Endpoints

- `GET /pantry`
  Returns the current pantry list as `data.items`.
- `POST /pantry/add`
  Adds an item, then returns the updated pantry list.
- `POST /pantry/remove`
  Removes quantity from an item, then returns the updated pantry list.
- `GET /recommendations?pantry=item&pantry=item`
  Returns `best_tonight`, `alternatives`, `cook_now`, `almost_there`, and `not_worth_it`.
- `GET /recipes`
  Returns a lightweight recipe list.
- `GET /recipes/{id}`
  Returns recipe metadata, instructions, and ingredient requirements.
- `POST /cook/{id}`
  Attempts the cook action, validates pantry sufficiency, and deducts inventory on success.
- `POST /events`
  Records tracked frontend actions used for behavior-aware ranking.
- `GET /health`
  Health check.
- `GET /`
  Returns `{ "status": "running" }` inside the standard envelope.

## Tracking And Improvement Loop

The current tracked event set is:

- `recipe_selected`
- `cook_clicked`
- `ingredients_requested`
- `recipe_cooked_confirmed`
- `cta_rendered`
- `cta_clicked`
- `outbound_link_opened`

These events are persisted as `user_actions`. The recommendation service reads those actions and applies weighted boosts at two levels:

- direct recipe affinity
- ingredient-pattern affinity

That means the next recommendation run is influenced by both:

- what is in the pantry now
- what the user has shown interest in before

## Local Development

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\run-backend.ps1
```

Notes:

- The FastAPI app runs at `http://127.0.0.1:8000`.
- Schema creation runs on startup.
- Seed logic is invoked on startup when available.
- The default SQLite database is stored in a user-writable home directory.
- Windows default path: `%USERPROFILE%\.pantry-to-recipe\pantry.db`
- If `backend/pantry.db` exists and the home-directory DB does not, the app copies the legacy DB on first run.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend dev server runs at `http://127.0.0.1:5173`.

API requests are sent to `/api/*` in the frontend and proxied by Vite to `http://127.0.0.1:8000`.

## Validation Commands

Run these before treating documentation or UI wording changes as complete:

```powershell
cd backend
python -m pytest -q app/tests
```

```powershell
cd frontend
npm test -- --run
npm run build
```

## Frontend Shell

The mounted app shell is intentionally small:

- `/` -> home page with pantry input, checklist, recommendation trigger, and best-option summary
- `/pantry` -> pantry management
- `/recommendations` -> grouped recommendation results from current pantry
- `/results` -> alias to the recommendations page
- `/recipes/:id` -> recipe detail, pantry status, missing-item helpers, and cook action

## Repo Structure

```text
pantry-to-recipe/
├─ backend/
│  ├─ app/
│  │  ├─ routes/          # FastAPI routes
│  │  ├─ services/        # ranking, cook, pantry, tracking logic
│  │  ├─ schemas/         # request/response models
│  │  └─ tests/           # backend route and service tests
│  ├─ run-backend.ps1
│  └─ README.md
├─ frontend/
│  ├─ src/
│  │  ├─ pages/           # mounted pages plus non-core pages kept in repo
│  │  ├─ components/      # RecommendationGroups and supporting UI
│  │  └─ lib/             # API client, tracking, CTA link helpers
│  └─ README.md
├─ docs/
└─ README.md
```

## Core Vs Non-Core

### Core Product Flow

These are the primary product surfaces and the current source of truth:

- pantry management
- recommendations
- best option highlight
- `Cook This Tonight`
- recipe detail
- cook action
- event tracking
- behavior-based ranking

### Non-Core / Experimental Surfaces

These exist in the repo but are not the primary product flow:

- provider pages
- insights
- plan
- supply
- unlock
- onboarding/provider experiments
- AI/provider support routes

In practice that means:

- backend provider-oriented routes still exist and are test-covered
- several frontend provider pages still exist in `frontend/src/pages`
- those pages are not mounted in `frontend/src/App.tsx`
- they should not be used to explain the product to a new developer unless the task is specifically about those surfaces

## What Was Incorrect Before

The main docs were closer to the real product than older branches, but repo-wide documentation still had gaps:

- stale planning docs still referenced older pre-recommendations endpoint designs
- some docs described the core product only partially and did not explain the full decision -> action -> tracking -> improvement loop
- the frontend proxy behavior was not clearly explained alongside the backend route list
- the distinction between the main dinner-decision flow and the secondary provider surfaces was not called out consistently

## Source-Of-Truth Reminder

If a document conflicts with runtime behavior, trust the mounted frontend routes, the backend routes under `backend/app/routes`, and the ranking/tracking services under `backend/app/services`.
