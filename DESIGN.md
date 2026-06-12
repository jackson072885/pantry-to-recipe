# Product & UX Design

## Product Truth

Pantry-to-Recipe is a pantry-aware dinner discovery and decision tool.

Its core question is:

**What should I cook tonight, with confidence, using what I already have?**

The locked product doctrine is the Logic Pro-style recipe browser for dinner, powered by pantry truth. Product direction should follow `docs/product-standards/p2p-dinner-tonight-product-doctrine.md`.

The shipped product remains centered on the loop:

1. pantry input
2. ranked recommendation output
3. one clear best option
4. recipe detail and cook action
5. pantry update and repeat

Recipe Browser is the power-search counterpart to Dinner Tonight. It should not become a generic catalog, but it should evolve into pantry-aware creative filtering across a broader recipe universe.

## Mounted User Surfaces

The current frontend mounts these routes in `frontend/src/App.tsx`:

- `/` -> `Tonight`
- `/pantry` -> `Pantry`
- `/recommendations` -> `Recommendations`
- `/recipe-browser` -> `Recipe Browser`
- `/recipes/:id` -> `Recipe Detail`

If this file ever disagrees with mounted routes or live backend routers, trust runtime code.

## Primary UX Goals

- deliver first value quickly from saved pantry state
- make the best dinner option obvious on load
- keep grouped recommendations secondary to the single winner
- support confident action, not endless browsing
- avoid overstating intelligence beyond what the implementation can explain

## Page Intent

### Tonight

- auto-load saved pantry state
- present the strongest current dinner choice first
- explain why that choice won using backend-authored signals
- keep the next action obvious

### Pantry

- make pantry editing fast and low-friction
- support realistic amounts and clear correction/removal actions
- feed the recommendation loop without becoming a setup-heavy experience

### Recommendations

- present grouped backups after the primary winner is already clear
- help users scan `cook_now`, `almost_there`, and `not_worth_it`
- make grocery friction and backup usefulness easy to understand

### Recipe Detail

- confirm whether the recipe is ready from the pantry
- show what is missing when it is blocked
- make the cook action or next pantry/shopping action obvious

## Recommendation UX Rules

- pantry fit remains the primary truth
- backend owns ranking meaning, CTA semantics, and explanation fields
- frontend renders trust signals but does not invent ranking logic
- grouped buckets are secondary browsing aids, not competing hero surfaces
- if no strong match exists, say so plainly instead of fabricating confidence

## Parked Concepts

Older setup-heavy onboarding and generic catalog ideas remain historical context only. Future browsing work should follow the Dinner Tonight product doctrine and keep pantry feasibility as the trust layer.
