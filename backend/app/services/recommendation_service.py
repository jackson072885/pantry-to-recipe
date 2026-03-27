from __future__ import annotations

from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user_action import UserAction
from app.services.normalize_service import STAPLES, normalize_item
from app.services.recipe_dataset_service import active_recipe_query
from app.services.recipe_quantity_service import (
    canonical_requirement,
    pantry_lookup_for_names,
    requirement_is_satisfied,
)

EVENT_WEIGHTS: dict[str, float] = {
    "recipe_selected": 1.0,
    "cook_clicked": 1.5,
    "ingredients_requested": 0.35,
    "recipe_cooked_confirmed": 2.5,
}

INGREDIENT_EVENT_WEIGHTS: dict[str, float] = {
    "recipe_selected": 0.25,
    "cook_clicked": 0.4,
    "ingredients_requested": 0.1,
    "recipe_cooked_confirmed": 0.75,
}


def recommend_recipes(db: Session, pantry_items: list[str] | None) -> dict:
    if pantry_items is None:
        raise ValueError("pantry is required")

    pantry_norm = {
        item
        for item in (normalize_item(value, db) for value in pantry_items if value and value.strip())
        if item
    }
    if not pantry_norm:
        raise ValueError("At least one pantry item is required")

    pantry_available = pantry_lookup_for_names(db, pantry_norm)
    for name in pantry_norm:
        pantry_available.setdefault(name, (1.0, "ea"))

    behavior_signals = _load_behavior_signals(db)

    rows = (
        db.query(
            Recipe.id,
            Recipe.name,
            Recipe.total_time_minutes,
            Recipe.difficulty,
            Recipe.prep_complexity,
            Ingredient.id,
            Ingredient.canonical_name,
            RecipeIngredient.is_required,
            RecipeIngredient.required_quantity,
            RecipeIngredient.unit,
        )
        .select_from(Recipe)
        .join(RecipeIngredient, RecipeIngredient.recipe_id == Recipe.id)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .filter(*active_recipe_query(db)._where_criteria)
        .order_by(Recipe.id.asc(), Ingredient.canonical_name.asc())
        .all()
    )

    recipe_map: dict[int, dict] = {}
    for (
        recipe_id,
        recipe_name,
        total_time_minutes,
        difficulty,
        prep_complexity,
        ingredient_id,
        ingredient_name,
        is_required,
        required_quantity,
        unit,
    ) in rows:
        entry = recipe_map.setdefault(
            recipe_id,
            {
                "recipe_id": recipe_id,
                "recipe_name": recipe_name,
                "total_time_minutes": total_time_minutes,
                "difficulty": difficulty,
                "prep_complexity": prep_complexity,
                "required": [],
            },
        )
        if is_required:
            entry["required"].append(
                {
                    "ingredient_id": ingredient_id,
                    "ingredient_name": ingredient_name,
                    "required_quantity": required_quantity,
                    "unit": unit,
                }
            )

    grouped: dict[str, list[dict]] = {
        "cook_now": [],
        "almost_there": [],
        "not_worth_it": [],
    }

    for recipe in recipe_map.values():
        required_rows = [
            row
            for row in recipe["required"]
            if row["ingredient_name"] not in STAPLES
        ]
        total_required = len(required_rows)
        present_required = []
        missing_ingredients = []

        for row in required_rows:
            ingredient_name = row["ingredient_name"]
            required_quantity, required_unit = canonical_requirement(
                row["required_quantity"],
                row["unit"],
            )
            available_quantity, available_unit = pantry_available.get(ingredient_name, (None, None))
            if requirement_is_satisfied(
                available_quantity,
                available_unit,
                required_quantity,
                required_unit,
            ):
                present_required.append(ingredient_name)
            else:
                missing_ingredients.append(ingredient_name)

        present_required.sort()
        missing_ingredients.sort()
        missing_count = len(missing_ingredients)

        if total_required == 0:
            coverage_pct = 100
        else:
            coverage_pct = int(round((len(present_required) / total_required) * 100))

        behavior_points = _behavior_points(
            recipe_id=recipe["recipe_id"],
            required_ingredient_names=[row["ingredient_name"] for row in required_rows],
            signals=behavior_signals,
        )

        recipe_item = {
            "recipe_id": recipe["recipe_id"],
            "recipe_name": recipe["recipe_name"],
            "pantry_coverage_pct": coverage_pct,
            "missing_count": missing_count,
            "missing_ingredients": missing_ingredients,
            "estimated_time_minutes": recipe["total_time_minutes"],
            "simplicity": _simplicity_score(
                recipe["difficulty"],
                recipe["prep_complexity"],
                total_required,
            ),
            "_behavior_points": behavior_points,
        }
        item = _with_explanation(recipe_item)

        if missing_count == 0:
            grouped["cook_now"].append(item)
        elif coverage_pct >= 50 or missing_count == 1:
            grouped["almost_there"].append(item)
        else:
            grouped["not_worth_it"].append(item)

    def sort_key(item: dict) -> tuple[float, int, float, str]:
        recipe = item["recipe"]
        effective_coverage = recipe["pantry_coverage_pct"] + float(recipe.get("_behavior_points", 0.0))
        return (
            -effective_coverage,
            recipe["missing_count"],
            -float(recipe.get("_behavior_points", 0.0)),
            recipe["recipe_name"].lower(),
        )

    grouped["cook_now"].sort(key=sort_key)
    grouped["almost_there"].sort(key=sort_key)
    grouped["not_worth_it"].sort(key=sort_key)

    ranked = _rank_best_tonight(
        grouped["cook_now"] + grouped["almost_there"] + grouped["not_worth_it"]
    )

    return {
        "best_tonight": _public_item(ranked["best_tonight"]),
        "alternatives": [_public_item(item) for item in ranked["alternatives"]],
        "cook_now": [_public_item(item) for item in grouped["cook_now"]],
        "almost_there": [_public_item(item) for item in grouped["almost_there"]],
        "not_worth_it": [_public_item(item) for item in grouped["not_worth_it"]],
    }


def _simplicity_score(
    difficulty: str | None,
    prep_complexity: str | None,
    total_required: int,
) -> float:
    score = 1.0

    difficulty_value = (difficulty or "").strip().lower()
    if difficulty_value in {"beginner", "easy"}:
        score += 0.25
    elif difficulty_value in {"advanced", "hard"}:
        score -= 0.25

    complexity_value = (prep_complexity or "").strip().lower()
    if complexity_value in {"simple", "low", "minimal"}:
        score += 0.25
    elif complexity_value in {"high", "complex"}:
        score -= 0.25

    if total_required <= 3:
        score += 0.2
    elif total_required >= 6:
        score -= 0.2

    return round(max(0.2, min(score, 1.5)), 2)


def _time_score(total_time_minutes: int | None) -> float:
    if total_time_minutes is None:
        return 0.6
    if total_time_minutes <= 15:
        return 1.0
    if total_time_minutes <= 25:
        return 0.85
    if total_time_minutes <= 35:
        return 0.7
    if total_time_minutes <= 50:
        return 0.5
    return 0.3


def _tonight_score(item: dict) -> float:
    recipe = item["recipe"]
    coverage_component = (recipe["pantry_coverage_pct"] / 100.0) * 0.5
    missing_component = max(0.0, 1.0 - (recipe["missing_count"] * 0.25)) * 0.25
    time_component = _time_score(recipe.get("estimated_time_minutes")) * 0.15
    simplicity_component = (float(recipe.get("simplicity", 1.0)) / 1.5) * 0.10
    behavior_component = min(float(recipe.get("_behavior_points", 0.0)) / 100.0, 0.06)
    return round(coverage_component + missing_component + time_component + simplicity_component + behavior_component, 4)


def _rank_best_tonight(items: list[dict]) -> dict:
    ranked = []
    for item in items:
        ranked_item = {
            **item,
            "tonight_score": _tonight_score(item),
        }
        ranked.append(ranked_item)

    ranked.sort(
        key=lambda item: (
            -item["tonight_score"],
            -(item["recipe"]["pantry_coverage_pct"] + float(item["recipe"].get("_behavior_points", 0.0))),
            item["recipe"]["missing_count"],
            item["recipe"]["estimated_time_minutes"] if item["recipe"]["estimated_time_minutes"] is not None else 9999,
            -float(item["recipe"]["simplicity"]),
            item["recipe"]["recipe_name"].lower(),
        )
    )

    return {
        "best_tonight": ranked[0] if ranked else None,
        "alternatives": ranked[1:4],
    }


def _with_explanation(recipe: dict) -> dict:
    coverage = recipe["pantry_coverage_pct"]
    missing = recipe["missing_ingredients"]
    if missing:
        missing_text = ", ".join(missing)
    else:
        missing_text = "none"

    explanation = (
        f"Selected because you have {coverage}% of required ingredients. "
        f"Missing: {missing_text}."
    )

    return {
        "recipe": recipe,
        "explanation": explanation,
    }


def _public_item(item: dict | None) -> dict | None:
    if item is None:
        return None

    recipe = {
        key: value
        for key, value in item["recipe"].items()
        if not key.startswith("_")
    }
    public_item = {
        "recipe": recipe,
        "explanation": item["explanation"],
    }
    if "tonight_score" in item:
        public_item["tonight_score"] = item["tonight_score"]
    return public_item


def _load_behavior_signals(db: Session) -> dict[str, dict]:
    tracked_events = tuple(EVENT_WEIGHTS.keys())

    recipe_rows = (
        db.query(UserAction.event, UserAction.recipe_id)
        .filter(UserAction.recipe_id.is_not(None), UserAction.event.in_(tracked_events))
        .all()
    )
    recipe_scores: dict[int, float] = defaultdict(float)
    for event, recipe_id in recipe_rows:
        if recipe_id is None:
            continue
        recipe_scores[int(recipe_id)] += EVENT_WEIGHTS.get(event, 0.0)

    ingredient_rows = (
        db.query(UserAction.event, Ingredient.canonical_name)
        .join(RecipeIngredient, RecipeIngredient.recipe_id == UserAction.recipe_id)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .filter(
            UserAction.recipe_id.is_not(None),
            UserAction.event.in_(tracked_events),
            RecipeIngredient.is_required.is_(True),
        )
        .all()
    )
    ingredient_scores: dict[str, float] = defaultdict(float)
    for event, ingredient_name in ingredient_rows:
        ingredient_scores[str(ingredient_name)] += INGREDIENT_EVENT_WEIGHTS.get(event, 0.0)

    return {
        "recipe_scores": recipe_scores,
        "ingredient_scores": ingredient_scores,
    }


def _behavior_points(
    *,
    recipe_id: int,
    required_ingredient_names: list[str],
    signals: dict[str, dict],
) -> float:
    recipe_scores: dict[int, float] = signals["recipe_scores"]
    ingredient_scores: dict[str, float] = signals["ingredient_scores"]

    direct_recipe_points = min(recipe_scores.get(recipe_id, 0.0) * 1.25, 3.0)

    ingredient_points = 0.0
    if required_ingredient_names:
        affinity_total = sum(ingredient_scores.get(name, 0.0) for name in required_ingredient_names)
        average_affinity = affinity_total / len(required_ingredient_names)
        ingredient_points = min(average_affinity * 2.0, 3.0)

    return round(min(direct_recipe_points + ingredient_points, 6.0), 3)
