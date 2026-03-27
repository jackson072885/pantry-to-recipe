from __future__ import annotations

from collections import defaultdict
from typing import Callable

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient
from app.schemas.supply import SupplyPlanRequest
from app.services.normalize_service import normalize_item
from app.services.recipe_dataset_service import active_recipe_query


_CANDIDATES = [
    {"ingredient": "chicken", "coverage": 3, "unlock": 4, "waste": 1, "cost": 2, "protein": 4},
    {"ingredient": "ground beef", "coverage": 2, "unlock": 3, "waste": 1, "cost": 2, "protein": 4},
    {"ingredient": "eggs", "coverage": 2, "unlock": 3, "waste": 1, "cost": 1, "protein": 3},
    {"ingredient": "rice", "coverage": 2, "unlock": 3, "waste": 0, "cost": 1, "protein": 1},
    {"ingredient": "pasta", "coverage": 2, "unlock": 2, "waste": 0, "cost": 1, "protein": 1},
    {"ingredient": "tortilla", "coverage": 1, "unlock": 3, "waste": 1, "cost": 1, "protein": 1},
    {"ingredient": "onion", "coverage": 1, "unlock": 2, "waste": 2, "cost": 1, "protein": 0},
    {"ingredient": "potato", "coverage": 2, "unlock": 2, "waste": 1, "cost": 1, "protein": 1},
]

_PROTEIN_INGREDIENTS = {"chicken", "ground beef", "eggs", "beans", "fish", "pork", "tofu"}


def _spend_band(cost_index: int) -> str:
    if cost_index <= 1:
        return "$"
    if cost_index == 2:
        return "$$"
    return "$$$"


def _confidence(coverage_delta: int, unlock_delta: int) -> str:
    if coverage_delta >= 3 and unlock_delta >= 4:
        return "high"
    if coverage_delta >= 2 and unlock_delta >= 2:
        return "med"
    return "low"


def _budget_penalty(sensitivity: str) -> float:
    if sensitivity == "high":
        return 1.5
    if sensitivity == "low":
        return 0.6
    return 1.0


def _score(candidate: dict, budget_sensitivity: str) -> float:
    coverage = candidate["coverage"] * 0.45
    unlock = candidate["unlock"] * 0.3
    protein = candidate["protein"] * 0.2
    waste_penalty = candidate["waste"] * 0.15
    cost_penalty = candidate["cost"] * 0.1 * _budget_penalty(budget_sensitivity)
    return round(coverage + unlock + protein - waste_penalty - cost_penalty, 3)


def _normalize_items(items: list[str], db: Session | None = None) -> list[str]:
    normalized = {
        value
        for value in (normalize_item(item, db) for item in items if item and item.strip())
        if value
    }
    return sorted(normalized)


def _matches_name(name: str, normalized_values: set[str]) -> bool:
    lowered = name.strip().lower()
    normalized = normalize_item(name) or lowered
    return lowered in normalized_values or normalized in normalized_values


def _candidate_rows(
    pantry_set: set[str],
    budget_sensitivity: str,
    candidate_list: list[dict] | None = None,
    score_override: Callable[[dict, str], float] | None = None,
) -> list[tuple[dict, float]]:
    scored = []
    for candidate in candidate_list or _CANDIDATES:
        if candidate["ingredient"] in pantry_set:
            continue
        scorer = score_override or _score
        score = scorer(candidate, budget_sensitivity)
        scored.append((candidate, score))
    scored.sort(
        key=lambda item: (
            -item[1],
            item[0]["cost"],
            item[0]["waste"],
            item[0]["ingredient"],
        )
    )
    return scored


def _recommendations_from_rows(rows: list[tuple[dict, float]], days_target: int, household_band: str) -> list[dict]:
    top = rows[:3]
    recommendations = []
    for candidate, score in top:
        coverage_delta = min(candidate["coverage"], max(1, days_target // 2))
        meals_unlocked = candidate["unlock"] + (1 if household_band == "5_plus" else 0)
        recommendations.append(
            {
                "ingredient": candidate["ingredient"],
                "score": score,
                "coverage_delta_days": coverage_delta,
                "meals_unlocked": meals_unlocked,
                "estimated_spend_band": _spend_band(candidate["cost"]),
                "confidence": _confidence(coverage_delta, meals_unlocked),
                "notes": [
                    f"Improves coverage by about {coverage_delta} day(s).",
                    f"Unlocks roughly {meals_unlocked} additional meals.",
                    "Ranked with deterministic balanced-blend weighting.",
                ],
            }
        )
    return recommendations


def _build_plan(
    pantry_items: list[str],
    household_band: str,
    days_target: int,
    budget_sensitivity: str,
    candidate_list: list[dict] | None = None,
    score_override: Callable[[dict, str], float] | None = None,
) -> dict:
    pantry_set = set(_normalize_items(pantry_items))
    protein_count = len(pantry_set & _PROTEIN_INGREDIENTS)

    if protein_count >= 4:
        protein_exhaustion_day = min(days_target, 7)
    elif protein_count >= 2:
        protein_exhaustion_day = min(days_target, 5)
    else:
        protein_exhaustion_day = min(days_target, 3)

    bottleneck_ingredient = "protein" if protein_count < 2 else "variety"
    scored = _candidate_rows(
        pantry_set=pantry_set,
        budget_sensitivity=budget_sensitivity,
        candidate_list=candidate_list,
        score_override=score_override,
    )
    recommendations = _recommendations_from_rows(
        rows=scored,
        days_target=days_target,
        household_band=household_band,
    )

    return {
        "bottleneck_ingredient": bottleneck_ingredient,
        "protein_exhaustion_day": protein_exhaustion_day,
        "recommendations": recommendations,
        "generated_for_days": days_target,
    }


def build_supply_plan(payload) -> dict:
    return _build_plan(
        pantry_items=payload.pantry_items,
        household_band=payload.household_band,
        days_target=payload.days_target,
        budget_sensitivity=payload.budget_sensitivity,
    )


def _load_recipe_maps(db: Session) -> tuple[dict[str, set[str]], dict[str, int]]:
    rows = (
        db.query(Recipe.name, Ingredient.canonical_name, RecipeIngredient.is_required)
        .select_from(Recipe)
        .join(RecipeIngredient, RecipeIngredient.recipe_id == Recipe.id)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .filter(*active_recipe_query(db)._where_criteria)
        .order_by(Recipe.id.asc(), Ingredient.canonical_name.asc())
        .all()
    )
    required_by_recipe: dict[str, set[str]] = defaultdict(set)
    usage_count: dict[str, int] = defaultdict(int)
    for recipe_name, ingredient_name, is_required in rows:
        if not is_required:
            continue
        ingredient = normalize_item(ingredient_name)
        if not ingredient:
            continue
        required_by_recipe[recipe_name].add(ingredient)
        usage_count[ingredient] += 1
    return required_by_recipe, dict(usage_count)


def _unlock_map(required_by_recipe: dict[str, set[str]], pantry_set: set[str], candidate_items: list[str]) -> dict[str, list[str]]:
    unlocks: dict[str, list[str]] = {item: [] for item in candidate_items}
    for recipe_name, required in required_by_recipe.items():
        missing = sorted(required - pantry_set)
        if len(missing) == 1 and missing[0] in unlocks:
            unlocks[missing[0]].append(recipe_name)
    for key in unlocks:
        unlocks[key] = sorted(unlocks[key])[:5]
    return unlocks


def _item_reason(item: str, unlock_count: int, usage_count: int, protein: bool, cost: int) -> str:
    if protein:
        return "Protein anchor"
    if cost <= 1 and usage_count >= 6:
        return "Staple filler to stretch days"
    if unlock_count > 0:
        return f"Unlocks {unlock_count} recipes you're closest to"
    return f"Used across {usage_count} high-confidence meals"


def _plan_explanation(plan: dict, unlocks: dict[str, list[str]], usage_count: dict[str, int]) -> dict:
    item_reasons = []
    for row in plan.get("recommendations", []):
        item = row["ingredient"]
        unlock_list = unlocks.get(item, [])
        usage = usage_count.get(item, 0)
        candidate = next((c for c in _CANDIDATES if c["ingredient"] == item), None)
        is_protein = bool(candidate and candidate["ingredient"] in _PROTEIN_INGREDIENTS)
        cost = int(candidate["cost"]) if candidate else 2
        reason = _item_reason(
            item=item,
            unlock_count=len(unlock_list),
            usage_count=usage,
            protein=is_protein,
            cost=cost,
        )
        item_reasons.append(
            {
                "item": item,
                "reason": reason,
                "unlocks": unlock_list,
                "estimated_meals_unlocked": int(row.get("meals_unlocked", 0)),
            }
        )

    summary = (
        f"Prioritizes {len(plan.get('recommendations', []))} items for "
        f"{plan.get('generated_for_days', 0)} day coverage with deterministic scoring."
    )
    return {"summary": summary, "item_reasons": item_reasons}


def _budget_sensitivity_from(goal: str, budget: float | None) -> str:
    if goal == "stretch":
        return "high"
    if goal == "protein":
        return "low"
    if budget is None:
        return "normal"
    if budget <= 8:
        return "high"
    if budget <= 14:
        return "normal"
    return "low"


def _score_cheapest(candidate: dict, budget_sensitivity: str) -> float:
    return round(_score(candidate, budget_sensitivity) - (candidate["cost"] * 0.35), 3)


def _score_protein(candidate: dict, budget_sensitivity: str) -> float:
    protein_bonus = 1.5 if candidate["ingredient"] in _PROTEIN_INGREDIENTS else 0.0
    return round(_score(candidate, budget_sensitivity) + protein_bonus, 3)


def _score_unlock_max(candidate: dict, budget_sensitivity: str, unlock_scores: dict[str, int]) -> float:
    unlock_bonus = unlock_scores.get(candidate["ingredient"], 0) * 0.35
    return round(_score(candidate, budget_sensitivity) + unlock_bonus, 3)


def _deltas(baseline: dict, alternative: dict) -> dict:
    base_items = [row["ingredient"] for row in baseline.get("recommendations", [])]
    alt_items = [row["ingredient"] for row in alternative.get("recommendations", [])]
    base_set = set(base_items)
    alt_set = set(alt_items)
    added = sorted(alt_set - base_set)
    removed = sorted(base_set - alt_set)
    swaps = [f"{left} -> {right}" for left, right in zip(sorted(removed), sorted(added))]
    return {
        "added": added,
        "removed": removed,
        "swapped": swaps,
    }


def build_supply_simulation(db: Session, payload) -> dict:
    pantry = _normalize_items(payload.pantry, db)
    locked = {item.strip().lower() for item in payload.locked_items if item and item.strip()}
    locked.update(_normalize_items(payload.locked_items, db))
    excluded = {item.strip().lower() for item in payload.excluded_items if item and item.strip()}
    excluded.update(_normalize_items(payload.excluded_items, db))
    locked -= excluded

    budget_sensitivity = _budget_sensitivity_from(payload.goal, payload.budget)
    base_request = SupplyPlanRequest(
        pantry_items=pantry,
        household_band="3_4",
        days_target=payload.days,
        budget_sensitivity=budget_sensitivity,
    )
    baseline = build_supply_plan(base_request)

    required_by_recipe, usage_scores = _load_recipe_maps(db)
    unlocked_by_item = _unlock_map(required_by_recipe, set(pantry), [c["ingredient"] for c in _CANDIDATES])
    unlock_scores = {item: len(names) for item, names in unlocked_by_item.items()}

    allowed_candidates = [
        c
        for c in _CANDIDATES
        if not _matches_name(c["ingredient"], excluded)
    ]
    if locked:
        # Ensure locked items are possible by placing them first via score boost.
        def score_with_locked(candidate: dict, sensitivity: str) -> float:
            boost = 3.0 if _matches_name(candidate["ingredient"], locked) else 0.0
            return round(_score(candidate, sensitivity) + boost, 3)
    else:
        score_with_locked = _score

    baseline_overridden = _build_plan(
        pantry_items=pantry,
        household_band="3_4",
        days_target=payload.days,
        budget_sensitivity=budget_sensitivity,
        candidate_list=allowed_candidates,
        score_override=score_with_locked,
    )

    baseline_explanation = _plan_explanation(baseline_overridden, unlocked_by_item, usage_scores)

    def build_alt(score_fn) -> dict:
        def wrapped(candidate: dict, sensitivity: str) -> float:
            base_score = score_fn(candidate, sensitivity)
            if _matches_name(candidate["ingredient"], locked):
                return round(base_score + 3.0, 3)
            return base_score

        return _build_plan(
            pantry_items=pantry,
            household_band="3_4",
            days_target=payload.days,
            budget_sensitivity=budget_sensitivity,
            candidate_list=allowed_candidates,
            score_override=wrapped,
        )

    variants = [
        ("cheapest_fillers", _score_cheapest),
        ("protein_forward", _score_protein),
        ("unlock_max", lambda c, s: _score_unlock_max(c, s, unlock_scores)),
    ]

    alternatives = []
    seen_signatures = {tuple(row["ingredient"] for row in baseline_overridden.get("recommendations", []))}
    for _name, scorer in variants:
        alt_plan = build_alt(scorer)
        signature = tuple(row["ingredient"] for row in alt_plan.get("recommendations", []))
        if not signature or signature in seen_signatures:
            continue
        delta = _deltas(baseline_overridden, alt_plan)
        if not delta["added"] and not delta["removed"] and not delta["swapped"]:
            continue
        seen_signatures.add(signature)
        alternatives.append({"plan": alt_plan, "deltas": delta, "explanation": _plan_explanation(alt_plan, unlocked_by_item, usage_scores)})

    if 0 < len(alternatives) < 2:
        alternatives = []

    return {
        "baseline_plan": baseline_overridden if excluded or locked else baseline,
        "baseline_explanation": baseline_explanation,
        "alternatives": alternatives[:4],
    }
