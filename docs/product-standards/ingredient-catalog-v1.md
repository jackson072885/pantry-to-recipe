# Ingredient Catalog v1

Pantry to Plate uses USDA Foundation Foods and SR Legacy as reference layers, not as user-facing copy.

The app-facing catalog lives at `backend/app/data/ingredient_catalog_v1.json`. It is intentionally curated and human-maintainable so the product can answer the core dinner question: what can I cook tonight with what I already have?

## Shape

Each item supports:

- `id`: stable app id
- `displayName`: pantry-friendly UI label
- `canonicalName`: backend canonical ingredient name
- `family` and `subfamily`: app taxonomy
- `aliases`: safe household names that resolve to the same ingredient
- `commonUnits` and `defaultUnit`: practical pantry units
- `quickAdd`: whether the ingredient should appear in quick-start chips and its priority
- `browser`: whether it belongs in Recipe Browser ingredient filters and its group path
- `matching.rollups`: family-level matching buckets for future alignment
- `tags`: small app-facing descriptors
- `usda`: lightweight USDA references only

## Boundaries

- Do not commit `data/usda/` or raw USDA payloads.
- Do not use raw USDA descriptions as primary UI labels.
- Do not weaken Tonight's Matches honesty rules to make catalog rollups look successful.
- Prefer additive catalog alignment before changing recommendation scoring.

## Catalog Size

The v1 catalog is a curated app-facing set, not a raw USDA extract. It should stay between 175 and 350 ingredients for this pass, with recipe-used ingredients covered first through direct items, aliases, or matching rollups.

USDA references are lightweight: `usda.descriptions` and `usda.fdcIds` may be populated when a safe Foundation Foods or SR Legacy match is available. Items without a safe match use `curated_app_catalog` as the source marker rather than inventing a USDA id.

## Current Wiring

Recipe Browser uses a generated TypeScript taxonomy adapter derived from `backend/app/data/ingredient_catalog_v1.json`. Regenerate it with `cd frontend && npm run generate:ingredient-taxonomy`, and verify it with `npm run check:ingredient-taxonomy`. The adapter keeps the shipped Browser compatibility surface explicit; catalog rollups are not used to loosen Tonight's Matches or Browser eligibility.

Quick Start already reads from the shared frontend taxonomy. Pantry and recommendation canonicalization still use the existing database-backed `Ingredient` and `IngredientAlias` flow; the catalog is ready to seed those names and aliases without changing cookability logic.
