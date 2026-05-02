# Ingredient Catalog v1

Pantry to Plate uses USDA Foundation Foods as a reference layer, not as user-facing copy.

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

## Current Wiring

Recipe Browser still uses the existing TypeScript taxonomy for runtime filtering. The top-level Protein tab has been folded into Ingredients, and protein groups are now shown inside the Ingredients family.

Quick Start already reads from the shared frontend taxonomy. Pantry and recommendation canonicalization still use the existing database-backed `Ingredient` and `IngredientAlias` flow; the catalog is ready to seed those names and aliases without changing cookability logic.
