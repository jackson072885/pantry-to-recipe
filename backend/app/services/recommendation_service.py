from __future__ import annotations

from collections import defaultdict
from enum import Enum

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.pantry_item import PantryItem
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user_action import UserAction
from app.services.normalize_service import normalize_item
from app.services.pantry_service import PANTRY_SOURCE_QUICK_START
from app.services.quick_start_defaults import quick_start_meal_floor_index
from app.services.recipe_dataset_service import production_recipe_query
from app.services.recipe_quantity_service import (
    canonical_requirement,
    pantry_lookup_for_names,
    requirement_is_satisfied,
    soft_family_availability,
    units_are_comparable,
)

EVENT_WEIGHTS: dict[str, float] = {
    "recipe_selected": 1.0,
    "cook_clicked": 1.5,
    "ingredients_requested": 0.35,
    "recipe_cooked_confirmed": 2.5,
    "recipe_liked": 2.2,
    "recipe_skipped": -2.0,
}

GROUP_PRIORITY: dict[str, int] = {
    "cook_now": 0,
    "almost_there": 1,
    "not_worth_it": 2,
}

STRONG_MATCH_STATUS = "strong_match"
NO_STRONG_MATCH_STATUS = "no_strong_match"
BEHAVIOR_ACTION_WINDOW = 200
USE_SOON_POINTS_PER_MATCH = 0.35
USE_SOON_MAX_POINTS = 0.7
STRONG_MATCH_BEHAVIOR_MAX_POINTS = 0.35
FALLBACK_BEHAVIOR_MAX_POINTS = 0.15
FALLBACK_BEHAVIOR_MIN_COVERAGE_PCT = 85
HERO_FATIGUE_EVENT_THRESHOLD = 2
HERO_FATIGUE_POINTS_PER_EXTRA_EVENT = 0.15
HERO_FATIGUE_MAX_POINTS = 0.45
FAMILY_MATCH_SCORE_PENALTY = 0.08
MINOR_REQUIRED_WEIGHT = 0.35
MINOR_REQUIRED_SIGNAL_KEYWORDS = (
    "for serving",
    "before serving",
    "garnish",
    "optional finish",
    "optional topping",
    "optional garnish",
    "to serve",
    "for topping",
    "for topping only",
    "finish with",
)
BEEF_STEAK_RANKING_FAMILY = frozenset({"beef", "steak"})


class RecommendationMode(str, Enum):
    BALANCED = "balanced"
    LOWEST_EFFORT = "lowest_effort"
    USE_IT_UP_FIRST = "use_it_up_first"


DEFAULT_RECOMMENDATION_MODE = RecommendationMode.BALANCED

MODE_METADATA: dict[RecommendationMode, dict[str, str]] = {
    RecommendationMode.BALANCED: {
        "label": "Best tonight",
        "description": "Pantry fit stays first. Time, simplicity, and quality only break close calls.",
    },
    RecommendationMode.LOWEST_EFFORT: {
        "label": "Lowest effort tonight",
        "description": "Pantry fit stays first. Close calls favor shorter, simpler dinners.",
    },
    RecommendationMode.USE_IT_UP_FIRST: {
        "label": "Use it up first",
        "description": "Pantry fit stays first. Close calls favor dinners that use more of what you already have.",
    },
}


def recommend_recipes(
    db: Session,
    pantry_items: list[str] | None,
    mode: RecommendationMode | str = DEFAULT_RECOMMENDATION_MODE,
    session_id: str = "anonymous",
) -> dict:
    if pantry_items is None:
        raise ValueError("pantry is required")
    resolved_mode = _coerce_recommendation_mode(mode)

    pantry_norm = {
        item
        for item in (normalize_item(value, db) for value in pantry_items if value and value.strip())
        if item
    }
    if not pantry_norm:
        raise ValueError("At least one pantry item is required")

    pantry_available = pantry_lookup_for_names(db, pantry_norm, session_id)
    quick_start_floor_lookup = _quick_start_floor_lookup(pantry_available)

    behavior_signals = _load_behavior_signals(db, session_id)
    use_soon_items = _load_use_soon_items(db, pantry_norm, session_id)

    rows = (
        db.query(
            Recipe.id,
            Recipe.name,
            Recipe.short_description,
            Recipe.total_time_minutes,
            Recipe.difficulty,
            Recipe.meal_type,
            Recipe.servings,
            Recipe.quality_score,
            Recipe.quality_bucket,
            Recipe.review_status,
            Recipe.is_weeknight_friendly,
            Recipe.is_beginner_friendly,
            Recipe.prep_complexity,
            Ingredient.id,
            Ingredient.canonical_name,
            RecipeIngredient.is_required,
            RecipeIngredient.required_quantity,
            RecipeIngredient.unit,
            RecipeIngredient.measurement_is_estimated,
            RecipeIngredient.notes,
        )
        .select_from(Recipe)
        .join(RecipeIngredient, RecipeIngredient.recipe_id == Recipe.id)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .filter(*production_recipe_query(db)._where_criteria)
        .order_by(Recipe.id.asc(), Ingredient.canonical_name.asc())
        .all()
    )

    recipe_map: dict[int, dict] = {}
    for (
        recipe_id,
        recipe_name,
        short_description,
        total_time_minutes,
        difficulty,
        meal_type,
        servings,
        quality_score,
        quality_bucket,
        review_status,
        is_weeknight_friendly,
        is_beginner_friendly,
        prep_complexity,
        ingredient_id,
        ingredient_name,
        is_required,
        required_quantity,
        unit,
        measurement_is_estimated,
        notes,
    ) in rows:
        entry = recipe_map.setdefault(
            recipe_id,
            {
                "recipe_id": recipe_id,
                "recipe_name": recipe_name,
                "short_description": short_description,
                "total_time_minutes": total_time_minutes,
                "difficulty": difficulty,
                "meal_type": meal_type,
                "servings": servings,
                "quality_score": quality_score,
                "quality_bucket": quality_bucket,
                "review_status": review_status,
                "is_weeknight_friendly": is_weeknight_friendly,
                "is_beginner_friendly": is_beginner_friendly,
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
                    "measurement_is_estimated": measurement_is_estimated,
                    "notes": notes,
                }
            )

    grouped: dict[str, list[dict]] = {
        "cook_now": [],
        "almost_there": [],
        "not_worth_it": [],
    }

    for recipe in recipe_map.values():
        required_rows = list(recipe["required"])
        total_required = len(required_rows)
        present_required = []
        aligned_required = []
        missing_ingredients = []
        missing_core_ingredients = []
        missing_minor_ingredients = []
        unknown_quantity_ingredients = []
        soft_floor_quantity_confirmation_ingredients = []
        family_match_quantity_confirmation_ingredients = []
        family_match_details = []
        total_required_weight = 0.0
        aligned_required_weight = 0.0
        total_core_required = 0
        present_core_required = 0
        aligned_core_required = 0

        for row in required_rows:
            ingredient_name = row["ingredient_name"]
            importance = _ingredient_importance(
                ingredient_name,
                row.get("notes"),
            )
            weight = _required_weight_for_importance(importance)
            total_required_weight += weight
            if importance == "core":
                total_core_required += 1
            required_quantity, required_unit = canonical_requirement(
                row["required_quantity"],
                row["unit"],
            )
            availability = pantry_available.get(ingredient_name)
            family_match = None if availability is not None else soft_family_availability(
                ingredient_name,
                pantry_available,
            )
            available_quantity = availability.quantity if availability is not None else None
            available_unit = availability.unit if availability is not None else None
            quantity_is_known = availability.quantity_is_known if availability is not None else True
            beef_steak_family_presence = _is_beef_steak_family_presence_match(
                ingredient_name,
                pantry_available,
            )
            soft_floor_covered = _is_soft_floor_covered(
                ingredient_name,
                required_quantity,
                required_unit,
                availability,
                quick_start_floor_lookup,
            )
            if requirement_is_satisfied(
                available_quantity,
                available_unit,
                required_quantity,
                required_unit,
                quantity_is_known=quantity_is_known,
            ):
                present_required.append(ingredient_name)
                aligned_required.append(ingredient_name)
                aligned_required_weight += weight
                if importance == "core":
                    present_core_required += 1
                    aligned_core_required += 1
            elif availability is not None and not quantity_is_known:
                if (
                    getattr(availability, "source", "") != PANTRY_SOURCE_QUICK_START
                    or soft_floor_covered
                    or beef_steak_family_presence
                ):
                    aligned_required.append(ingredient_name)
                    aligned_required_weight += weight
                    unknown_quantity_ingredients.append(ingredient_name)
                    if soft_floor_covered:
                        soft_floor_quantity_confirmation_ingredients.append(ingredient_name)
                    if importance == "core":
                        aligned_core_required += 1
                else:
                    unknown_quantity_ingredients.append(ingredient_name)
                    missing_ingredients.append(ingredient_name)
                    if importance == "minor":
                        missing_minor_ingredients.append(ingredient_name)
                    else:
                        missing_core_ingredients.append(ingredient_name)
            elif availability is not None and not units_are_comparable(available_unit, required_unit):
                unknown_quantity_ingredients.append(ingredient_name)
            elif soft_floor_covered or beef_steak_family_presence:
                aligned_required.append(ingredient_name)
                aligned_required_weight += weight
                unknown_quantity_ingredients.append(ingredient_name)
                if soft_floor_covered:
                    soft_floor_quantity_confirmation_ingredients.append(ingredient_name)
                if importance == "core":
                    aligned_core_required += 1
            elif family_match is not None:
                pantry_name, _family_availability = family_match
                aligned_required.append(ingredient_name)
                aligned_required_weight += weight
                unknown_quantity_ingredients.append(ingredient_name)
                family_match_quantity_confirmation_ingredients.append(ingredient_name)
                family_match_details.append(
                    {
                        "ingredient": ingredient_name,
                        "pantry_item": pantry_name,
                        "message": (
                            f"You have {pantry_name} saved. {ingredient_name} is preferred; "
                            "confirm your cheese works for this recipe."
                        ),
                    }
                )
                if importance == "core":
                    aligned_core_required += 1
            else:
                missing_ingredients.append(ingredient_name)
                if importance == "minor":
                    missing_minor_ingredients.append(ingredient_name)
                else:
                    missing_core_ingredients.append(ingredient_name)

        present_required.sort()
        aligned_required.sort()
        missing_ingredients.sort()
        missing_core_ingredients.sort()
        missing_minor_ingredients.sort()
        unknown_quantity_ingredients.sort()
        soft_floor_quantity_confirmation_ingredients.sort()
        family_match_quantity_confirmation_ingredients.sort()
        family_match_details.sort(key=lambda item: item["ingredient"])
        quantity_confirmation_ingredients = list(unknown_quantity_ingredients)
        blocking_ingredients = sorted(missing_ingredients + quantity_confirmation_ingredients)
        shopping_missing_count = len(missing_ingredients)
        quantity_confirmation_count = len(quantity_confirmation_ingredients)
        missing_count = len(blocking_ingredients)
        missing_core_count = len(missing_core_ingredients)
        missing_minor_count = len(missing_minor_ingredients)
        missing_burden = round(
            missing_core_count + (missing_minor_count * MINOR_REQUIRED_WEIGHT),
            3,
        )

        if total_required_weight <= 0:
            coverage_pct = 100
        else:
            coverage_pct = int(round((aligned_required_weight / total_required_weight) * 100))

        behavior_points = _behavior_points(
            recipe_id=recipe["recipe_id"],
            required_ingredient_names=[row["ingredient_name"] for row in required_rows],
            signals=behavior_signals,
        )
        behavior_details = _behavior_details(
            recipe_id=recipe["recipe_id"],
            required_ingredient_names=[row["ingredient_name"] for row in required_rows],
            signals=behavior_signals,
        )
        use_soon_details = _use_soon_details(aligned_required, use_soon_items)
        simplicity = _simplicity_score(
            recipe["difficulty"],
            recipe["prep_complexity"],
            total_required,
        )
        mode_recipe = {
            **recipe,
            "simplicity": simplicity,
        }
        mode_details = _mode_details(mode_recipe, len(aligned_required), total_required, resolved_mode)

        recipe_item = {
            "recipe_id": recipe["recipe_id"],
            "recipe_name": recipe["recipe_name"],
            "pantry_coverage_pct": coverage_pct,
            "missing_count": missing_count,
            "missing_ingredients": blocking_ingredients,
            "estimated_time_minutes": recipe["total_time_minutes"],
            "short_description": recipe["short_description"],
            "difficulty": recipe["difficulty"],
            "meal_type": recipe["meal_type"],
            "servings": recipe["servings"],
            "quality_score": recipe["quality_score"],
            "quality_bucket": recipe["quality_bucket"],
            "review_status": recipe["review_status"],
            "is_weeknight_friendly": recipe["is_weeknight_friendly"],
            "is_beginner_friendly": recipe["is_beginner_friendly"],
            "present_required_count": len(present_required),
            "aligned_required_count": len(aligned_required),
            "required_count": total_required,
            "present_core_required_count": present_core_required,
            "aligned_core_required_count": aligned_core_required,
            "core_required_count": total_core_required,
            "missing_core_count": missing_core_count,
            "missing_minor_count": missing_minor_count,
            "recommendation_type": _group_for_recipe(
                coverage_pct,
                missing_count,
                len(aligned_required),
                soft_floor_quantity_confirmation_count=quantity_confirmation_count,
                core_missing_count=missing_core_count,
                minor_missing_count=missing_minor_count,
                present_core_required_count=aligned_core_required,
                total_core_required_count=total_core_required,
            ),
            "decision_mode": resolved_mode.value,
            "simplicity": simplicity,
            "_missing_burden": missing_burden,
            "_shopping_missing_count": shopping_missing_count,
            "_shopping_missing_ingredients": list(missing_ingredients),
            "_quantity_confirmation_count": quantity_confirmation_count,
            "_quantity_confirmation_ingredients": quantity_confirmation_ingredients,
            "_missing_core_ingredients": missing_core_ingredients,
            "_missing_minor_ingredients": missing_minor_ingredients,
            "_unknown_quantity_ingredients": unknown_quantity_ingredients,
            "_soft_floor_quantity_confirmation_ingredients": soft_floor_quantity_confirmation_ingredients,
            "_family_match_quantity_confirmation_ingredients": family_match_quantity_confirmation_ingredients,
            "_family_match_count": len(family_match_quantity_confirmation_ingredients),
            "_family_match_details": family_match_details,
            "_behavior_points": behavior_points,
            "_behavior_details": behavior_details,
            "_use_soon_details": use_soon_details,
            "_mode_details": mode_details,
        }
        item = _build_recommendation_entry(recipe_item)
        grouped[recipe_item["recommendation_type"]].append(item)

    def sort_key(item: dict) -> tuple[int, int, int, float, float, int, float, float, str, int]:
        return _deterministic_sort_key(item, resolved_mode)

    grouped["cook_now"].sort(key=sort_key)
    grouped["almost_there"].sort(key=sort_key)
    grouped["not_worth_it"].sort(key=sort_key)

    ranked = _rank_best_tonight(
        grouped["cook_now"] + grouped["almost_there"] + grouped["not_worth_it"],
        resolved_mode,
    )

    return {
        "contract_version": "2026-04-05",
        "decision_mode": {
            "key": resolved_mode.value,
            "label": MODE_METADATA[resolved_mode]["label"],
            "description": MODE_METADATA[resolved_mode]["description"],
            "default": resolved_mode == DEFAULT_RECOMMENDATION_MODE,
        },
        "generated_from": {
            "pantry_items": sorted(pantry_norm),
            "pantry_count": len(pantry_norm),
        },
        "tie_break_rule": [
            "recommendation_type",
            "pantry_coverage_pct",
            "missing_burden",
            "missing_count",
            "mode_points",
            "use_soon_points",
            "hero_fatigue_points",
            "behavior_points",
            "estimated_time_minutes",
            "simplicity",
            "quality_score",
            "recipe_name",
            "recipe_id",
        ],
        "recommendation_status": ranked["recommendation_status"],
        "best_tonight": _public_item(ranked["best_tonight"]),
        "alternatives": [_public_item(item) for item in ranked["alternatives"]],
        "closest_options": [_public_item(item) for item in ranked["closest_options"]],
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


def _group_for_recipe(
    coverage_pct: int,
    missing_count: int,
    present_required_count: int,
    *,
    soft_floor_quantity_confirmation_count: int = 0,
    core_missing_count: int = 0,
    minor_missing_count: int = 0,
    present_core_required_count: int | None = None,
    total_core_required_count: int | None = None,
) -> str:
    if missing_count == 0 and soft_floor_quantity_confirmation_count == 0:
        return "cook_now"
    if soft_floor_quantity_confirmation_count > 0 and core_missing_count == 0:
        return "almost_there"
    if core_missing_count == 0 and minor_missing_count > 0 and present_required_count > 0:
        return "almost_there"
    if total_core_required_count and present_core_required_count == 0:
        return "not_worth_it"
    if present_required_count == 0:
        return "not_worth_it"
    if coverage_pct >= 50 or missing_count == 1:
        return "almost_there"
    return "not_worth_it"


def _tonight_score(recipe: dict) -> float:
    coverage_component = (recipe["pantry_coverage_pct"] / 100.0) * 0.55
    missing_component = _missing_burden_score(float(recipe.get("_missing_burden", recipe["missing_count"]))) * 0.25
    time_component = _time_score(recipe.get("estimated_time_minutes")) * 0.10
    simplicity_component = (float(recipe.get("simplicity", 1.0)) / 1.5) * 0.07
    quality_component = _quality_score_factor(recipe.get("quality_score")) * 0.03
    family_match_penalty = min(
        int(recipe.get("_family_match_count", 0)) * FAMILY_MATCH_SCORE_PENALTY,
        FAMILY_MATCH_SCORE_PENALTY * 2,
    )
    return round(
        max(
            coverage_component
            + missing_component
            + time_component
            + simplicity_component
            + quality_component
            - family_match_penalty,
            0.0,
        ),
        4,
    )


def _confidence_score(recipe: dict) -> float:
    group_bonus = {
        "cook_now": 0.1,
        "almost_there": 0.03,
        "not_worth_it": 0.0,
    }[recipe["recommendation_type"]]
    quantity_confirmation_penalty = min(int(recipe.get("_quantity_confirmation_count", 0)) * 0.18, 0.36)
    return round(max(min(_tonight_score(recipe) + group_bonus - quantity_confirmation_penalty, 1.0), 0.0), 4)


def _confidence_label(score: float) -> str:
    if score >= 0.85:
        return "high"
    if score >= 0.65:
        return "medium"
    return "low"


def _rank_best_tonight(
    items: list[dict],
    mode: RecommendationMode = DEFAULT_RECOMMENDATION_MODE,
) -> dict:
    ranked = sorted(items, key=lambda item: _deterministic_sort_key(item, mode))
    best_tonight = ranked[0] if ranked and _is_strong_match_candidate(ranked[0]) else None
    closest_options = ranked[1:4] if best_tonight is not None else ranked[:3]
    return {
        "recommendation_status": STRONG_MATCH_STATUS if best_tonight is not None else NO_STRONG_MATCH_STATUS,
        "best_tonight": best_tonight,
        "alternatives": closest_options,
        "closest_options": closest_options,
    }


def _deterministic_sort_key(
    item: dict,
    mode: RecommendationMode = DEFAULT_RECOMMENDATION_MODE,
) -> tuple[int, int, float, int, int, float, float, float, float, int, float, str, int]:
    recipe = item["recipe"]
    return (
        GROUP_PRIORITY[recipe["recommendation_type"]],
        -recipe["pantry_coverage_pct"],
        float(recipe.get("_missing_burden", recipe["missing_count"])),
        int(recipe.get("_shopping_missing_count", recipe["missing_count"])),
        int(recipe.get("_quantity_confirmation_count", 0)),
        -_mode_sort_points(recipe, mode),
        -float(recipe.get("_use_soon_details", {}).get("points", 0.0)),
        _hero_fatigue_sort_points(item),
        -_behavior_sort_points(item),
        recipe["estimated_time_minutes"] if recipe["estimated_time_minutes"] is not None else 9999,
        -float(recipe.get("simplicity", 1.0)),
        -(recipe["quality_score"] if recipe["quality_score"] is not None else -1),
        recipe["recipe_name"].lower(),
        recipe["recipe_id"],
    )


def _quality_score_factor(quality_score: int | None) -> float:
    if quality_score is None:
        return 0.4
    capped = max(0, min(int(quality_score), 30))
    return capped / 30.0


def _missing_burden_score(missing_burden: float) -> float:
    if missing_burden <= 0:
        return 1.0
    if missing_burden <= MINOR_REQUIRED_WEIGHT:
        return 0.9
    if missing_burden <= (MINOR_REQUIRED_WEIGHT * 2):
        return 0.78
    if missing_burden <= 1:
        return 0.55
    if missing_burden <= 2:
        return 0.2
    return 0.0


def _is_strong_match_candidate(item: dict) -> bool:
    recipe = item["recipe"]
    confidence_score = float(item["confidence_score"])
    blocking_count = int(recipe.get("missing_count", 0))

    if recipe["recommendation_type"] != "cook_now":
        return False
    if blocking_count != 0:
        return False
    if recipe["pantry_coverage_pct"] < 100:
        return False
    return confidence_score >= 0.72


def _behavior_sort_points(item: dict) -> float:
    recipe = item["recipe"]
    raw_points = float(recipe.get("_behavior_points", 0.0))
    if raw_points == 0:
        return 0.0

    if _is_strong_match_candidate(item):
        return round(
            max(
                min(raw_points, STRONG_MATCH_BEHAVIOR_MAX_POINTS),
                -STRONG_MATCH_BEHAVIOR_MAX_POINTS,
            ),
            3,
        )

    core_missing_count = int(recipe.get("missing_core_count", recipe["missing_count"]))
    missing_count = int(recipe.get("missing_count", 0))
    if recipe["recommendation_type"] != "almost_there":
        return 0.0
    if core_missing_count > 0 and missing_count > 1:
        return 0.0
    if recipe["pantry_coverage_pct"] < 50:
        return 0.0

    return round(
        max(min(raw_points, FALLBACK_BEHAVIOR_MAX_POINTS), -FALLBACK_BEHAVIOR_MAX_POINTS),
        3,
    )


def _hero_fatigue_sort_points(item: dict) -> float:
    recipe = item["recipe"]
    if recipe["recommendation_type"] == "not_worth_it":
        return 0.0

    recent_positive_event_count = int(recipe["_behavior_details"].get("recent_positive_event_count", 0))
    if recent_positive_event_count <= HERO_FATIGUE_EVENT_THRESHOLD:
        return 0.0

    return round(
        min(
            (recent_positive_event_count - HERO_FATIGUE_EVENT_THRESHOLD) * HERO_FATIGUE_POINTS_PER_EXTRA_EVENT,
            HERO_FATIGUE_MAX_POINTS,
        ),
        3,
    )


def _build_recommendation_entry(recipe: dict) -> dict:
    missing = recipe["missing_ingredients"]
    missing_count = recipe["missing_count"]
    shopping_missing = list(recipe.get("_shopping_missing_ingredients", missing))
    shopping_missing_count = int(recipe.get("_shopping_missing_count", len(shopping_missing)))
    time_minutes = recipe.get("estimated_time_minutes")
    confidence_score = _confidence_score(recipe)
    effective_behavior_points = _behavior_sort_points(
        {
            "recipe": recipe,
            "confidence_score": confidence_score,
        }
    )
    hero_fatigue_points = _hero_fatigue_sort_points(
        {
            "recipe": recipe,
            "confidence_score": confidence_score,
        }
    )
    missing_core = list(recipe.get("_missing_core_ingredients", []))
    missing_minor = list(recipe.get("_missing_minor_ingredients", []))
    unknown_quantity = list(recipe.get("_quantity_confirmation_ingredients", recipe.get("_unknown_quantity_ingredients", [])))
    family_match_details = list(recipe.get("_family_match_details", []))
    family_match_ingredients = list(recipe.get("_family_match_quantity_confirmation_ingredients", []))

    explanation_parts: list[str] = []
    if recipe["recommendation_type"] == "cook_now":
        explanation_parts.append("Every required ingredient is already in your pantry")
    else:
        explanation_parts.append(
            _missing_explanation(
                recipe["pantry_coverage_pct"],
                missing_core,
                missing_minor,
                unknown_quantity,
            )
        )

    if isinstance(time_minutes, int):
        explanation_parts.append(f"about {time_minutes} min")

    explanation_parts.append(f"{_confidence_label(confidence_score)} confidence")
    explanation = ". ".join(explanation_parts) + "."
    why_best = _why_best_message(recipe)

    if recipe["_use_soon_details"]["has_signal"]:
        explanation = f"{explanation} {_use_soon_explanation(recipe['_use_soon_details'])}"
    if effective_behavior_points != 0:
        explanation = f"{explanation} {_behavior_explanation(recipe['_behavior_details'])}"
    if recipe["_mode_details"]["applied"]:
        explanation = f"{explanation} {recipe['_mode_details']['explanation']}"
    if family_match_details:
        explanation = f"{explanation} {family_match_details[0]['message']}"

    return {
        "recipe": recipe,
        "explanation": explanation,
        "why_best": why_best,
        "recommendation_type": recipe["recommendation_type"],
        "confidence_score": confidence_score,
        "confidence_label": _confidence_label(confidence_score),
        "behavior": recipe["_behavior_details"],
        "score_breakdown": {
            "base_tonight_score": _tonight_score(recipe),
            "mode_key": recipe["_mode_details"]["key"],
            "mode_points": recipe["_mode_details"]["points"],
            "mode_applied": recipe["_mode_details"]["applied"],
            "use_soon_points": recipe["_use_soon_details"]["points"],
            "use_soon_applied": recipe["_use_soon_details"]["has_signal"],
            "hero_fatigue_points": hero_fatigue_points,
            "hero_fatigue_applied": hero_fatigue_points > 0,
            "behavior_points": effective_behavior_points,
            "behavior_applied": effective_behavior_points != 0,
        },
        "missing": {
            "count": missing_count,
            "ingredients": missing,
            "core_count": len(missing_core),
            "core_ingredients": missing_core,
            "minor_count": len(missing_minor),
            "minor_ingredients": missing_minor,
            "quantity_confirmation_count": len(unknown_quantity),
            "quantity_confirmation_ingredients": unknown_quantity,
            "family_match_count": len(family_match_ingredients),
            "family_match_ingredients": family_match_ingredients,
            "family_match_details": family_match_details,
            "summary": _missing_summary(
                shopping_missing_count,
                shopping_missing,
                unknown_quantity,
                family_match_ingredients,
            ),
        },
        "cta": {
            "type": "cook_recipe" if shopping_missing_count == 0 else "shop_missing_ingredients",
            "label": (
                "Cook This Tonight"
                if missing_count == 0
                else "View Recipe" if shopping_missing_count == 0 else _shopping_cta_label(shopping_missing_count)
            ),
            "pantry_ready": missing_count == 0,
            "internal_path": f"/recipes/{recipe['recipe_id']}",
            "affiliate_query": " ".join(shopping_missing),
            "missing_count": shopping_missing_count,
            "missing_ingredients": shopping_missing,
        },
        "tonight_score": _tonight_score(recipe),
    }


def _missing_summary(
    shopping_missing_count: int,
    shopping_missing_ingredients: list[str],
    soft_floor_quantity_confirmation_ingredients: list[str] | None = None,
    family_match_quantity_confirmation_ingredients: list[str] | None = None,
) -> str:
    quantity_confirmation = list(soft_floor_quantity_confirmation_ingredients or [])
    family_match_confirmation = list(family_match_quantity_confirmation_ingredients or [])
    confirmation_label = (
        "amount/type confirmation"
        if family_match_confirmation
        else "quantity confirmation"
    )

    if shopping_missing_count == 0 and not quantity_confirmation:
        return "No missing ingredients."
    if shopping_missing_count == 0:
        if len(quantity_confirmation) == 1:
            return f"Need {confirmation_label} for 1 ingredient: {quantity_confirmation[0]}."
        return (
            f"Need {confirmation_label} for {len(quantity_confirmation)} ingredients: "
            f"{', '.join(quantity_confirmation)}."
        )

    if shopping_missing_count == 1:
        missing_summary = f"Missing 1 ingredient: {shopping_missing_ingredients[0]}."
    else:
        missing_summary = (
            f"Missing {shopping_missing_count} ingredients: {', '.join(shopping_missing_ingredients)}."
        )

    if not quantity_confirmation:
        return missing_summary

    if len(quantity_confirmation) == 1:
        return (
            f"{missing_summary} Need {confirmation_label} for 1 ingredient: "
            f"{quantity_confirmation[0]}."
        )
    return (
        f"{missing_summary} Need {confirmation_label} for {len(quantity_confirmation)} ingredients: "
        f"{', '.join(quantity_confirmation)}."
    )


def _missing_explanation(
    coverage_pct: int,
    missing_core_ingredients: list[str],
    missing_minor_ingredients: list[str],
    unknown_quantity_ingredients: list[str] | None = None,
) -> str:
    unknown_quantity_ingredients = list(unknown_quantity_ingredients or [])
    core_missing_count = len(missing_core_ingredients)
    minor_missing_count = len(missing_minor_ingredients)
    unknown_quantity_count = len(unknown_quantity_ingredients)

    if core_missing_count == 0 and unknown_quantity_count == 1 and minor_missing_count == 1:
        return (
            f"{coverage_pct}% pantry-aligned coverage with 1 ingredient present but quantity still to confirm: "
            f"{unknown_quantity_ingredients[0]}"
        )
    if core_missing_count == 0 and unknown_quantity_count > 1 and minor_missing_count == unknown_quantity_count:
        return (
            f"{coverage_pct}% pantry-aligned coverage with {unknown_quantity_count} ingredients present but saved "
            "amounts still unconfirmed"
        )
    if core_missing_count == 0 and unknown_quantity_count > 0:
        return (
            f"{coverage_pct}% pantry-aligned coverage, but {unknown_quantity_count} ingredient"
            f"{'' if unknown_quantity_count == 1 else 's'} still need quantity confirmation"
        )

    if core_missing_count == 0 and minor_missing_count == 1:
        return (
            f"{coverage_pct}% practical pantry coverage with only 1 minor ingredient missing: "
            f"{missing_minor_ingredients[0]}"
        )
    if core_missing_count == 0 and minor_missing_count > 1:
        return (
            f"{coverage_pct}% practical pantry coverage with {minor_missing_count} minor ingredients still missing"
        )
    if core_missing_count == 1 and minor_missing_count == 0:
        return f"{coverage_pct}% pantry coverage with 1 core ingredient still missing: {missing_core_ingredients[0]}"
    if core_missing_count == 1 and minor_missing_count > 0:
        return (
            f"{coverage_pct}% pantry coverage with 1 core ingredient still missing: {missing_core_ingredients[0]}, "
            f"plus {minor_missing_count} minor finish items"
        )
    if core_missing_count > 1 and minor_missing_count == 0:
        return f"{coverage_pct}% pantry coverage with {core_missing_count} core ingredients still missing"
    if core_missing_count > 1 and minor_missing_count > 0:
        return (
            f"{coverage_pct}% pantry coverage with {core_missing_count} core ingredients still missing, "
            f"plus {minor_missing_count} minor finish items"
        )
    return f"{coverage_pct}% pantry coverage with missing ingredients still to pick up"


def _shopping_cta_label(missing_count: int) -> str:
    if missing_count == 1:
        return "Search Walmart for 1 missing ingredient"
    return f"Search Walmart for {missing_count} missing ingredients"


def _quick_start_floor_lookup(pantry_available: dict[str, object]) -> dict[str, list[str]]:
    index = quick_start_meal_floor_index()
    lookup: dict[str, list[str]] = defaultdict(list)
    for pantry_name, availability in pantry_available.items():
        if availability.quantity_is_known:
            continue
        if getattr(availability, "source", "") != PANTRY_SOURCE_QUICK_START:
            continue
        floor = index.match(pantry_name)
        if floor is None:
            continue
        lookup[floor.key].append(pantry_name)
    return lookup


def _is_soft_floor_covered(
    ingredient_name: str,
    required_quantity: float,
    required_unit: str,
    availability,
    quick_start_floor_lookup: dict[str, list[str]],
) -> bool:
    index = quick_start_meal_floor_index()

    if availability is not None and (
        availability.quantity_is_known or getattr(availability, "source", "") != PANTRY_SOURCE_QUICK_START
    ):
        return False

    floor = index.match(ingredient_name)
    if floor is None:
        return False
    if floor.key not in quick_start_floor_lookup:
        return False
    return floor.covers(required_quantity, required_unit)


def _is_beef_steak_family_presence_match(
    ingredient_name: str,
    pantry_available: dict[str, object],
) -> bool:
    if ingredient_name not in BEEF_STEAK_RANKING_FAMILY:
        return False
    return any(pantry_name in BEEF_STEAK_RANKING_FAMILY for pantry_name in pantry_available)


def _ingredient_importance(ingredient_name: str, notes: str | None) -> str:
    notes_text = (notes or "").strip().lower()
    ingredient_text = (ingredient_name or "").strip().lower()
    if any(keyword in notes_text for keyword in MINOR_REQUIRED_SIGNAL_KEYWORDS):
        return "minor"
    if ingredient_text in {"parsley", "cilantro", "scallion", "green onion", "chives"} and (
        "serve" in notes_text or "garnish" in notes_text or "finish" in notes_text
    ):
        return "minor"
    return "core"


def _required_weight_for_importance(importance: str) -> float:
    if importance == "minor":
        return MINOR_REQUIRED_WEIGHT
    return 1.0


def _public_item(item: dict | None) -> dict | None:
    if item is None:
        return None

    recipe = {
        key: value
        for key, value in item["recipe"].items()
        if not key.startswith("_")
    }
    return {
        "recipe": recipe,
        "explanation": item["explanation"],
        "why_best": item["why_best"],
        "recommendation_type": item["recommendation_type"],
        "confidence_score": item["confidence_score"],
        "confidence_label": item["confidence_label"],
        "behavior": item["behavior"],
        "score_breakdown": item["score_breakdown"],
        "missing": item["missing"],
        "cta": item["cta"],
        "tonight_score": item["tonight_score"],
    }


def _load_behavior_signals(db: Session, session_id: str = "anonymous") -> dict[str, dict]:
    recipe_scores: defaultdict[int, float] = defaultdict(float)
    recipe_event_counts: defaultdict[int, int] = defaultdict(int)
    recipe_recent_positive_counts: defaultdict[int, int] = defaultdict(int)
    ingredient_scores: defaultdict[str, float] = defaultdict(float)
    ingredient_event_counts: defaultdict[str, int] = defaultdict(int)

    action_rows = (
        db.query(UserAction.recipe_id, UserAction.event)
        .filter(UserAction.session_id == session_id)
        .filter(UserAction.recipe_id.is_not(None))
        .filter(UserAction.event.in_(tuple(EVENT_WEIGHTS.keys())))
        .order_by(UserAction.created_at.desc(), UserAction.id.desc())
        .limit(BEHAVIOR_ACTION_WINDOW)
        .all()
    )
    if not action_rows:
        return {
            "recipe_scores": recipe_scores,
            "recipe_event_counts": recipe_event_counts,
            "recipe_recent_positive_counts": recipe_recent_positive_counts,
            "ingredient_scores": ingredient_scores,
            "ingredient_event_counts": ingredient_event_counts,
        }

    positive_recipe_weights: defaultdict[int, float] = defaultdict(float)
    positive_recipe_event_counts: defaultdict[int, int] = defaultdict(int)

    for recipe_id, event in action_rows:
        if recipe_id is None:
            continue
        normalized_recipe_id = int(recipe_id)
        recipe_scores[normalized_recipe_id] += EVENT_WEIGHTS[event]
        recipe_event_counts[normalized_recipe_id] += 1
        if EVENT_WEIGHTS[event] > 0:
            recipe_recent_positive_counts[normalized_recipe_id] += 1
            positive_recipe_weights[normalized_recipe_id] += EVENT_WEIGHTS[event]
            positive_recipe_event_counts[normalized_recipe_id] += 1

    if positive_recipe_weights:
        ingredient_rows = (
            db.query(RecipeIngredient.recipe_id, Ingredient.canonical_name)
            .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
            .filter(RecipeIngredient.recipe_id.in_(tuple(positive_recipe_weights.keys())))
            .filter(RecipeIngredient.is_required.is_(True))
            .all()
        )
        for recipe_id, ingredient_name in ingredient_rows:
            if not ingredient_name:
                continue
            ingredient_scores[ingredient_name] += min(positive_recipe_weights[int(recipe_id)] * 0.03, 0.06)
            ingredient_event_counts[ingredient_name] += positive_recipe_event_counts[int(recipe_id)]

    return {
        "recipe_scores": recipe_scores,
        "recipe_event_counts": recipe_event_counts,
        "recipe_recent_positive_counts": recipe_recent_positive_counts,
        "ingredient_scores": ingredient_scores,
        "ingredient_event_counts": ingredient_event_counts,
    }


def _load_use_soon_items(db: Session, pantry_items: set[str], session_id: str = "anonymous") -> set[str]:
    if not pantry_items:
        return set()

    rows = (
        db.query(Ingredient.canonical_name)
        .join(PantryItem, PantryItem.ingredient_id == Ingredient.id)
        .filter(Ingredient.canonical_name.in_(sorted(pantry_items)))
        .filter(PantryItem.session_id == session_id)
        .filter(PantryItem.quantity > 0)
        .filter(PantryItem.use_soon.is_(True))
        .all()
    )
    return {name for (name,) in rows}


def _use_soon_details(present_required: list[str], use_soon_items: set[str]) -> dict:
    matched_items = sorted(name for name in present_required if name in use_soon_items)
    points = round(min(len(matched_items) * USE_SOON_POINTS_PER_MATCH, USE_SOON_MAX_POINTS), 3)
    return {
        "has_signal": bool(matched_items),
        "points": points,
        "matched_items": matched_items,
        "matched_count": len(matched_items),
    }


def _use_soon_explanation(details: dict) -> str:
    matched_items = details.get("matched_items", [])
    if len(matched_items) == 1:
        return f"Uses an item you marked as use soon: {matched_items[0]}."
    preview = ", ".join(matched_items[:2])
    if len(matched_items) > 2:
        preview = f"{preview}, and {len(matched_items) - 2} more"
    return f"Uses items you marked as use soon: {preview}."


def _behavior_points(
    *,
    recipe_id: int,
    required_ingredient_names: list[str],
    signals: dict[str, dict],
) -> float:
    recipe_scores: dict[int, float] = signals["recipe_scores"]
    direct_recipe_points = max(min(recipe_scores.get(recipe_id, 0.0) * 0.3, 1.2), -1.2)
    ingredient_affinity_points, _ = _ingredient_affinity_details(required_ingredient_names, signals)
    return round(direct_recipe_points + ingredient_affinity_points, 3)


def _behavior_details(
    *,
    recipe_id: int,
    required_ingredient_names: list[str],
    signals: dict[str, dict],
) -> dict:
    recipe_scores: dict[int, float] = signals["recipe_scores"]
    recipe_event_counts: dict[int, int] = signals.get("recipe_event_counts", {})
    recipe_recent_positive_counts: dict[int, int] = signals.get("recipe_recent_positive_counts", {})
    ingredient_affinity_points, ingredient_matches = _ingredient_affinity_details(required_ingredient_names, signals)

    direct_recipe_points = max(min(recipe_scores.get(recipe_id, 0.0) * 0.3, 1.2), -1.2)
    total_points = round(direct_recipe_points + ingredient_affinity_points, 3)
    return {
        "has_signal": total_points != 0,
        "points": total_points,
        "direct_recipe_points": round(direct_recipe_points, 3),
        "direct_recipe_event_count": recipe_event_counts.get(recipe_id, 0),
        "recent_positive_event_count": recipe_recent_positive_counts.get(recipe_id, 0),
        "ingredient_affinity_points": ingredient_affinity_points,
        "ingredient_matches": ingredient_matches,
        "positive_preference": direct_recipe_points > 0,
        "negative_preference": direct_recipe_points < 0,
        "signal_scope": "global_activity",
    }


def _ingredient_affinity_details(
    required_ingredient_names: list[str],
    signals: dict[str, dict],
) -> tuple[float, list[dict[str, float | int | str]]]:
    ingredient_scores: dict[str, float] = signals.get("ingredient_scores", {})
    ingredient_event_counts: dict[str, int] = signals.get("ingredient_event_counts", {})

    matches = [
        {
            "ingredient": ingredient_name,
            "points": round(float(ingredient_scores.get(ingredient_name, 0.0)), 3),
            "event_count": int(ingredient_event_counts.get(ingredient_name, 0)),
        }
        for ingredient_name in sorted(set(required_ingredient_names))
        if float(ingredient_scores.get(ingredient_name, 0.0)) > 0
    ]
    total_points = round(sum(float(match["points"]) for match in matches), 3)
    return total_points, matches


def _behavior_explanation(details: dict) -> str:
    if details.get("negative_preference"):
        return "Recent app-wide activity gave this recipe a small ranking penalty."
    if details.get("positive_preference"):
        return "Recent app-wide activity gave this recipe a small ranking boost."
    return "Recent app-wide activity slightly affected the ranking."


def _coerce_recommendation_mode(mode: RecommendationMode | str) -> RecommendationMode:
    if isinstance(mode, RecommendationMode):
        return mode
    return RecommendationMode(str(mode).strip().lower())


def _mode_sort_points(recipe: dict, mode: RecommendationMode) -> float:
    details = recipe.get("_mode_details")
    if isinstance(details, dict) and details.get("key") == mode.value:
        return float(details.get("points", 0.0))
    return float(_mode_details(
        recipe,
        recipe.get("present_required_count", 0),
        recipe.get("required_count", 0),
        mode,
    )["points"])


def _mode_details(
    recipe: dict,
    present_required_count: int,
    total_required: int,
    mode: RecommendationMode,
) -> dict:
    if mode == RecommendationMode.LOWEST_EFFORT:
        time_points = round(_time_score(recipe.get("total_time_minutes")) * 1.6, 3)
        simplicity_points = round((float(recipe.get("simplicity", 1.0)) / 1.5) * 1.6, 3)
        weeknight_bonus = 0.2 if recipe.get("is_weeknight_friendly") else 0.0
        beginner_bonus = 0.2 if recipe.get("is_beginner_friendly") else 0.0
        points = round(min(time_points + simplicity_points + weeknight_bonus + beginner_bonus, 3.5), 3)
        return {
            "key": mode.value,
            "points": points,
            "applied": points > 0,
            "explanation": "Lowest effort mode gave extra weight to shorter, simpler prep in a close call.",
        }

    if mode == RecommendationMode.USE_IT_UP_FIRST:
        if total_required <= 0:
            points = 0.0
        else:
            pantry_usage_ratio = present_required_count / total_required
            pantry_usage_points = min((present_required_count / 6.0) * 2.2, 2.2)
            coverage_points = pantry_usage_ratio * 1.1
            points = round(min(pantry_usage_points + coverage_points, 3.3), 3)
        return {
            "key": mode.value,
            "points": points,
            "applied": points > 0,
            "explanation": "Use it up first mode gave extra weight to recipes that use more of your saved pantry.",
        }

    return {
        "key": mode.value,
        "points": 0.0,
        "applied": False,
        "explanation": "",
    }


def _why_best_message(recipe: dict) -> str:
    reasons: list[str] = []
    missing_count = int(recipe.get("_shopping_missing_count", recipe["missing_count"]))
    quantity_confirmation_count = int(recipe.get("_quantity_confirmation_count", 0))
    time_minutes = recipe.get("estimated_time_minutes")
    simplicity = float(recipe.get("simplicity", 1.0))
    score_context = {
        "recipe": recipe,
        "confidence_score": _confidence_score(recipe),
    }
    effective_behavior_points = _behavior_sort_points(score_context)
    hero_fatigue_points = _hero_fatigue_sort_points(score_context)

    if recipe["missing_count"] == 0:
        reasons.append("it is ready from your pantry")
    elif missing_count == 0 and quantity_confirmation_count > 0:
        reasons.append(
            "it already fits your pantry once the saved quick-start amounts are confirmed"
        )
    elif missing_count == 1:
        reasons.append("it only needs 1 more ingredient")
    else:
        reasons.append(f"it still covers {recipe['pantry_coverage_pct']}% of the required ingredients")

    if isinstance(time_minutes, int):
        reasons.append(f"takes about {time_minutes} minutes")

    if simplicity >= 1.1:
        reasons.append("keeps the prep fairly simple")

    if effective_behavior_points > 0:
        reasons.append("recent app-wide activity gave it a small tie-break boost")
    if effective_behavior_points < 0:
        reasons.append("recent app-wide activity kept its ranking boost limited")
    if hero_fatigue_points > 0:
        reasons.append("repeat-hero pressure stayed bounded")
    if recipe["_use_soon_details"]["has_signal"]:
        reasons.append("it uses items you marked as use soon")
    if recipe["_mode_details"]["applied"] and recipe["decision_mode"] == RecommendationMode.LOWEST_EFFORT.value:
        reasons.append("lowest effort mode favored its shorter, simpler prep")
    if recipe["_mode_details"]["applied"] and recipe["decision_mode"] == RecommendationMode.USE_IT_UP_FIRST.value:
        reasons.append("use it up first mode favored how much of your pantry it uses")

    if len(reasons) == 1:
        return f"{recipe['recipe_name']} wins tonight because {reasons[0]}."

    return f"{recipe['recipe_name']} wins tonight because {', '.join(reasons[:-1])}, and {reasons[-1]}."
