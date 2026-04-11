from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias, normalize_alias_text

STAPLES: tuple[str, ...] = (
    "salt",
    "pepper",
    "oil",
    "butter",
    "water",
)

CANONICAL_ALIAS_MAP: dict[str, str] = {
    "scallion": "green onion",
    "spring onion": "green onion",
    "hamburger meat": "ground beef",
    "minced beef": "ground beef",
}


def normalize_text(value: str | None) -> str:
    return normalize_alias_text(value)


def normalize_item(value: str | None, db: Session | None = None) -> str:
    normalized = normalize_text(value)
    if not normalized:
        return ""
    canonical_candidate = CANONICAL_ALIAS_MAP.get(normalized, normalized)

    if db is None:
        return canonical_candidate

    ingredient = db.execute(
        select(Ingredient).where(Ingredient.canonical_name == canonical_candidate).order_by(Ingredient.id.asc())
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
        return canonical_candidate

    return normalize_text(canonical.canonical_name)
