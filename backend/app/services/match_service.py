from __future__ import annotations

from collections import defaultdict
from sqlalchemy.orm import Session

from app.models.recipe import Recipe, RecipeIngredient
from app.models.ingredient import Ingredient
from app.services.normalize_service import STAPLES, normalize_item
from app.schemas.match import MatchResult, MatchResponse


def match_recipes(db: Session, pantry_items: list[str]) -> MatchResponse:
    """
    Deterministic recipe matching engine.

    - Required ingredients dominate scoring
    - Staples are removed from required sets
    - Buckets: cookable / almost / not
    - Stable ordering
    - Bucket size capped for frontend sanity
    """

    if pantry_items is None:
        raise ValueError("pantry is required")

    # Normalize pantry input (drop blanks + None)
    pantry_norm = {
        x for x in (normalize_item(i) for i in pantry_items if i and i.strip())
        if x
    }

    # Deterministic preload
    rows = (
        db.query(
            Recipe.id,
            Recipe.name,
            Ingredient.canonical_name,
            RecipeIngredient.is_required,
        )
        .join(RecipeIngredient, RecipeIngredient.recipe_id == Recipe.id)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .order_by(Recipe.id.asc(), Ingredient.canonical_name.asc())
        .all()
    )

    # Build recipe map
    recipe_map: dict[int, dict] = {}

    for recipe_id, recipe_name, ing_name, is_required in rows:
        entry = recipe_map.setdefault(
            recipe_id,
            {
                "recipe_id": recipe_id,
                "recipe_name": recipe_name,
                "required": set(),
                "optional": set(),
            },
        )

        if is_required:
            entry["required"].add(ing_name)
        else:
            entry["optional"].add(ing_name)

    flat_results: list[MatchResult] = []

    for rec in recipe_map.values():
        required: set[str] = set(rec["required"]) - set(STAPLES)
        optional: set[str] = set(rec["optional"]) - set(STAPLES)

        total_required = len(required)
        denom_required = max(total_required, 1)

        missing_required = sorted(list(required - pantry_norm))
        missing_required_count = len(missing_required)

        present_required = len(required & pantry_norm)
        present_optional = len(optional & pantry_norm)

        required_ratio = present_required / denom_required
        optional_ratio = (
            present_optional / max(len(optional), 1)
        ) if optional else 0.0

        confidence = round(
            (required_ratio * 0.85) + (optional_ratio * 0.15),
            3,
        )

        # Improve confidence realism for 1-away recipes
        if len(required) == 1 and missing_required_count == 1:
            confidence = max(confidence, 0.6)

        # Status logic (trust-first)
        if missing_required_count == 0:
            status = "cookable"
        elif missing_required_count == 1 and required_ratio >= 0.5:
            status = "almost"
        else:
            status = "not"

        flat_results.append(
            MatchResult(
                recipe_id=rec["recipe_id"],
                recipe_name=rec["recipe_name"],
                status=status,
                confidence=confidence,
                missing_required_count=missing_required_count,
                total_required=total_required,
                missing_required=missing_required,
            )
        )

    # Stable sort
    flat_results.sort(
        key=lambda r: (
            r.status != "cookable",
            r.status != "almost",
            -r.confidence,
            r.missing_required_count,
            r.recipe_id,
        )
    )

    grouped = defaultdict(list)
    for r in flat_results:
        grouped[r.status].append(r)

    # Cap bucket size (frontend sanity)
    MAX_PER_BUCKET = 25
    grouped["cookable"] = grouped["cookable"][:MAX_PER_BUCKET]
    grouped["almost"] = grouped["almost"][:MAX_PER_BUCKET]
    grouped["not"] = grouped["not"][:MAX_PER_BUCKET]

    return MatchResponse(
        cookable=grouped["cookable"],
        almost=grouped["almost"],
        not_cookable=grouped["not"],
        meta={
            "pantry_count": len(pantry_items),
            "normalized_count": len(pantry_norm),
            "recipe_count": len(recipe_map),
        },
    )