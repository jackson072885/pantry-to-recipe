# Recipe Browser Performance Decision

## Beta decision

Defer a dedicated Recipe Browser summary endpoint for first-user testing.

## Current behavior

- `fetchRecipeBrowserCatalog` first loads `/recipes?limit=5000`.
- It then hydrates recipe details in batches of 25 through `/recipes/{id}`.
- The recovered Recipe Browser UI already handles partial hydration failures by keeping successfully loaded recipes visible.

## Why this is acceptable for beta

- The current internal catalog is small enough for local first-user testing.
- Existing frontend coverage protects Browser recovery and loaded-result visibility.
- Adding a new backend catalog route now would touch backend route shape, frontend data loading, and Browser filtering in one pass.

## Revisit trigger

Build `GET /recipes/browser-summary` or `GET /recipes/catalog` when one of these is true:

- Browser load is visibly slow on a deployed phone browser.
- Detail hydration creates avoidable API pressure in production hosting logs.
- First-user sessions show users waiting on Browser before they can compare recipes.
- The candidate universe grows enough that batched detail hydration becomes a real launch blocker.

## Deployment note

Before beta deployment, test the Browser on the target frontend/backend hosts with `VITE_API_BASE_URL` configured. PWA work should wait until the deployed web app is fast and reliable on mobile browsers.
