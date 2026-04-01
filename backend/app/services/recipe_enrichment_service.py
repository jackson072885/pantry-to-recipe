from __future__ import annotations

import json
import re
from typing import Any


QUALITY_BUCKETS = (
    "KEEP_AS_IS",
    "KEEP_AND_ENRICH",
    "KEEP_BUT_FLAG_FOR_REVIEW",
    "REMOVE_AS_JUNK",
    "MERGE_WITH_DUPLICATE",
)

WEAK_TITLES = {
    "classic blt",
    "simple ramen upgrade",
    "classic mac and cheese",
    "one-pan sausage peppers",
}

WEAK_ROWS = {
    2,
    5,
    8,
    13,
    19,
    20,
    21,
    22,
    23,
    25,
    32,
    34,
    35,
    38,
    45,
    47,
    50,
}

INGREDIENT_PROFILES: dict[str, dict[str, Any]] = {
    "egg": {"display_quantity": 2.0, "display_unit": "large eggs"},
    "bread": {"display_quantity": 4.0, "display_unit": "slices"},
    "butter": {"display_quantity": 2.0, "display_unit": "tbsp"},
    "cheddar": {"display_quantity": 1.0, "display_unit": "cup", "display_name": "shredded cheddar"},
    "mozzarella": {"display_quantity": 1.0, "display_unit": "cup", "display_name": "shredded mozzarella"},
    "parmesan": {"display_quantity": 0.5, "display_unit": "cup", "display_name": "grated parmesan"},
    "rice": {"display_quantity": 1.0, "display_unit": "cup", "display_name": "uncooked rice"},
    "pasta": {"display_quantity": 8.0, "display_unit": "oz", "display_name": "dried pasta"},
    "tomato sauce": {"display_quantity": 1.5, "display_unit": "cups"},
    "garlic": {"display_quantity": 2.0, "display_unit": "cloves", "prep_state": "minced"},
    "onion": {"display_quantity": 1.0, "display_unit": "small", "prep_state": "diced"},
    "green onion": {"display_quantity": 2.0, "display_unit": "stalks", "prep_state": "sliced"},
    "bell pepper": {"display_quantity": 1.0, "display_unit": "medium", "prep_state": "sliced"},
    "carrot": {"display_quantity": 2.0, "display_unit": "medium", "prep_state": "diced"},
    "potato": {"display_quantity": 2.0, "display_unit": "medium", "prep_state": "cubed"},
    "sweet potato": {"display_quantity": 2.0, "display_unit": "medium", "prep_state": "cubed"},
    "lettuce": {"display_quantity": 2.0, "display_unit": "cups", "prep_state": "shredded"},
    "spinach": {"display_quantity": 2.0, "display_unit": "cups"},
    "broccoli": {"display_quantity": 3.0, "display_unit": "cups", "display_name": "broccoli florets"},
    "green beans": {"display_quantity": 12.0, "display_unit": "oz", "prep_state": "trimmed"},
    "cabbage": {"display_quantity": 2.0, "display_unit": "cups", "prep_state": "shredded"},
    "cucumber": {"display_quantity": 1.0, "display_unit": "medium", "prep_state": "sliced"},
    "corn": {"display_quantity": 1.0, "display_unit": "cup"},
    "beans": {"display_quantity": 1.0, "display_unit": "can", "prep_state": "drained"},
    "black beans": {"display_quantity": 1.0, "display_unit": "can", "prep_state": "drained"},
    "chickpeas": {"display_quantity": 1.0, "display_unit": "can", "prep_state": "drained"},
    "lentils": {"display_quantity": 1.0, "display_unit": "cup"},
    "chicken": {"display_quantity": 1.0, "display_unit": "lb", "display_name": "boneless chicken", "prep_state": "bite-size pieces"},
    "ground turkey": {"display_quantity": 1.0, "display_unit": "lb"},
    "ground beef": {"display_quantity": 1.0, "display_unit": "lb"},
    "beef": {"display_quantity": 1.0, "display_unit": "lb", "prep_state": "thinly sliced"},
    "pork": {"display_quantity": 1.0, "display_unit": "lb", "prep_state": "bite-size pieces"},
    "fish": {"display_quantity": 1.0, "display_unit": "lb", "display_name": "white fish fillets"},
    "salmon": {"display_quantity": 1.0, "display_unit": "lb", "display_name": "salmon fillets"},
    "tilapia": {"display_quantity": 1.0, "display_unit": "lb", "display_name": "tilapia fillets"},
    "cod": {"display_quantity": 1.0, "display_unit": "lb", "display_name": "cod fillets"},
    "catfish": {"display_quantity": 1.0, "display_unit": "lb", "display_name": "catfish fillets"},
    "bass": {"display_quantity": 1.0, "display_unit": "lb", "display_name": "bass fillets"},
    "shrimp": {"display_quantity": 1.0, "display_unit": "lb", "prep_state": "peeled"},
    "tofu": {"display_quantity": 14.0, "display_unit": "oz", "display_name": "firm tofu", "prep_state": "cubed"},
    "tuna": {"display_quantity": 2.0, "display_unit": "cans", "prep_state": "drained"},
    "ham": {"display_quantity": 0.5, "display_unit": "cup", "prep_state": "diced"},
    "bacon": {"display_quantity": 6.0, "display_unit": "slices"},
    "sausage": {"display_quantity": 12.0, "display_unit": "oz", "prep_state": "sliced"},
    "tortilla": {"display_quantity": 4.0, "display_unit": "small tortillas"},
    "ramen": {"display_quantity": 1.0, "display_unit": "pack"},
    "milk": {"display_quantity": 1.0, "display_unit": "cup"},
    "cream": {"display_quantity": 0.75, "display_unit": "cup"},
    "soy sauce": {"display_quantity": 2.0, "display_unit": "tbsp"},
    "oil": {"display_quantity": 1.0, "display_unit": "tbsp"},
    "olive oil": {"display_quantity": 1.0, "display_unit": "tbsp"},
    "salsa": {"display_quantity": 0.5, "display_unit": "cup"},
    "pesto": {"display_quantity": 0.33, "display_unit": "cup"},
    "coconut milk": {"display_quantity": 1.0, "display_unit": "cup"},
}


def ingredient_aliases(name: str) -> list[str]:
    aliases: set[str] = set()
    if name == "egg":
        aliases.add("eggs")
    if name == "green onion":
        aliases.update({"green onions", "scallion"})
    if name == "bell pepper":
        aliases.update({"bell peppers", "pepper"})
    if name == "tomato sauce":
        aliases.add("marinara")
    return sorted(aliases)


def build_enriched_recipe(row: dict[str, Any], row_number: int = 0) -> dict[str, Any]:
    name = str(row.get("name", "")).strip()
    required = _normalize_names(row.get("required", []))
    optional = _normalize_names(row.get("optional", []))
    cook_method = str(row.get("cook_method") or "stovetop").strip().lower()
    meal_type = _infer_meal_type(name)
    quality_bucket = _quality_bucket(name, row_number)
    reason = "missing_structured_quantities_and_units"
    if _normalize(name) == "roasted potatoes":
        reason = "side_dish_not_strong_dinner_candidate"
    elif quality_bucket == "KEEP_BUT_FLAG_FOR_REVIEW":
        reason = "needs_manual_review_for_product_value_or_step_quality"

    ingredient_rows: list[dict[str, Any]] = []
    for idx, ingredient_name in enumerate(required + optional, start=1):
        profile = INGREDIENT_PROFILES.get(ingredient_name, {})
        display_quantity = float(profile.get("display_quantity") or 1.0)
        display_unit = str(profile.get("display_unit") or "ea")
        display_name = str(profile.get("display_name") or ingredient_name)
        required_quantity, unit, has_safe_default = _canonical_requirement(profile)
        ingredient_rows.append(
            {
                "canonical_name": ingredient_name,
                "aliases": ingredient_aliases(ingredient_name),
                "is_required": ingredient_name in required,
                "required_quantity": required_quantity if ingredient_name in required else 0.0,
                "unit": unit,
                "display_quantity": display_quantity,
                "display_unit": display_unit,
                "display_name": display_name,
                "pantry_name": ingredient_name,
                "prep_state": profile.get("prep_state"),
                "notes": "Practical default amount for the listed servings." if has_safe_default else "Fallback estimated amount; exact quantity is not stored in the current dataset.",
                "sort_order": idx,
                "measurement_is_estimated": not has_safe_default,
            }
        )

    return {
        "name": name,
        "short_description": _summary(name, required, meal_type, cook_method),
        "instructions": str(row.get("instructions") or "").strip(),
        "cook_method": cook_method,
        "prep_time_minutes": row.get("prep_time_minutes"),
        "cook_time_minutes": row.get("cook_time_minutes"),
        "total_time_minutes": row.get("total_time_minutes"),
        "oven_temp_f": row.get("oven_temp_f"),
        "air_fryer_temp_f": row.get("air_fryer_temp_f"),
        "servings": int(row.get("servings") or 2),
        "difficulty": _difficulty(row, required),
        "primary_method": cook_method,
        "primary_protein": _primary_protein(required),
        "cuisine": row.get("cuisine") or _cuisine(name),
        "cleanup_score": None,
        "prep_complexity": "simple" if (row.get("total_time_minutes") or 0) <= 30 else "moderate",
        "meal_type": meal_type,
        "equipment_json": json.dumps(_equipment(cook_method)),
        "substitutions_json": json.dumps(_substitutions(required)),
        "tips_json": json.dumps(_tips(required, cook_method)),
        "warnings_json": json.dumps(_warnings(required, cook_method)),
        "storage_json": json.dumps([_storage(meal_type)]),
        "tags_json": json.dumps(_tags(name, required, cook_method, meal_type)),
        "quality_score": _quality_score(name, row_number),
        "quality_bucket": quality_bucket,
        "quality_reason": reason,
        "review_status": "needs_editor_review" if quality_bucket == "KEEP_BUT_FLAG_FOR_REVIEW" else "approved",
        "is_production_ready": quality_bucket != "KEEP_BUT_FLAG_FOR_REVIEW",
        "is_weeknight_friendly": bool((row.get("total_time_minutes") or 0) <= 35 and meal_type == "dinner"),
        "is_beginner_friendly": bool(cook_method in {"skillet", "stovetop", "no_cook"} and len(required) <= 4 and row_number not in WEAK_ROWS),
        "ingredients": ingredient_rows,
        "steps": _steps(row, name, cook_method),
    }


def score_recipe(row: dict[str, Any]) -> dict[str, Any]:
    name = str(row.get("name", "")).strip()
    ingredients = row.get("ingredients") or []
    steps = row.get("steps") or []
    title_quality = 8 if _normalize(name) in WEAK_TITLES else 15
    ingredient_quality = 20 if ingredients else 5
    step_quality = 25 if len(steps) >= 3 else 16 if len(steps) == 2 else 8
    trust = 18 if ingredients and steps else 8
    product_value = 10 if row.get("meal_type") == "dinner" else 4
    hygiene = 10
    total = title_quality + ingredient_quality + step_quality + trust + product_value + hygiene
    if _normalize(name) in WEAK_TITLES or _normalize(name) == "roasted potatoes":
        bucket = "KEEP_BUT_FLAG_FOR_REVIEW"
        review_status = "needs_editor_review"
        is_production_ready = True
    else:
        bucket = "KEEP_AS_IS" if total >= 90 else "KEEP_AND_ENRICH" if total >= 60 else "KEEP_BUT_FLAG_FOR_REVIEW"
        review_status = "approved" if bucket in {"KEEP_AS_IS", "KEEP_AND_ENRICH"} else "needs_editor_review"
        is_production_ready = True
    return {
        "quality_score": total,
        "quality_bucket": bucket,
        "quality_reason": "derived_from_recipe_shape",
        "review_status": review_status,
        "is_production_ready": is_production_ready,
    }


def find_duplicate_pairs(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    duplicates: list[dict[str, Any]] = []
    for row in rows:
        key = _normalize(str(row.get("name", "")))
        if key in seen:
            duplicates.append(
                {
                    "primary_recipe_id": seen[key].get("id"),
                    "duplicate_recipe_id": row.get("id"),
                    "reason": "normalized_title_match",
                }
            )
            continue
        seen[key] = row
    return duplicates


def _normalize_names(values: Any) -> list[str]:
    return [str(value).strip().lower() for value in values or [] if str(value).strip()]


def _canonical_requirement(profile: dict[str, Any]) -> tuple[float, str, bool]:
    quantity = profile.get("display_quantity")
    unit = str(profile.get("display_unit") or "").strip().lower()

    if quantity is None or not unit:
        return 1.0, "ea", False

    if unit in {"large eggs", "small tortillas", "slices", "slice", "cloves", "clove", "stalks", "stalk", "cans", "can", "pack", "packs", "medium", "small"}:
        return float(quantity), "ea", True

    if unit in {"cup", "cups", "tbsp", "tsp", "oz", "lb"}:
        canonical_unit = unit[:-1] if unit.endswith("s") and unit not in {"tbsp", "tsp"} else unit
        return float(quantity), canonical_unit, True

    return 1.0, "ea", False


def _normalize(value: str) -> str:
    lowered = re.sub(r"[^a-z0-9\s]", " ", value.lower())
    return re.sub(r"\s+", " ", lowered).strip()


def _summary(name: str, required: list[str], meal_type: str, cook_method: str) -> str:
    anchor = ", ".join(required[:3])
    return f"A practical {meal_type} built around {anchor} using a {cook_method.replace('_', ' ')} approach."


def _infer_meal_type(name: str) -> str:
    return "dinner"


def _quality_bucket(name: str, row_number: int) -> str:
    if _normalize(name) in WEAK_TITLES or _normalize(name) == "roasted potatoes":
        return "KEEP_BUT_FLAG_FOR_REVIEW"
    return "KEEP_AND_ENRICH"


def _quality_score(name: str, row_number: int) -> int:
    return 58 if _quality_bucket(name, row_number) == "KEEP_BUT_FLAG_FOR_REVIEW" else 72


def _difficulty(row: dict[str, Any], required: list[str]) -> str:
    total_time = row.get("total_time_minutes") or 0
    if total_time <= 25 and len(required) <= 4:
        return "Easy"
    if total_time >= 40:
        return "Moderate"
    return "Easy"


def _primary_protein(required: list[str]) -> str | None:
    proteins = {"chicken", "ground turkey", "ground beef", "beef", "pork", "fish", "salmon", "tilapia", "cod", "catfish", "bass", "shrimp", "tofu", "egg", "tuna", "sausage", "ham", "bacon"}
    for item in required:
        if item in proteins:
            return item
    return None


def _cuisine(name: str) -> str | None:
    lowered = _normalize(name)
    if any(token in lowered for token in ("taco", "quesadilla", "burrito")):
        return "Tex-Mex"
    if any(token in lowered for token in ("alfredo", "ziti", "parmesan", "pesto")):
        return "Italian-inspired"
    if any(token in lowered for token in ("fried rice", "stir fry", "ramen")):
        return "Asian-inspired"
    if "curry" in lowered:
        return "Indian-inspired"
    return None


def _equipment(cook_method: str) -> list[str]:
    if cook_method == "oven":
        return ["oven", "sheet pan"]
    if cook_method == "air_fryer":
        return ["air fryer"]
    if cook_method == "skillet":
        return ["skillet"]
    if cook_method == "no_cook":
        return ["mixing bowl"]
    return ["pot"]


def _tips(required: list[str], cook_method: str) -> list[str]:
    tips = ["Taste before serving and adjust seasoning at the end if needed."]
    if cook_method in {"skillet", "stovetop"}:
        tips.append("Prep the ingredients before you heat the pan so dinner comes together quickly.")
    if "rice" in required or "pasta" in required:
        tips.append("Start the starch early so the rest of dinner finishes on time.")
    return tips[:3]


def _substitutions(required: list[str]) -> list[str]:
    substitutions: list[str] = []
    if "cheddar" in required:
        substitutions.append("Monterey Jack or mozzarella can replace cheddar.")
    if "pasta" in required:
        substitutions.append("Any short pasta shape works here.")
    if "rice" in required:
        substitutions.append("Use leftover cooked rice for a faster version.")
    return substitutions[:2]


def _warnings(required: list[str], cook_method: str) -> list[str]:
    warnings: list[str] = []
    if any(item in required for item in ("chicken", "ground turkey", "ground beef", "beef", "pork", "fish", "salmon", "tilapia", "cod", "catfish", "bass", "shrimp")):
        warnings.append("Cook the protein through before serving.")
    if cook_method == "oven":
        warnings.append("Use oven-safe cookware and watch for hot handles.")
    return warnings


def _storage(meal_type: str) -> str:
    if meal_type == "lunch":
        return "Refrigerate leftovers in a sealed container and use within 2 days."
    return "Cool leftovers promptly, refrigerate, and reheat gently before serving again."


def _tags(name: str, required: list[str], cook_method: str, meal_type: str) -> list[str]:
    tags = {meal_type, cook_method.replace("_", "-")}
    if any(item in required for item in ("chicken", "ground turkey", "ground beef", "beef", "pork", "fish", "salmon", "shrimp")):
        tags.add("protein-forward")
    if (meal_type == "dinner") and any(item in required for item in ("rice", "pasta", "beans", "black beans", "lentils", "chickpeas")):
        tags.add("weeknight")
    if "curry" in _normalize(name):
        tags.add("cozy")
    return sorted(tags)


def _steps(row: dict[str, Any], name: str, cook_method: str) -> list[dict[str, Any]]:
    instructions = str(row.get("instructions") or "").strip()
    prep_time = row.get("prep_time_minutes")
    cook_time = row.get("cook_time_minutes")
    oven_temp = row.get("oven_temp_f")
    air_fryer_temp = row.get("air_fryer_temp_f")
    return [
        {
            "step_number": 1,
            "instruction_text": "Prep the ingredients before you start cooking so the recipe comes together smoothly.",
            "timing_minutes": prep_time if isinstance(prep_time, int) and prep_time > 0 else None,
            "temperature_f": oven_temp or air_fryer_temp,
            "equipment": _equipment(cook_method)[0] if _equipment(cook_method) else None,
            "doneness_cue": "Ingredients are measured and ready to cook.",
        },
        {
            "step_number": 2,
            "instruction_text": instructions or f"Cook the recipe using the {cook_method} method until the main ingredients are done.",
            "timing_minutes": cook_time if isinstance(cook_time, int) and cook_time > 0 else None,
            "temperature_f": oven_temp or air_fryer_temp,
            "equipment": _equipment(cook_method)[0] if _equipment(cook_method) else None,
            "doneness_cue": _doneness_cue(name),
        },
        {
            "step_number": 3,
            "instruction_text": "Taste, adjust seasoning if needed, and serve while hot.",
            "timing_minutes": None,
            "temperature_f": None,
            "equipment": None,
            "doneness_cue": "The recipe looks cohesive and ready to eat.",
        },
    ]


def _doneness_cue(name: str) -> str:
    lowered = _normalize(name)
    if any(token in lowered for token in ("chicken", "turkey", "beef", "pork", "sausage", "meatball")):
        return "Cook until the meat is browned and fully cooked through."
    if any(token in lowered for token in ("fish", "salmon", "tilapia", "cod", "catfish", "bass", "shrimp")):
        return "Cook until the seafood is opaque and flakes or curls easily."
    if any(token in lowered for token in ("pasta", "noodle", "ramen")):
        return "Cook until the noodles are tender and coated."
    if "potato" in lowered:
        return "Cook until the potatoes are browned outside and tender inside."
    return "Cook until the ingredients are hot, well combined, and taste balanced."
