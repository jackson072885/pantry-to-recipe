from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal, engine
from app.models import Base, Ingredient, Recipe, RecipeIngredient

DATA_PATH = Path(__file__).resolve().parent / "recipes_seed.jsonl"


def _normalize(s: str) -> str:
    return " ".join(s.strip().lower().split())


def get_or_create_ingredient(db: Session, name: str) -> Ingredient:
    canonical = _normalize(name)
    existing = db.execute(
        select(Ingredient).where(Ingredient.canonical_name == canonical)
    ).scalar_one_or_none()
    if existing:
        return existing

    ing = Ingredient(canonical_name=canonical)
    db.add(ing)
    db.commit()
    db.refresh(ing)
    return ing


def upsert_recipe(db: Session, row: dict[str, Any]) -> None:
    title = row.get("title") or row.get("name") or ""
    recipe_name = title.strip()
    if not recipe_name:
        return

    existing = db.execute(
        select(Recipe).where(Recipe.name == recipe_name)
    ).scalar_one_or_none()

    if existing:
        recipe = existing
    else:
        instructions = row.get("instructions")
        if isinstance(instructions, list):
            instructions_text = "\n".join(str(x) for x in instructions)
        else:
            instructions_text = str(instructions) if instructions is not None else None

        recipe = Recipe(
            name=recipe_name,
            instructions=instructions_text,
        )
        recipe.title = recipe_name
        db.add(recipe)
        db.commit()
        db.refresh(recipe)

    for ing in row.get("ingredients", []):
        ing_name = ing.get("name")
        if not ing_name:
            continue

        ingredient = get_or_create_ingredient(db, ing_name)

        link = db.execute(
            select(RecipeIngredient).where(
                RecipeIngredient.recipe_id == recipe.id,
                RecipeIngredient.ingredient_id == ingredient.id,
            )
        ).scalar_one_or_none()

        qty = ing.get("qty")
        qty_val = float(qty) if isinstance(qty, (int, float)) else None

        if link:
            link.required = bool(ing.get("required", True))
            link.quantity_canonical = qty_val
        else:
            db.add(
                RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredient.id,
                    required=bool(ing.get("required", True)),
                    quantity_canonical=qty_val,
                )
            )

    db.commit()


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        with DATA_PATH.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                upsert_recipe(db, json.loads(line))
        print("Recipes imported successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
