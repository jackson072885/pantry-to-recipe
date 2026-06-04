# Pantry to Plate / Dinner Tonight Roadmap

This roadmap captures the current Pantry to Plate product plan in repo-local form so future implementation runs can recover the full direction from documentation rather than chat memory.

Grounding docs:

- `docs/product-standards/p2p-dinner-tonight-product-doctrine.md`
- `docs/product-standards/p2p-external-recipe-pipeline-checklist.md`
- `docs/product-standards/p2p-reviewed-import-promotion-guardrails.md`
- `docs/product-standards/p2p-reviewed-import-promotion-workflow.md`

## North Star

The Logic Pro-style recipe browser for dinner - powered by your pantry.

## Core Product Structure

Pantry to Plate has three connected product surfaces:

- **Dinner Tonight**: quick decision mode.
- **Recipe Browser**: power search / Logic Pro-style creative filter mode.
- **Your Pantry**: inventory truth.

Dinner Tonight should answer quickly. Recipe Browser should let the user shape a large recipe universe through precise controls. Your Pantry should support correction and saved memory without becoming a first-use chore.

## Core Promise

Internal promise:

> Search the recipe universe through the truth of your kitchen.

User-facing promise:

> Find what you can actually cook tonight.

## Product Doctrine

P2P is a pantry-aware recipe discovery engine.

It is not:

- a generic recipe blog
- a grocery coupon app
- a simple recipe database
- a pantry setup chore

The product should earn trust by combining broad recipe discovery, pantry-aware feasibility, and clear dinner decisions.

## Recipe Source Doctrine

External recipe sources supply candidate volume.

The internal recipe bank remains:

- fallback source when external providers are disabled or unavailable
- control source for deterministic development and testing
- verified recipe library
- storage for saved winners and proven household meals

Provider data is candidate input until normalized and scored. It should not directly define product truth.

Phase 11A adds a backend import-review foundation for external candidates. Phase 11B persists review records for create/read/list/update workflows. Phase 11D adds a controlled backend import path into a separate imported recipe layer. Phase 12 surfaces imported reviewed recipes with clear trust badges and separation from curated verified Recipe Browser cards. Phase 13 lets reviewed imports participate in pantry-aware ranking in a separate lane without merging them into the curated verified grid. Phase 14 adds a local reviewed-import detail preview inside Recipe Browser that preserves source/provenance labels and does not use the curated verified Recipe Detail page. Phase 15 adds reviewed-import cleanup/editing for title, ingredients, and instructions while preserving provenance and reviewed-import status. Phase 16 defines promotion guardrails for any future path from reviewed import to curated verified recipe. Phase 17 defines the future promotion workflow design and audit checklist. Phase 18 surfaces a read-only promotion readiness audit in the reviewed-import preview without adding a promotion action. Review and import records preserve provenance, display fields, readiness metadata, reviewer notes, edited display fields, and safety flags. Imported records are marked `external_import` and `imported_reviewed`; they are not curated verified recipes.

## Candidate Pipeline Doctrine

External and internal recipes should converge into a common candidate shape before scoring, filtering, ranking, or rendering.

The candidate pipeline should preserve or produce:

- `source`
- `source_id`
- `source_url`
- `title`
- `image_url`
- `ready_minutes`
- `servings`
- `ingredients`
- `used_ingredients`
- `missed_ingredients`
- `unused_ingredients`
- `instructions`
- `cuisine_tags`
- `dish_type_tags`
- `flavor_tags`
- `sauce_tags`
- `method_tags`
- `score`
- `feasibility_bucket`
- `feasibility_reasons`
- critical, moderate, and minor missing ingredients
- `filter_counts`

The current repo has the foundation for external candidate fetching, normalization, pantry feasibility scoring, grouped feasibility buckets, and backend living filter count metadata.

## Pantry Feasibility Doctrine

Pantry feasibility is weighted, not simple ingredient counting.

Examples:

- Missing parsley is minor.
- Missing steak in churrasco is fatal.
- Missing chicken in chicken fried rice is fatal.
- Missing soy sauce may be moderate or substitutable depending on context.

Feasibility should understand ingredient role, dish identity, substitution potential, pantry staples, and whether a missing item blocks the recipe's core promise.

## Result Buckets

Candidate results should resolve into stable buckets:

- `cookable_tonight`
- `almost_there`
- `inspiration`
- `rejected`

User-facing labels can be warmer than the internal bucket names, but the product truth should remain honest about what can actually be cooked tonight.

## Living Filters Doctrine

Recipe Browser filters should be dynamic living facets, not a static taxonomy wall.

Filters should populate from:

- current pantry
- selected filters
- current mode
- current recipe universe

Filter behavior:

- OR within a filter family
- AND across filter families
- dead filters hide, fade, or move to Explore
- every filter should eventually have counts

The backend has selected-filter narrowing and `filter_counts`. The Recipe Browser UI now has a visible control-board foundation: pantry-aware scopes, active filter stack, nested ingredient and cuisine controls, internal recipe fallback results, live external candidate availability, selectable/removable live facets, and safe provider fallback copy. The full unified Logic Pro-style board remains Phase 8 work.

## Filter Families

Primary filter families:

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

The product should feel like a smart kitchen cockpit and creative recipe instrument, not a generic grocery app, bland recipe blog, or cluttered taxonomy dump.

## Roadmap Status

- Doctrine locked: complete
- External recipe candidate pipeline: complete
- Candidate normalization: complete
- Pantry feasibility scoring: complete
- Living filter counts: complete
- Cookable Tonight / Almost There / Inspiration modes: complete
- Dinner Tonight external candidate wiring: complete
- External/internal fallback unification: complete for the backend candidate endpoint and frontend product surfaces
- External provider smoke path: complete for disabled, missing-key, and controlled live Spoonacular verification
- Recipe Browser Logic Pro control-board foundation: in progress
- Import-review foundation, queue persistence, review UI, backend approved-import path, reviewed-import surfacing, separate pantry-fit ranking lane, local reviewed-import preview, and reviewed-import cleanup/editing: complete for separate imported records
- Reviewed-import promotion guardrails: complete as docs-only Phase 16; no promotion implementation exists yet
- Reviewed-import promotion workflow design and audit checklist: complete as docs-only Phase 17; no promotion implementation exists yet
- Reviewed-import promotion readiness audit: complete as read-only Phase 18; no promotion action exists yet
- Visual design refresh: not started
- Pantry storage natural saved-memory layer: partial
- Recipe import/save-winner flow: not started
- Real-user testing: not started
- Public demo polish: not started
- Monetization: deferred

## Current Commit Chain

The core roadmap was built through this chain:

- `4a227af` docs(product): lock dinner tonight doctrine
- `2de4c686` feat(dinner-tonight): add external recipe candidate pipeline
- `3c5a37f` feat(dinner-tonight): add pantry feasibility and living filters
- `22b695b` feat(home): surface pantry-aware dinner candidates
- `26f0aa0` feat(home): unify dinner tonight fallback

The repo may contain later documentation, provider-smoke, or polish commits, but this chain is the foundation for the current Dinner Tonight direction.

## Progress Estimate

- Overall roadmap: about 55-60%
- Core engine foundation: about 85%
- Dinner Tonight quick mode: about 75%
- Recipe Browser vision: about 55-60% foundation, before the broader visual refresh
- Public demo readiness: about 35%

These are product-readiness estimates, not line-count or task-count metrics.

## Immediate Next Build Sequence

1. Finish the Phase 8 Recipe Browser control board by making live facets and internal browsing feel like one coherent decision console.
2. Visual design refresh around the finished control board.
3. Pantry storage natural saved-memory layer.
4. Save-winner / recipe import flow.

The save-winner / recipe import flow now has review queue persistence, review UI, a controlled backend approved-import path, visible reviewed-import surfacing with trust labels, a separate pantry-fit ranking lane, a local reviewed-import detail preview, reviewed-import cleanup/editing for title, ingredients, and instructions, explicit promotion guardrails, a promotion workflow/audit design, and a read-only promotion readiness audit. Cleanup and readiness preserve provenance, stay out of the curated verified Recipe Detail page, and do not promote imports into curated verified recipes. A future phase may implement an explicit promotion workflow only after the provenance audit, quality review, duplicate check, and safety gates defined in `p2p-reviewed-import-promotion-guardrails.md` and `p2p-reviewed-import-promotion-workflow.md`.

The next work should keep the current split intact: Dinner Tonight remains the fast decision surface, Recipe Browser becomes the creative control surface, and Your Pantry remains the source of inventory truth.
