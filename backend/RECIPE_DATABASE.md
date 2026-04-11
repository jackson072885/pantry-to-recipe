# Recipe Data Notes

This repo now contains live recipe dataset code and seeded recipe assets. This file should be treated as implementation-aligned reference, not as a pure planning document.

## What Is True Now

- Recipe data is actively used by the recommendation and recipe-detail flows.
- `backend/app/data/recipes_real_v1.json` is the canonical committed recipe source for local runtime bootstrap.
- Active recipe filtering is handled in `backend/app/services/recipe_dataset_service.py`.
- Recommendation ranking uses recipe ingredient requirements plus pantry availability.
- Quantity and unit handling are supported through `backend/app/services/recipe_quantity_service.py`.
- Real recipe data assets exist in `backend/app/data/recipes_real_v1.json`.
- Recipe detail now exposes structured ingredient rows, structured steps, and curated metadata fields such as `short_description`, `meal_type`, `tips`, and `storage`.
- Curated recipe enrichment and cleanup are handled in `backend/app/services/real_recipe_pack_service.py` and `backend/app/services/recipe_enrichment_service.py`.
- Runtime recipe quality scoring and production gating are applied in `backend/app/services/recipe_quality_service.py`, with compatibility entry points preserved in `backend/app/services/recipe_curation_service.py` for seed/audit scripts.

## Pantry Staples Rule

The following ingredients are treated as assumed staples and are excluded from required pantry matching:

- salt
- pepper
- oil
- water

The staple logic is implemented in `backend/app/services/normalize_service.py`.

## Recommendation Buckets

The current product groups recipes into:

- `cook_now`
- `almost_there`
- `not_worth_it`

Those buckets are derived from pantry coverage and missing required ingredients, then re-ranked with behavior signals.

## Production Curation

- Recipe curation now runs through `backend/app/services/recipe_curation_service.py` and `backend/app/services/recipe_quality_service.py`.
- The live recommendation flow only uses recipes that remain active and `is_production_ready = true`.
- Recipe detail responses now expose enriched ingredient fields, structured steps, and curated metadata such as tips, warnings, and quality score.

## Data Quality Guardrails

Recipe dataset cleanup and quality checks are covered by tests such as:

- `backend/app/tests/test_recipe_dataset_cleanup.py`
- `backend/app/tests/test_recipe_quality_gate.py`
- `backend/app/tests/test_recipe_detail_contract.py`

The curated seed process now does three things on startup:

- validates the canonical dataset before any recipe writes are committed
- converges dataset-managed recipes to the canonical source by inserting missing rows, updating changed rows, and pruning stale managed rows
- archives active recipes that are outside the curated production pack
- backfills structured ingredient and step data for curated recipes
- stamps quality metadata onto the active dataset
- keeps `KEEP_BUT_FLAG_FOR_REVIEW`, `MERGE_WITH_DUPLICATE`, and `REMOVE_AS_JUNK` recipes out of production-ready flows via `is_production_ready`

The default local SQLite runtime database now lives at `backend/.runtime/pantry.db`. It is treated as generated runtime state, and `backend/pantry.db` is blocked by default unless explicitly allowed for a one-off override.

If the dataset changes, keep those tests aligned with the actual live requirements instead of treating this document as the only source of truth.
