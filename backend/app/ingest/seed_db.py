"""Seed database for Pantry-to-Recipe.

This repo is in Phase 1 MVP mode.

What this does:
- Creates tables (via init_db)
- Seeds Ingredient + IngredientAlias from ingest/data/ingredient_catalog_v1.json
- Seeds Recipes + RecipeIngredient from ingest/data/recipes_seed_v1.json

Run:
  python .\app\ingest\seed_db.py
"""

from __future__ import annotations

from app.ingest.seed_demo import main


if __name__ == "__main__":
    main()
