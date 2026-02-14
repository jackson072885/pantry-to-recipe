from __future__ import annotations

from typing import Any, Dict, List, Set

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cook_service import normalize_item, STAPLES
from app.models import Ingredient, IngredientAlias, Recipe, RecipeIngredient


def _pantry_to_ingredient_ids(db: Session, pantry_items: List[str]) -> Set[int]:
    """
    Convert raw pantry strings -> Ingredient IDs using:
    1) normalized alias match
    2) canonical name match
    """
    normalized = [normalize_item(x) for x in pantry_items if str(x).strip()]
    normalized = [x for x in normalized if x]

    if not normalized:
        return set()

    # Alias match
    alias_rows = db.execute(
        select(IngredientAlias).where(IngredientAlias.normalized_alias.in_(normalized))
    ).scalars().all()
    by_alias = {a.ingredient_id for a in alias_rows}

    # Canonical match
    canonical_rows = db.execute(
        select(Ingredient).where(Ingredient.canonical_name.in_(normalized))
    ).scalars().all()
    by_canonical = {i.id for i in canonical_rows}

    return by_alias | by_canonical


def match_from_db(db: Session, pantry_items: List[str]) -> Dict[str, Any]:
    pantry_ids = _pantry_to_ingredient_ids(db, pantry_items)

    # Load recipes + their recipe_ingredients in one go (small MVP ok)
    recipes = db.execute(select(Recipe)).scalars().all()

    cookable: List[Dict[str, Any]] = []
    almost: List[Dict[str, Any]] = []
    not_cookable: List[Dict[str, Any]] = []

    for r in recipes:
        ris = db.execute(
            select(RecipeIngredient).where(RecipeIngredient.recipe_id == r.id)
        ).scalars().all()

        # Required ingredient IDs for matching
        required_ids = {ri.ingredient_id for ri in ris if ri.required}

        # Remove global STAPLES from required, if they exist as ingredients
        # (We treat them as always available.)
        if required_ids:
            staple_ids = set(
                db.execute(
                    select(Ingredient.id).where(Ingredient.canonical_name.in_(sorted(STAPLES)))
                ).scalars().all()
            )
            required_ids -= staple_ids

        matched_ids = required_ids & pantry_ids
        missing_ids = required_ids - pantry_ids

        # Pull names for output (only for this recipe)
        if required_ids:
            ing_map = {
                ing.id: ing.canonical_name
                for ing in db.execute(select(Ingredient).where(Ingredient.id.in_(required_ids))).scalars().all()
            }
        else:
            ing_map = {}

        matched = sorted([ing_map.get(i, str(i)) for i in matched_ids])
        missing = sorted([ing_map.get(i, str(i)) for i in missing_ids])

        missing_count = len(missing)
        required_count = len(required_ids)
        matched_count = len(matched_ids)
        match_ratio = round((matched_count / required_count), 3) if required_count else 0.0

        # Basic scoring (importance-aware)
        importance_by_ing = {ri.ingredient_id: float(ri.importance or 1.0) for ri in ris if ri.required}
        denom = sum(importance_by_ing.get(i, 1.0) for i in required_ids) or 1.0
        matched_w = sum(importance_by_ing.get(i, 1.0) for i in matched_ids)
        missing_w = sum(importance_by_ing.get(i, 1.0) for i in missing_ids)

        score = 100.0 * (matched_w / denom) - (25.0 * (missing_w / denom))
        score = max(0.0, min(100.0, score))
        score = round(score, 1)

        if missing_count == 0:
            bucket = "cookable"
            confidence = "Perfect"
        elif missing_count <= 2:
            bucket = "almost"
            confidence = "High" if match_ratio >= 0.75 else ("Medium" if match_ratio >= 0.5 else "Low")
        else:
            bucket = "not_cookable"
            confidence = "Low"

        result = {
            "id": r.id,
            "name": r.name,
            "matched": matched,
            "missing": missing,
            "missing_count": missing_count,
            "matched_count": matched_count,
            "required_count": required_count,
            "match_ratio": match_ratio,
            "confidence": confidence,
            "confidence_score": score,
        }

        if bucket == "cookable":
            cookable.append(result)
        elif bucket == "almost":
            almost.append(result)
        else:
            not_cookable.append(result)

    cookable.sort(key=lambda x: (-x["confidence_score"], -x["match_ratio"], x["name"]))
    almost.sort(key=lambda x: (-x["confidence_score"], x["missing_count"], -x["match_ratio"], x["name"]))
    not_cookable.sort(key=lambda x: (-x["confidence_score"], -x["match_ratio"], x["missing_count"], x["name"]))

    return {"cookable": cookable, "almost": almost, "not_cookable": not_cookable}
