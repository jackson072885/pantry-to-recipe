from __future__ import annotations


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


def build_supply_plan(payload) -> dict:
    pantry_set = {item.strip().lower() for item in payload.pantry_items if item.strip()}
    protein_count = len(pantry_set & _PROTEIN_INGREDIENTS)

    if protein_count >= 4:
        protein_exhaustion_day = min(payload.days_target, 7)
    elif protein_count >= 2:
        protein_exhaustion_day = min(payload.days_target, 5)
    else:
        protein_exhaustion_day = min(payload.days_target, 3)

    bottleneck_ingredient = "protein" if protein_count < 2 else "variety"

    scored = []
    for candidate in _CANDIDATES:
        if candidate["ingredient"] in pantry_set:
            continue
        score = _score(candidate, payload.budget_sensitivity)
        scored.append((candidate, score))

    scored.sort(
        key=lambda item: (
            -item[1],
            item[0]["cost"],
            item[0]["waste"],
            item[0]["ingredient"],
        )
    )

    top = scored[:3]
    recommendations = []
    for candidate, score in top:
        coverage_delta = min(candidate["coverage"], max(1, payload.days_target // 2))
        meals_unlocked = candidate["unlock"] + (1 if payload.household_band == "5_plus" else 0)
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

    return {
        "bottleneck_ingredient": bottleneck_ingredient,
        "protein_exhaustion_day": protein_exhaustion_day,
        "recommendations": recommendations,
        "generated_for_days": payload.days_target,
    }
