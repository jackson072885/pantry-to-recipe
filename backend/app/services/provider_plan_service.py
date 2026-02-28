from __future__ import annotations

from app.services import pantry_service, search_service


ARCHETYPES = [
    {
        "archetype_id": "agile-buffer",
        "title": "Agile Buffer",
        "description": "Hold a light reserve and rotate quickly to reduce waste.",
        "trigger": "Use when volatility is low and substitutions are easy.",
    },
    {
        "archetype_id": "swap-and-stretch",
        "title": "Swap and Stretch",
        "description": "Trade scarce ingredients for adjacent options and extend portions.",
        "trigger": "Use when moderate scarcity appears across a small set of ingredients.",
    },
    {
        "archetype_id": "austerity-core",
        "title": "Austerity Core",
        "description": "Prioritize staple-heavy plans and defer premium ingredients.",
        "trigger": "Use when scarcity and cost pressure are both elevated.",
    },
]

SUBSTITUTION_MAP = {
    "eggs": "tofu",
    "milk": "oat milk",
    "butter": "olive oil",
    "beef": "chicken",
    "chicken": "beans",
    "rice": "pasta",
    "tomato": "canned tomato",
}


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return round(max(low, min(high, value)), 2)


def get_archetypes() -> list[dict]:
    return ARCHETYPES


def simulate_scarcity(db, payload) -> dict:
    pantry_items = pantry_service.list_pantry(db)
    pantry_names = {item["ingredient"].strip().lower() for item in pantry_items}
    known_ingredients = {
        name.strip().lower()
        for name in search_service.get_filter_options(db).get("ingredients", [])
    }

    requested = [item.strip().lower() for item in payload.ingredients if item.strip()]
    missing = sorted([item for item in requested if item not in known_ingredients])

    uncovered = 0
    substitutions = []
    for ingredient in missing:
        substitute = SUBSTITUTION_MAP.get(ingredient)
        if not substitute and pantry_names:
            substitute = sorted(pantry_names)[0]
        if substitute:
            substitutions.append({"ingredient": ingredient, "substitute": substitute})
        else:
            uncovered += 1

    risk_score = _clamp(
        (float(payload.scarcity_level) * 60.0)
        + (float(payload.budget_tightness) * 25.0)
        + (len(missing) * 6.5)
        + (uncovered * 5.0)
    )

    if risk_score < 35:
        archetype = "agile-buffer"
    elif risk_score < 65:
        archetype = "swap-and-stretch"
    else:
        archetype = "austerity-core"

    action_plan = [
        f"Prioritize {max(1, len(requested) - len(missing))} immediately available ingredients.",
        f"Apply {len(substitutions)} deterministic substitutions for missing items.",
        "Re-evaluate scarcity simulation after next pantry update.",
    ]

    return {
        "scenario_id": f"scarcity-{len(requested)}-{int(risk_score)}",
        "risk_score": risk_score,
        "recommended_archetype": archetype,
        "missing_ingredients": missing,
        "substitutions": substitutions,
        "action_plan": action_plan,
    }
