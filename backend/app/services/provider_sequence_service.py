from __future__ import annotations

import hashlib

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient
from app.services.normalize_service import STAPLES, normalize_item
from app.services.pantry_service import list_pantry
from app.services.recipe_dataset_service import production_recipe_query

_PROTEIN_TOKENS = {
    "chicken",
    "ground beef",
    "beef",
    "pork",
    "fish",
    "shrimp",
    "egg",
    "tuna",
    "beans",
    "black beans",
    "refried beans",
    "tofu",
    "sausage",
    "ham",
}

_FRAGILE_TOKENS = {
    "spinach",
    "lettuce",
    "fish",
    "shrimp",
    "tomato",
    "milk",
    "cream",
    "yogurt",
    "bread",
    "bell pepper",
}

_HEAVY_METHODS = {"oven", "slow_cooker"}
_LIGHT_METHODS = {"no_cook", "skillet", "air_fryer"}


def _normalize_pantry_items(raw_items: list[str], db: Session | None = None) -> list[str]:
    normalized = {
        item
        for item in (normalize_item(value, db) for value in raw_items)
        if item
    }
    return sorted(normalized)


def _load_current_pantry_items(db: Session) -> list[str]:
    return [str(row["ingredient"]) for row in list_pantry(db)]


def _deterministic_seed(pantry: list[str], payload) -> str:
    joined = "|".join(
        [
            ",".join(sorted(pantry)),
            str(payload.days),
            payload.household_band,
            payload.time_band,
            payload.budget_band,
            str(payload.allow_missing_max),
        ]
    )
    digest = hashlib.sha256(joined.encode("utf-8")).hexdigest()
    return digest[:16]


def _budget_penalty_weight(budget_band: str) -> float:
    if budget_band == "stretch":
        return 7.0
    if budget_band == "flexible":
        return 2.0
    return 4.5


def _time_target(time_band: str) -> int:
    if time_band == "quick":
        return 20
    if time_band == "i_got_time":
        return 45
    return 30


def _recipe_effort_level(total_time_minutes: int | None, cook_method: str | None) -> str:
    method = (cook_method or "").strip().lower()
    if method in _HEAVY_METHODS:
        return "heavy"
    if method in _LIGHT_METHODS:
        return "light"
    if total_time_minutes is None:
        return "medium"
    if total_time_minutes > 35:
        return "heavy"
    if total_time_minutes <= 20:
        return "light"
    return "medium"


def _recipe_archetype(name: str, cook_method: str | None) -> str:
    text = name.lower()
    method = (cook_method or "").lower()
    if "bowl" in text:
        return "bowl"
    if "taco" in text or "wrap" in text or "quesadilla" in text:
        return "wrap"
    if "sheet pan" in text or method == "oven":
        return "sheet_pan"
    if "pasta" in text or "noodle" in text:
        return "pasta"
    if method == "skillet":
        return "skillet"
    return "classic"


def _band_from_ratio(value: float) -> str:
    if value >= 0.75:
        return "high"
    if value >= 0.45:
        return "med"
    return "low"


def _build_candidate_pool(db: Session) -> list[dict]:
    rows = (
        db.query(
            Recipe.id,
            Recipe.name,
            Recipe.total_time_minutes,
            Recipe.cook_method,
            Ingredient.canonical_name,
            RecipeIngredient.is_required,
        )
        .select_from(Recipe)
        .join(RecipeIngredient, RecipeIngredient.recipe_id == Recipe.id)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .filter(*production_recipe_query(db)._where_criteria)
        .order_by(Recipe.id.asc(), Ingredient.canonical_name.asc())
        .all()
    )

    recipes_by_id: dict[int, dict] = {}
    for recipe_id, recipe_name, total_time, cook_method, ingredient_name, is_required in rows:
        entry = recipes_by_id.setdefault(
            recipe_id,
            {
                "recipe_id": recipe_id,
                "recipe_name": recipe_name,
                "total_time_minutes": total_time,
                "cook_method": cook_method,
                "required": set(),
                "optional": set(),
            },
        )
        if is_required:
            entry["required"].add(ingredient_name)
        else:
            entry["optional"].add(ingredient_name)

    candidates = []
    staple_set = set(STAPLES)
    for recipe in recipes_by_id.values():
        required_non_staples = set(recipe["required"]) - staple_set
        optional_non_staples = set(recipe["optional"]) - staple_set
        ingredient_union = required_non_staples | optional_non_staples
        has_protein = bool(ingredient_union & _PROTEIN_TOKENS)
        fragile_count = len(ingredient_union & _FRAGILE_TOKENS)

        candidates.append(
            {
                **recipe,
                "required_non_staples": required_non_staples,
                "optional_non_staples": optional_non_staples,
                "has_protein": has_protein,
                "fragile_count": fragile_count,
                "effort_level": _recipe_effort_level(recipe["total_time_minutes"], recipe["cook_method"]),
                "archetype": _recipe_archetype(recipe["recipe_name"], recipe["cook_method"]),
            }
        )
    return candidates


def build_meal_sequence(db: Session, payload) -> dict:
    provided_items = payload.pantry_items or _load_current_pantry_items(db)
    normalized_pantry = _normalize_pantry_items(provided_items, db)
    virtual_pantry = set(normalized_pantry)
    deterministic_seed = _deterministic_seed(normalized_pantry, payload)

    candidates = _build_candidate_pool(db)
    chosen_ids: set[int] = set()
    plan: list[dict] = []
    protein_day_count = 0
    no_protein_streak = 0
    previous_archetype = ""
    previous_effort = ""
    budget_penalty_weight = _budget_penalty_weight(payload.budget_band)
    time_target = _time_target(payload.time_band)

    for day_index in range(1, payload.days + 1):
        scored: list[dict] = []

        for candidate in candidates:
            if candidate["recipe_id"] in chosen_ids:
                continue

            required = candidate["required_non_staples"]
            optional = candidate["optional_non_staples"]
            denom = max(len(required), 1)

            present_required = len(required & virtual_pantry)
            missing_required = sorted(required - virtual_pantry)
            missing_count = len(missing_required)
            if missing_count > payload.allow_missing_max:
                continue

            pantry_overlap = round(present_required / denom, 3)
            optional_overlap = round(
                len(optional & virtual_pantry) / max(len(optional), 1), 3
            ) if optional else 0.0
            fragile_used = len((required | optional) & virtual_pantry & _FRAGILE_TOKENS)
            fragile_risk = max(len(virtual_pantry & _FRAGILE_TOKENS) - fragile_used, 0)
            has_protein = bool(candidate["has_protein"])
            protein_continuity = 0.0
            if has_protein and no_protein_streak >= 1:
                protein_continuity = 1.0
            elif not has_protein and no_protein_streak >= 1:
                protein_continuity = -1.0
            elif has_protein:
                protein_continuity = 0.4

            effort_penalty = 0.0
            if previous_archetype and previous_archetype == candidate["archetype"]:
                effort_penalty += 1.0
            if previous_effort == "heavy" and candidate["effort_level"] == "heavy":
                effort_penalty += 1.2

            total_time = candidate["total_time_minutes"]
            time_penalty = 0.0
            if isinstance(total_time, int):
                time_penalty = abs(total_time - time_target) / 20.0

            score = (
                pantry_overlap * 52.0
                + optional_overlap * 8.0
                + (2.5 if has_protein else 0.0)
                + (fragile_used * 1.8)
                + (protein_continuity * 2.2)
                - (missing_count * budget_penalty_weight)
                - (effort_penalty * 2.4)
                - (time_penalty * 1.5)
            )
            score = round(score, 3)

            scored.append(
                {
                    "candidate": candidate,
                    "score": score,
                    "missing_required": missing_required,
                    "missing_required_count": missing_count,
                    "pantry_overlap": pantry_overlap,
                    "fragile_risk": fragile_risk,
                    "fragile_used": fragile_used,
                }
            )

        if not scored:
            break

        scored.sort(
            key=lambda item: (
                -item["score"],
                item["missing_required_count"],
                -item["pantry_overlap"],
                item["fragile_risk"],
                item["candidate"]["recipe_id"],
            )
        )
        best = scored[0]
        candidate = best["candidate"]
        chosen_ids.add(candidate["recipe_id"])

        reasons: list[str] = [
            f"Uses {int(best['pantry_overlap'] * 100)}% of required pantry ingredients.",
            (
                "No required ingredients missing."
                if best["missing_required_count"] == 0
                else f"Missing only {best['missing_required_count']} required item(s)."
            ),
        ]
        if best["fragile_used"] > 0:
            reasons.append(f"Uses {best['fragile_used']} fragile ingredient(s) earlier to lower waste risk.")
        elif candidate["has_protein"]:
            reasons.append("Supports protein continuity so coverage stays stable through the week.")
        else:
            reasons.append("Balances effort and ingredient overlap for steady weeknight execution.")
        reasons = reasons[:3]

        plan.append(
            {
                "day_index": day_index,
                "recipe_id": candidate["recipe_id"],
                "recipe_name": candidate["recipe_name"],
                "confidence": round(min(max(best["score"] / 60.0, 0.0), 1.0), 3),
                "missing_required_count": best["missing_required_count"],
                "missing_required": best["missing_required"],
                "reasons": reasons,
            }
        )

        used_required = candidate["required_non_staples"] & virtual_pantry
        virtual_pantry -= used_required
        if candidate["has_protein"]:
            no_protein_streak = 0
            protein_day_count += 1
        else:
            no_protein_streak += 1
        previous_archetype = candidate["archetype"]
        previous_effort = candidate["effort_level"]

    planned_days = len(plan)
    coverage_ratio = (planned_days / payload.days) if payload.days else 0.0
    remaining_fragile = len(virtual_pantry & _FRAGILE_TOKENS)
    protein_ratio = (protein_day_count / planned_days) if planned_days else 0.0

    waste_band = "high" if remaining_fragile >= 4 else "med" if remaining_fragile >= 2 else "low"
    summary = {
        "coverage_band": _band_from_ratio(coverage_ratio),
        "waste_risk_band": waste_band,
        "protein_stability_band": _band_from_ratio(protein_ratio),
        "notes": [
            f"Planned {planned_days} of {payload.days} dinner slots with deterministic ranking.",
            f"Remaining fragile ingredient count after simulation: {remaining_fragile}.",
            f"Deterministic seed {deterministic_seed} built from normalized pantry and constraints.",
        ],
    }

    return {
        "plan": plan,
        "plan_summary": summary,
        "deterministic_seed": deterministic_seed,
    }
