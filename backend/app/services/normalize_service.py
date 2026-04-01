from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias

STAPLES: tuple[str, ...] = (
    "salt",
    "pepper",
    "oil",
    "butter",
    "water",
)


def normalize_text(value: str | None) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().lower().split())


def normalize_item(value: str | None, db: Session | None = None) -> str:
    normalized = normalize_text(value)
    if not normalized:
        return ""

    if db is None:
        return normalized

    ingredient = db.execute(
        select(Ingredient).where(Ingredient.canonical_name == normalized).order_by(Ingredient.id.asc())
    ).scalars().first()
    if ingredient is not None:
        return normalize_text(ingredient.canonical_name)

    alias = db.execute(
        select(IngredientAlias).where(IngredientAlias.normalized_alias == normalized).order_by(IngredientAlias.id.asc())
    ).scalars().first()
    if alias is None:
        return normalized

    canonical = db.get(Ingredient, alias.ingredient_id)
    if canonical is None:
        return normalized

    return normalize_text(canonical.canonical_name)
