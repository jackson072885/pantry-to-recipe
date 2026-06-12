from __future__ import annotations

import json
import re
from typing import Any

from app.services.recipe_instruction_service import (
    SUPPORTED_METHOD_PATTERNS,
    build_instruction_plan,
    dedupe_lines,
    sanitize_line,
    split_instruction_lines,
)


QUALITY_BUCKETS = (
    "KEEP_AS_IS",
    "KEEP_AND_ENRICH",
    "KEEP_BUT_FLAG_FOR_REVIEW",
    "REMOVE_AS_JUNK",
    "MERGE_WITH_DUPLICATE",
)

VALID_CUISINES = {
    "american",
    "tex_mex",
    "mexican",
    "italian",
    "asian",
    "mediterranean",
    "indian",
    "southern",
    "bbq",
}

WEAK_STEP_PHRASES = {
    "cook until done",
    "cook until cooked through",
    "cook until tender",
    "cook through",
    "cooked through",
    "until done",
    "until cooked through",
    "mix together",
    "combine ingredients",
}

COOKING_CUE_WORDS = {"golden", "golden brown", "browned", "crisp", "tender", "opaque", "flakes", "fragrant", "softened", "set", "bubbling", "coated", "clear"}

BANNED_STEP_PHRASES = {
    "smell ready",
    "look cohesive",
    "as needed",
    "until done",
}

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
    "marinara": {"display_quantity": 1.5, "display_unit": "cups"},
    "enchilada sauce": {"display_quantity": 1.5, "display_unit": "cups"},
    "diced tomatoes": {"display_quantity": 1.0, "display_unit": "can"},
    "crushed tomatoes": {"display_quantity": 1.0, "display_unit": "can"},
    "tomato paste": {"display_quantity": 0.25, "display_unit": "cup"},
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
    "white fish": {"display_quantity": 1.0, "display_unit": "lb", "display_name": "white fish fillets"},
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
        aliases.update({"green onions", "scallion", "scallions", "spring onion", "spring onions"})
    if name == "ground beef":
        aliases.update({"hamburger meat", "minced beef"})
    if name == "bell pepper":
        aliases.update({"bell peppers", "pepper"})
    if name == "tomato sauce":
        aliases.add("marinara")
        aliases.add("pasta sauce")
    if name == "marinara":
        aliases.update({"marinara sauce", "pasta sauce"})
    if name == "enchilada sauce":
        aliases.add("red enchilada sauce")
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

    steps = _steps(row, name, cook_method)
    instruction_confidence = _instruction_confidence_label(steps)
    if instruction_confidence == "low":
        reason = f"{reason}; low_instruction_confidence" if reason else "low_instruction_confidence"
        quality_bucket = "KEEP_BUT_FLAG_FOR_REVIEW"

    quality_score = _quality_score(name, row_number)
    if instruction_confidence == "low":
        quality_score = min(quality_score, 58)

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
        "cuisine": _canonical_cuisine(row.get("cuisine")) or _cuisine(name),
        "cleanup_score": None,
        "prep_complexity": "simple" if (row.get("total_time_minutes") or 0) <= 30 else "moderate",
        "meal_type": meal_type,
        "equipment_json": json.dumps(_equipment(cook_method)),
        "substitutions_json": json.dumps(_substitutions(required)),
        "tips_json": json.dumps(_tips(required, cook_method)),
        "warnings_json": json.dumps(_warnings(required, cook_method)),
        "storage_json": json.dumps([_storage(meal_type)]),
        "tags_json": json.dumps(_tags(row, name, required, cook_method, meal_type)),
        "quality_score": quality_score,
        "quality_bucket": quality_bucket,
        "quality_reason": reason,
        "review_status": "needs_editor_review" if quality_bucket == "KEEP_BUT_FLAG_FOR_REVIEW" else "approved",
        "is_production_ready": quality_bucket != "KEEP_BUT_FLAG_FOR_REVIEW",
        "is_weeknight_friendly": "weeknight" in _tags(row, name, required, cook_method, meal_type),
        "is_beginner_friendly": _difficulty(row, required) == "easy" and cook_method in {"skillet", "stovetop", "no_cook"} and len(required) <= 4 and row_number not in WEAK_ROWS,
        "instruction_confidence": instruction_confidence,
        "ingredients": ingredient_rows,
        "steps": steps,
    }


def score_recipe(row: dict[str, Any]) -> dict[str, Any]:
    name = str(row.get("name", "")).strip()
    ingredients = row.get("ingredients") or []
    steps = row.get("steps") or []
    title_quality = 8 if _normalize(name) in WEAK_TITLES else 15
    ingredient_quality = 20 if ingredients else 5
    step_quality = 25 if len(steps) >= 3 else 16 if len(steps) == 2 else 8
    trust = 18 if ingredients and steps else 8
    if row.get("instruction_confidence") == "low":
        trust -= 6
    product_value = 10 if row.get("meal_type") == "dinner" else 4
    hygiene = 10
    total = title_quality + ingredient_quality + step_quality + trust + product_value + hygiene
    if _normalize(name) in WEAK_TITLES or _normalize(name) == "roasted potatoes":
        bucket = "KEEP_BUT_FLAG_FOR_REVIEW"
        review_status = "needs_editor_review"
        is_production_ready = False
    elif row.get("instruction_confidence") == "low":
        bucket = "KEEP_BUT_FLAG_FOR_REVIEW"
        review_status = "needs_editor_review"
        is_production_ready = False
    else:
        bucket = "KEEP_AS_IS" if total >= 90 else "KEEP_AND_ENRICH" if total >= 60 else "KEEP_BUT_FLAG_FOR_REVIEW"
        review_status = "approved" if bucket in {"KEEP_AS_IS", "KEEP_AND_ENRICH"} else "needs_editor_review"
        is_production_ready = True
    return {
        "quality_score": total,
        "quality_bucket": bucket,
        "quality_reason": "low_instruction_confidence" if row.get("instruction_confidence") == "low" else "derived_from_recipe_shape",
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
    explicit = _normalize_tag(str(row.get("difficulty") or ""))
    if explicit in {"easy", "medium"}:
        return explicit
    total_time = row.get("total_time_minutes") or 0
    if total_time <= 25 and len(required) <= 4:
        return "easy"
    if total_time >= 40:
        return "medium"
    return "easy"


def _primary_protein(required: list[str]) -> str | None:
    proteins = {"chicken", "ground turkey", "ground beef", "beef", "pork", "fish", "white fish", "salmon", "tilapia", "cod", "catfish", "bass", "shrimp", "tofu", "egg", "tuna", "sausage", "ham", "bacon"}
    for item in required:
        if item in proteins:
            return item
    return None


def _cuisine(name: str) -> str | None:
    lowered = _normalize(name)
    if any(token in lowered for token in ("taco", "quesadilla", "burrito")):
        return "tex_mex"
    if any(token in lowered for token in ("alfredo", "ziti", "parmesan", "pesto")):
        return "italian"
    if any(token in lowered for token in ("fried rice", "stir fry", "ramen")):
        return "asian"
    if "curry" in lowered:
        return "indian"
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
    if any(item in required for item in ("chicken", "ground turkey", "ground beef", "beef", "pork", "fish", "white fish", "salmon", "tilapia", "cod", "catfish", "bass", "shrimp")):
        warnings.append("Cook the protein through before serving.")
    if cook_method == "oven":
        warnings.append("Use oven-safe cookware and watch for hot handles.")
    return warnings


def _storage(meal_type: str) -> str:
    if meal_type == "lunch":
        return "Refrigerate leftovers in a sealed container and use within 2 days."
    return "Cool leftovers promptly, refrigerate, and reheat gently before serving again."


def _tags(row: dict[str, Any], name: str, required: list[str], cook_method: str, meal_type: str) -> list[str]:
    source_tags = [_normalize_tag(tag) for tag in row.get("tags", []) if _normalize_tag(tag)]
    if source_tags:
        return sorted(dict.fromkeys(source_tags))

    tags = {meal_type, _normalize_tag(cook_method)}
    if any(item in required for item in ("chicken", "ground turkey", "ground beef", "beef", "pork", "fish", "white fish", "salmon", "shrimp")):
        tags.add("high_protein")
    if (meal_type == "dinner") and any(item in required for item in ("rice", "pasta", "beans", "black beans", "lentils", "chickpeas")):
        tags.add("weeknight")
    if "curry" in _normalize(name):
        tags.add("comfort_food")
    return sorted(_normalize_tag(tag) for tag in tags if _normalize_tag(tag))


def _canonical_cuisine(value: Any) -> str | None:
    normalized = _normalize_tag(str(value or ""))
    return normalized if normalized in VALID_CUISINES else None


def _normalize_tag(value: str) -> str:
    lowered = re.sub(r"[^a-z0-9]+", "_", value.strip().lower())
    return lowered.strip("_")


def _steps(row: dict[str, Any], name: str, cook_method: str) -> list[dict[str, Any]]:
    instructions = str(row.get("instructions") or "").strip()
    prep_time = row.get("prep_time_minutes")
    cook_time = row.get("cook_time_minutes")
    oven_temp = row.get("oven_temp_f")
    air_fryer_temp = row.get("air_fryer_temp_f")
    required = _normalize_names(row.get("required", []))
    optional = _normalize_names(row.get("optional", []))
    plan = build_instruction_plan(
        recipe_name=name,
        cook_method=cook_method,
        required=required,
        optional=optional,
        instructions=instructions,
        prep_time_minutes=prep_time,
        cook_time_minutes=cook_time,
        oven_temp_f=oven_temp,
        air_fryer_temp_f=air_fryer_temp,
    )
    lines = dedupe_lines(plan.steps)

    steps: list[dict[str, Any]] = []
    total_steps = len(lines)
    for index, line in enumerate(lines, start=1):
        cleaned_line = sanitize_line(line)
        steps.append(
            {
                "step_number": index,
                "instruction_text": cleaned_line,
                "timing_minutes": _step_timing(prep_time, cook_time, index, total_steps, cleaned_line),
                "temperature_f": (oven_temp if cook_method == "oven" else air_fryer_temp) if index == 1 and cook_method in {"oven", "air_fryer"} else None,
                "equipment": _equipment(cook_method)[0] if _equipment(cook_method) else None,
                "doneness_cue": _step_doneness(cleaned_line, name, required),
                "instruction_confidence": plan.confidence,
                "method_pattern": plan.method_pattern,
            }
        )
    return steps[:5]


def _doneness_cue(name: str) -> str:
    lowered = _normalize(name)
    if any(token in lowered for token in ("chicken", "turkey")):
        return "Cook until there is no pink in the center and the juices run clear."
    if any(token in lowered for token in ("beef", "pork", "sausage", "meatball")):
        return "Cook until browned and hot through."
    if any(token in lowered for token in ("fish", "white fish", "salmon", "tilapia", "cod", "catfish", "bass", "shrimp")):
        return "Cook until the seafood is opaque and flakes or curls easily."
    if any(token in lowered for token in ("pasta", "noodle", "ramen")):
        return "Cook until the noodles are tender and coated."
    if "potato" in lowered:
        return "Cook until the potatoes are tender and lightly browned."
    if any(token in lowered for token in ("onion", "garlic", "ginger")):
        return "Cook until the aromatics are softened and fragrant."
    return "Cook until the main components are hot and properly cooked for the dish."


def _enrich_step_instruction(
    instruction: str,
    cook_method: str,
    name: str,
    prep_time: Any,
    cook_time: Any,
    oven_temp: Any,
    air_fryer_temp: Any,
    step_number: int,
    total_steps: int,
    required: list[str],
) -> str:
    text = _clean_instruction_text(instruction)
    if not text:
        return text
    if not _is_weak_step(text):
        return text

    if _is_prep_instruction(text):
        time_phrase = _time_range(prep_time, "3 to 5 minutes")
        return f"{_sequence_prefix(step_number, total_steps)}{text} This takes about {time_phrase}."

    if _is_finish_instruction(text):
        return f"{_sequence_prefix(step_number, total_steps)}taste, adjust seasoning, and serve."

    doneness = _step_doneness(text, name, required) or _doneness_cue(name)
    time_phrase = _time_range(cook_time, "4 to 6 minutes")
    heat_level = _heat_level_for_instruction(text, cook_method)

    if cook_method in {"oven", "air_fryer"}:
        temp = oven_temp or air_fryer_temp
        temp_phrase = f" at {temp}F" if isinstance(temp, int) and temp > 0 else ""
        return (
            f"Next, {text.lower()} in a single layer{temp_phrase} for {time_phrase}, turning once if needed, until {doneness.lower()}."
        )

    if cook_method == "no_cook":
        return f"Next, {text.lower()} until evenly coated."

    heat_phrase = f" over {heat_level} heat" if heat_level else ""
    return f"Next, {text.lower()}{heat_phrase} for {time_phrase}, until {doneness.lower()}."


def _is_weak_step(instruction: str) -> bool:
    lowered = instruction.lower()
    words = re.findall(r"[a-zA-Z]+", lowered)
    has_time = bool(re.search(r"\b\d+\s*(?:-|to)?\s*\d*\s*(minute|minutes|min)\b", lowered))
    has_heat = any(word in lowered for word in ("low heat", "medium heat", "medium-high heat", "high heat"))
    has_cue = any(word in lowered for word in COOKING_CUE_WORDS)
    has_vague_phrase = any(phrase in lowered for phrase in WEAK_STEP_PHRASES)
    return len(words) <= 8 or has_vague_phrase or not (has_time or has_heat or has_cue)


def _time_range(value: Any, fallback: str) -> str:
    if isinstance(value, int) and value > 0:
        lower = max(1, value - 1)
        upper = max(lower + 1, value + 1)
        return f"{lower} to {upper} minutes"
    return fallback


def _split_instruction_lines(instructions: str) -> list[str]:
    return split_instruction_lines(instructions)


def _build_fallback_lines(name: str, required: list[str], cook_method: str) -> list[str]:
    required_set = set(required)
    proteins = {"chicken", "ground turkey", "ground beef", "beef", "pork", "salmon", "shrimp", "fish", "white fish", "tilapia", "cod", "catfish", "bass", "sausage", "tofu"}
    seafood = {"salmon", "shrimp", "fish", "white fish", "tilapia", "cod", "catfish", "bass"}
    starches = {"pasta", "rice", "ramen", "potato", "sweet potato", "bread", "tortilla"}
    protein = next((item for item in required if item in proteins), None)
    starch = next((item for item in required if item in starches), None)
    prep_items = [item for item in required if INGREDIENT_PROFILES.get(item, {}).get("prep_state")]
    finish_item = next((item for item in required if item not in {protein, starch}), protein or starch or name.lower())

    lines: list[str] = []
    if prep_items:
        lines.append(_prep_instruction(required))

    if cook_method in {"skillet", "stovetop"} and protein in seafood:
        lines.append(f"Heat a lightly oiled pan over medium-high heat for the {protein}")
        lines.append(f"Cook the {protein} on the first side until lightly browned")
        lines.append(f"Flip and finish the {protein} until it flakes easily")
        return lines[:4]

    if cook_method in {"skillet", "stovetop"}:
        lines.append("Heat a lightly oiled pan over medium heat")
        if protein:
            lines.append(f"Cook the {protein} until browned and nearly cooked through")
            if finish_item and finish_item != protein:
                lines.append(f"Add the {finish_item} and cook until tender or warmed through")
            else:
                lines.append("Season to taste and serve")
        elif starch:
            lines.append(f"Cook the {starch} until hot and ready to serve")
            lines.append("Season to taste and serve")
        else:
            lines.append(f"Cook the {finish_item} until tender")
            lines.append("Season to taste and serve")
        return lines[:4]

    if cook_method in {"oven", "air_fryer"}:
        lines.append("Arrange the ingredients in a single layer")
        lines.append(f"Cook the {protein or starch or name.lower()} until browned and cooked through")
        lines.append("Serve hot")
        return lines[:4]

    lines.append(f"Cook the {protein or starch or name.lower()} until ready")
    lines.append("Serve")
    return lines[:4]


def _needs_prep_step(required: list[str], lines: list[str]) -> bool:
    if any(_is_prep_instruction(line) for line in lines):
        return False
    prep_required = {item for item in required if INGREDIENT_PROFILES.get(item, {}).get("prep_state")}
    return bool(prep_required)


def _prep_instruction(required: list[str]) -> str:
    prep_items = [item for item in required if INGREDIENT_PROFILES.get(item, {}).get("prep_state")]
    actions = []
    for item in prep_items[:3]:
        prep_state = str(INGREDIENT_PROFILES.get(item, {}).get("prep_state") or "").strip()
        if prep_state:
            actions.append(f"{prep_state} the {item}")
    if not actions:
        return "Prep the ingredients"
    if len(actions) == 1:
        return actions[0][:1].upper() + actions[0][1:]
    return f"{', '.join(actions[:-1])}, and {actions[-1]}"


def _step_timing(prep_time: Any, cook_time: Any, step_number: int, total_steps: int, line: str) -> int | None:
    if _is_prep_instruction(line):
        return prep_time if isinstance(prep_time, int) and prep_time > 0 else None
    if _is_finish_instruction(line):
        return None
    if isinstance(cook_time, int) and cook_time > 0:
        return max(1, round(cook_time / max(1, total_steps - 1)))
    return None


def _step_doneness(line: str, name: str, required: list[str]) -> str | None:
    lowered = line.lower()
    for phrase in ("flakes easily", "opaque", "juices run clear", "no pink", "tender", "lightly browned", "golden"):
        if phrase in lowered:
            return phrase
    cue = _doneness_cue(" ".join(required) or name).rstrip(".")
    cue = re.sub(r"^cook until\s+", "", cue, flags=re.IGNORECASE)
    return cue[:1].lower() + cue[1:]


def _heat_level_for_instruction(text: str, cook_method: str) -> str | None:
    lowered = text.lower()
    if "simmer" in lowered:
        return "low"
    if "saute" in lowered or "sauté" in lowered:
        return "medium"
    if "pan-fry" in lowered or "pan fry" in lowered:
        return "medium-high" if cook_method == "skillet" else "medium"
    if cook_method in {"skillet", "stovetop"}:
        return "medium"
    return None


def _sequence_prefix(step_number: int, total_steps: int) -> str:
    if total_steps <= 1:
        return ""
    if step_number == 1:
        return "First, "
    if step_number == total_steps:
        return "Finally, "
    return "Next, "


def _is_prep_instruction(text: str) -> bool:
    lowered = text.lower()
    return any(word in lowered for word in ("slice", "chop", "dice", "mince", "measure", "cut"))


def _is_finish_instruction(text: str) -> bool:
    lowered = text.lower()
    return "serve" in lowered or "season to taste" in lowered or "taste" in lowered


def _clean_instruction_text(text: str) -> str:
    cleaned = text.strip().rstrip(".")
    for phrase in BANNED_STEP_PHRASES:
        cleaned = re.sub(re.escape(phrase), "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,;")
    return cleaned


def _dedupe_instruction_lines(lines: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for line in lines:
        key = _instruction_signature(line)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(line)
    return deduped


def _instruction_signature(line: str) -> str:
    lowered = _normalize(line)
    lowered = re.sub(r"\b(first|next|finally|then)\b", " ", lowered)
    lowered = re.sub(r"\b(minutes?|min|side|sides)\b", " ", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered


def _instruction_confidence_label(steps: list[dict[str, Any]]) -> str:
    if not steps:
        return "low"
    return str(steps[0].get("instruction_confidence") or "medium")
