# Frontend

React + TypeScript + Vite frontend for Pantry-to-Recipe.

## Primary Product Flow

The mounted frontend is a small shell around the dinner-decision loop:

- `/` -> `Home`
- `/pantry` -> pantry editing and bulk import
- `/recommendations` -> grouped recommendation results
- `/recipes/:id` -> `RecipeDetail`

The mounted routes are defined in `frontend/src/App.tsx`.

## What Each Page Does

### Home

`frontend/src/pages/Home.tsx`

- auto-loads the saved pantry
- highlights the best dinner option only when the backend returns a true `best_tonight`
- falls back to closest suggestions when the backend reports `no_strong_match`
- renders the primary next action into recipe detail or missing-ingredient shopping

### Search / Recommendations

`frontend/src/pages/Search.tsx`

The file keeps its older `Search` name, but the mounted user-facing page is the current `Recommendations` surface.

- loads pantry items from the backend
- requests recommendations using current pantry contents
- renders `best_tonight` only for strong pantry-ready matches
- otherwise shows closest suggestions without winner language
- renders grouped recommendation sections

### RecipeDetail

`frontend/src/pages/RecipeDetail.tsx`

- fetches selected recipe detail with backend-computed readiness
- shows whether ingredients are ready, missing, or still need quantity confirmation
- lets the user copy blocked items
- links the user toward pantry fixes or missing-ingredient shopping only when required items are actually missing
- lets the user execute the cook action
- stores local checklist progress for recipe steps

### Pantry

`frontend/src/pages/Pantry.tsx`

- lists current pantry items
- supports add and remove actions
- supports bulk import through backend preview + commit validation
- links back into the recommendation flow

## RecommendationGroups Component

`frontend/src/components/RecommendationGroups.tsx` is the main grouped-results renderer.

It:

- renders the `cook_now`, `almost_there`, and `not_worth_it` buckets
- displays each recipe's pantry coverage, readiness, and missing friction
- renders the backend-authored CTA for each recommendation row
- fires tracking events when titles or CTAs are used

## CTA Behavior

The CTA logic is defined by the recommendation entry:

- if the recipe is cookable now, the CTA links to `/recipes/:id`
- if required items are missing, the CTA opens an outbound retailer search URL

That logic is shared through `frontend/src/lib/shoppingLinks.ts`.

## Tracking Integration

Tracking is implemented in `frontend/src/lib/tracking.ts`.

The frontend sends these events through `/events`:

- `recipe_selected`
- `cook_clicked`
- `ingredients_requested`
- `recipe_cooked_confirmed`
- `cta_rendered`
- `cta_clicked`
- `outbound_link_opened`

Tracking metadata includes at least:

- `client_id`
- current path
- event-specific metadata such as `source`, `destination`, and missing ingredients

## API And Proxy Setup

The frontend uses the API client in `frontend/src/lib/apiClient.ts`.

- frontend code requests routes like `/recommendations` or `/events`
- the API client rewrites those to `/api/...`
- Vite proxies `/api/*` to `http://127.0.0.1:8000`
- the proxy rewrite removes the `/api` prefix before the request reaches FastAPI

Proxy config lives in `frontend/vite.config.ts`.

## Commands

```powershell
npm install
npm test -- --run
npm run build
npm run dev
```

## Simplification Note

The mounted frontend is intentionally limited to the pantry -> best tonight/recommendations -> recipe -> cook loop.

Non-mounted provider/search-adjacent helpers may still exist under `frontend/src/lib` for shared normalization or future evaluation, but they are not the product center.
