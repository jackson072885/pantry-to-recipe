# Pantry to Plate / Dinner Tonight Product Doctrine

## North Star

Build the Logic Pro-style recipe browser for dinner, powered by pantry truth.

Pantry to Plate should let a user search the recipe universe through the truth of their kitchen. The product is valuable because it can combine broad recipe discovery, deep creative controls, and honest pantry feasibility into one dinner decision surface. It should feel expressive enough for exploration and strict enough to protect trust.

## What the Product Is

Pantry to Plate is a pantry-aware recipe discovery engine.

It helps users enter pantry items, search a massive recipe universe, shape that universe with deep creative filters, and see only recipes they can actually cook tonight or clearly understand what they are missing.

The product has two connected discovery speeds:

- **Dinner Tonight** is the fast decision mode. It should help the user get to a useful dinner answer quickly.
- **Recipe Browser** is the power search mode. It should feel like a creative control board for filtering the recipe universe through pantry reality.

The user-facing promise is:

> Find what you can actually cook tonight.

The internal product doctrine version is:

> Search the recipe universe through the truth of your kitchen.

## What the Product Is Not

Pantry to Plate is not:

- a generic recipe blog
- a grocery coupon app
- a meal-prep-only planner
- a simple recipe database
- a pantry setup chore
- a giant taxonomy dump

The product should not make full pantry setup feel like the required first-use burden. Pantry storage matters, but the first value should come from lightweight pantry truth and visible recipe usefulness.

## Core Product Modes

### Dinner Tonight

Dinner Tonight is quick decision mode.

It should surface the most useful dinner direction first, explain why it fits the current pantry and constraints, and make the next action obvious. It should reduce decision pressure rather than ask the user to configure a system before getting value.

### Recipe Browser

Recipe Browser is power search and creative filter mode.

It should let the user shape a large recipe candidate universe through cuisine, protein, ingredient, dish type, flavor, sauce, method, time, effort, cleanup, diet, cost, and cookability controls. It should feel like a smart instrument for dinner exploration, not a static catalog.

### Your Pantry

Your Pantry is inventory truth.

It stores what the user has, supports correction, and gives the scoring system the evidence it needs. It should become a natural saved-memory layer over time, not a first-use chore.

## Recipe Source Doctrine

The internal recipe bank is not the whole recipe universe.

External recipe APIs and sources should provide candidate volume. The internal recipe bank remains important, but its role changes:

- fallback source when external providers are unavailable
- testing and control source for deterministic validation
- curated verified library for high-trust recipes
- storage for saved winners and proven household meals

External recipes must be normalized before the app trusts them. Provider data is candidate input, not product truth.

Phase 11A adds an import-review foundation for external candidates. Phase 11B persists that review queue for create/read/list/update workflows. Phase 11D adds a controlled backend import path into a separate imported recipe layer. Phase 12 surfaces reviewed imports with explicit trust badges and separation from curated verified recipes. Phase 13 ranks reviewed imports in their own pantry-fit lane while preserving provenance and keeping them out of curated verified Recipe Browser cards. Phase 14 adds a local reviewed-import detail preview that keeps provenance, trust labels, pantry fit, ingredients, and instructions visible without using the curated verified Recipe Detail page. Phase 15 adds reviewed-import cleanup for title, ingredients, and instructions while preserving provenance and reviewed-import trust labels. Cleanup does not use the curated verified Recipe Detail page and does not promote imports into curated verified recipes. Phase 16 defines explicit promotion guardrails: reviewed imports remain separate until a future promotion workflow completes provenance, quality, duplicate, and safety checks. Phase 17 defines that future workflow shape and promotion audit checklist without implementing promotion. Phase 18 surfaces a read-only promotion readiness audit in the reviewed-import preview while preserving reviewed-import status and avoiding any promotion action. Phase 19 persists promotion audit checklist state and reviewer notes while still avoiding promotion execution or curated verified writes. The queue and import path preserve source provenance, normalized display fields, readiness metadata, reviewer notes, and deterministic safety flags, but imported external recipes are still not curated verified recipes.

## Candidate Normalization Doctrine

External and internal recipes should converge into a common candidate shape before scoring, filtering, ranking, or rendering.

The common candidate shape should include:

- `source`
- `source_id`
- `source_url`
- `title`
- `image_url` optional
- `ready_minutes` optional
- `servings` optional
- `ingredients`
- `used_ingredients`
- `missed_ingredients`
- `instructions`
- cuisine tags
- dish type tags
- flavor tags
- sauce tags
- method tags
- raw provider metadata

Normalization should preserve provider traceability while giving Pantry to Plate one internal way to reason about feasibility, filters, and user-facing trust.

## Pantry Feasibility Doctrine

Pantry feasibility is weighted and contextual. It is not simple ingredient counting.

Examples:

- Missing parsley is minor.
- Missing steak in churrasco is fatal.
- Missing chicken in chicken fried rice is fatal.
- Missing soy sauce may be moderate or substitutable depending on context.

The scoring system must understand ingredient role, dish identity, substitution potential, pantry staples, and whether a missing item blocks the recipe's core promise.

Result groups should be:

- **Cookable Tonight**: the user can reasonably cook this from current pantry truth.
- **Almost There**: the recipe is close, but one or more meaningful gaps must be resolved.
- **Inspiration**: useful discovery, but not currently a strong tonight fit.
- **Rejected**: not useful enough to show prominently for the current pantry and filters.

## Living Filters Doctrine

Recipe Browser filters should be dynamic living facets, not a static taxonomy wall.

Filters should populate from:

- current pantry
- selected filters
- current mode
- current recipe universe

Filter choices should only appear prominently if they lead to useful results. Dead filters should hide, fade, or move to Explore. Every filter should ideally have a result count behind it.

Recipe Browser should feel like a creative control board, not a boring form.

Filter families:

- Cuisine
- Protein
- Ingredient
- Dish Type
- Flavor
- Sauce
- Method
- Time
- Effort
- Cleanup
- Diet
- Cost
- Cookability

## Visual Direction

Warm kitchen base + electric creative controls + premium dashboard feel.

Recipe Browser should feel like:

- smart kitchen cockpit
- creative recipe instrument
- modern food discovery board

Avoid:

- generic grocery app
- bland recipe blog
- grandma recipe box
- cluttered taxonomy dump

The visual system should make pantry truth feel warm and practical while making creative filtering feel precise, energetic, and premium.

## Roadmap / Order of Operations

1. Write/lock the new product doctrine.
2. Add an external recipe API/source pipeline.
3. Normalize external recipes into a common internal candidate shape.
4. Build pantry feasibility scoring.
5. Build dynamic/living filter counts.
6. Add Cookable Tonight / Almost There / Explore result modes.
7. Wire Dinner Tonight to external candidates.
8. Upgrade Recipe Browser into the Logic Pro-style control board.
9. Refresh the visual design system.
10. Improve pantry storage as a natural saved-memory layer, not a first-use burden.
11. Add recipe import/save-winner flow.
12. Test with real users.
13. Polish a public demo.
14. Think about monetization later only after the product deserves it.

## Immediate Next Build Sequence

1. Finish the Phase 8 Recipe Browser control board by making live facets and internal browsing feel like one coherent decision console.
2. Refresh the visual design system around the finished control board.
3. Improve pantry storage as a natural saved-memory layer, not a first-use burden.
4. Add recipe import/save-winner flow, then test with real users and polish the public demo.

## Phase 1-7 Completion Note

Phases 1 through 7 are now implemented as the product foundation:

- Doctrine, source doctrine, and order of operations are documented.
- External provider configuration, candidate fetching, and normalized candidate shape exist behind controlled provider status states.
- Weighted pantry feasibility scoring produces Cookable Tonight, Almost There, Inspiration, and Rejected buckets with critical, moderate, and minor missing-ingredient metadata.
- Dinner Tonight can surface configured live candidates while preserving saved-pantry internal matches as fallback.
- Recipe Browser has a Phase 8 foundation: pantry-aware scopes, active filter stack, nested internal filter console, live external candidate availability, selectable/removable live facets, dead-facet suppression, and internal recipe cards as the trusted browsing backbone.
- Phase 11A/11B import-review foundation and queue persistence exist for external candidates, preserving provenance and safety flags.
- Phase 11D adds a backend approved-import path into a separate `external_import` / `imported_reviewed` layer without mutating the curated verified recipe bank.
- Phase 12 surfaces reviewed imports with trust badges while keeping them separate from curated verified Recipe Browser cards.
- Phase 13 lets reviewed imports participate in pantry-aware ranking inside a separate reviewed-import lane with provenance and trust labels intact.
- Phase 14 adds reviewed-import detail preview inside Recipe Browser while keeping imports separate from the curated verified Recipe Detail route.
- Phase 15 adds reviewed-import cleanup/editing for title, ingredients, and instructions while preserving source provenance, trust labels, and separation from curated verified recipes. Cleanup does not promote the import.
- Phase 16 defines reviewed-import promotion guardrails in `docs/product-standards/p2p-reviewed-import-promotion-guardrails.md`; no promotion workflow is implemented yet.
- Phase 17 defines the future promotion workflow design and audit checklist in `docs/product-standards/p2p-reviewed-import-promotion-workflow.md`; no promotion workflow is implemented yet.
- Phase 18 surfaces a read-only promotion readiness audit in the reviewed-import preview; no promotion action is implemented yet.
- Phase 19 persists promotion audit checklist state and reviewer notes for reviewed imports; no promotion action is implemented yet.

Phase 8 is not complete until those controls behave as one coherent browser experience. Phase 9 should wait for that product endpoint rather than restart the product architecture.
