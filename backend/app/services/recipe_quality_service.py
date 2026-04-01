from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient, RecipeStep
from app.services.normalize_service import STAPLES
from app.services.recipe_dataset_service import active_recipe_query

KEEP_AS_IS = "KEEP_AS_IS"
KEEP_AND_ENRICH = "KEEP_AND_ENRICH"
KEEP_BUT_FLAG_FOR_REVIEW = "KEEP_BUT_FLAG_FOR_REVIEW"
REMOVE_AS_JUNK = "REMOVE_AS_JUNK"
MERGE_WITH_DUPLICATE = "MERGE_WITH_DUPLICATE"

GENERIC_TITLE_WORDS = {
    "basic",
    "classic",
    "easy",
    "quick",
    "simple",
    "upgrade",
}

DINNER_MISMATCH_TOKENS = {
    "omelet",
    "frittata",
    "french toast",
    "pancakes",
    "scrambled eggs",
    "fried egg",
}

MEASURE_PROFILES: dict[str, tuple[float, str]] = {
    "bacon": (4.0, "strip"),
    "basil": (0.25, "cup"),
    "bbq sauce": (0.5, "cup"),
    "beans": (1.0, "can"),
    "black beans": (1.0, "can"),
    "bread": (4.0, "slice"),
    "broccoli": (2.0, "cup"),
    "butter": (1.0, "tbsp"),
    "cabbage": (2.0, "cup"),
    "carrot": (1.0, "cup"),
    "caesar dressing": (0.25, "cup"),
    "catfish": (0.75, "lb"),
    "cheddar": (1.0, "cup"),
    "chicken": (0.75, "lb"),
    "chickpeas": (1.0, "can"),
    "cilantro": (0.25, "cup"),
    "cod": (0.75, "lb"),
    "coconut milk": (1.0, "cup"),
    "corn": (1.0, "cup"),
    "cream": (0.75, "cup"),
    "cucumber": (1.0, "cup"),
    "cumin": (1.0, "tsp"),
    "curry powder": (1.0, "tsp"),
    "egg": (2.0, "ea"),
    "fish": (0.75, "lb"),
    "flour": (1.0, "cup"),
    "garlic": (2.0, "clove"),
    "ginger": (1.0, "tbsp"),
    "green beans": (2.0, "cup"),
    "green onion": (0.25, "cup"),
    "ground beef": (0.75, "lb"),
    "ground turkey": (0.75, "lb"),
    "ham": (6.0, "oz"),
    "hot sauce": (1.0, "tsp"),
    "lettuce": (2.0, "cup"),
    "lemon": (1.0, "ea"),
    "lentils": (1.0, "cup"),
    "lime": (1.0, "ea"),
    "mayo": (0.25, "cup"),
    "milk": (0.75, "cup"),
    "mozzarella": (1.0, "cup"),
    "mushroom": (2.0, "cup"),
    "mustard": (1.0, "tsp"),
    "olive oil": (1.0, "tbsp"),
    "onion": (1.0, "cup"),
    "paprika": (1.0, "tsp"),
    "parmesan": (0.5, "cup"),
    "parsley": (0.25, "cup"),
    "pasta": (8.0, "oz"),
    "peas": (1.0, "cup"),
    "pesto": (0.5, "cup"),
    "pepper": (0.5, "tsp"),
    "pork": (0.75, "lb"),
    "potato": (2.0, "ea"),
    "rice": (1.0, "cup"),
    "salmon": (0.75, "lb"),
    "salsa": (0.5, "cup"),
    "sausage": (0.75, "lb"),
    "sesame oil": (1.0, "tsp"),
    "shrimp": (0.75, "lb"),
    "soy sauce": (2.0, "tbsp"),
    "sour cream": (0.5, "cup"),
    "spinach": (2.0, "cup"),
    "sweet potato": (2.0, "ea"),
    "tilapia": (0.75, "lb"),
    "tofu": (14.0, "oz"),
    "tomato": (1.0, "cup"),
    "tomato sauce": (1.0, "cup"),
    "tortilla": (4.0, "ea"),
    "tuna": (1.0, "can"),
    "zucchini": (1.0, "cup"),
}

PREP_STATES = {
    "bell pepper": "sliced",
    "broccoli": "bite-size florets",
    "cabbage": "shredded",
    "carrot": "diced",
    "catfish": "patted dry",
    "chicken": "bite-size pieces",
    "cod": "portioned",
    "cucumber": "sliced",
    "egg": "beaten",
    "garlic": "minced",
    "ginger": "minced",
    "green beans": "trimmed",
    "green onion": "sliced",
    "ground beef": "broken up",
    "ground turkey": "broken up",
    "ham": "diced",
    "lettuce": "chopped",
    "mushroom": "sliced",
    "onion": "diced",
    "parsley": "chopped",
    "pork": "bite-size pieces",
    "potato": "diced",
    "salmon": "portioned",
    "shrimp": "peeled and deveined",
    "spinach": "roughly chopped",
    "sweet potato": "diced",
    "tilapia": "patted dry",
    "tofu": "cubed",
    "tomato": "diced",
    "zucchini": "diced",
}


@dataclass
class IngredientRow:
    recipe_ingredient: RecipeIngredient
    ingredient: Ingredient


def run_recipe_quality_backfill(db: Session) -> dict:
    recipes = active_recipe_query(db).order_by(Recipe.id.asc()).all()
    recipe_rows = {recipe.id: _load_recipe_ingredients(db, recipe.id) for recipe in recipes}
    duplicate_map = _find_duplicate_winners(recipes, recipe_rows)

    counts: Counter[str] = Counter()
    impacted: list[dict] = []

    for recipe in recipes:
        ingredient_rows = recipe_rows[recipe.id]
        enrichment = _enrich_recipe(recipe, ingredient_rows)
        decision = _score_recipe(recipe, ingredient_rows, enrichment, duplicate_map.get(recipe.id))
        _apply_recipe_enrichment(recipe, ingredient_rows, enrichment, decision)

        counts[decision["bucket"]] += 1
        impacted.append(
            {
                "recipe_id": recipe.id,
                "recipe_name": recipe.name,
                "score": decision["score"],
                "bucket": decision["bucket"],
                "production_ready": recipe.is_production_ready,
                "reasons": decision["reasons"],
            }
        )

    db.commit()
    return {
        "total_active": len(recipes),
        "counts": dict(sorted(counts.items())),
        "impacted": impacted,
    }


def _load_recipe_ingredients(db: Session, recipe_id: int) -> list[IngredientRow]:
    rows = (
        db.query(RecipeIngredient, Ingredient)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .filter(RecipeIngredient.recipe_id == recipe_id)
        .order_by(RecipeIngredient.is_required.desc(), Ingredient.canonical_name.asc())
        .all()
    )
    return [IngredientRow(recipe_ingredient=ri, ingredient=ingredient) for ri, ingredient in rows]


def _find_duplicate_winners(
    recipes: list[Recipe],
    recipe_rows: dict[int, list[IngredientRow]],
) -> dict[int, int]:
    duplicate_losers: dict[int, int] = {}
    ordered = sorted(recipes, key=lambda recipe: recipe.id)

    for index, recipe in enumerate(ordered):
        if recipe.id in duplicate_losers:
            continue

        left_title = _normalize_title(recipe.name)
        left_required = _required_ingredient_names(recipe_rows[recipe.id])

        for other in ordered[index + 1 :]:
            if other.id in duplicate_losers:
                continue

            right_title = _normalize_title(other.name)
            title_similarity = SequenceMatcher(None, left_title, right_title).ratio()
            if title_similarity < 0.72 and not _same_ingredient_family(left_title, right_title):
                continue

            right_required = _required_ingredient_names(recipe_rows[other.id])
            ingredient_overlap = _jaccard_similarity(left_required, right_required)
            if ingredient_overlap < 0.6:
                continue

            winner = recipe if _recipe_strength(recipe, recipe_rows[recipe.id]) >= _recipe_strength(other, recipe_rows[other.id]) else other
            loser = other if winner.id == recipe.id else recipe
            duplicate_losers[loser.id] = winner.id

    return duplicate_losers


def _recipe_strength(recipe: Recipe, ingredient_rows: list[IngredientRow]) -> tuple[int, int, int]:
    instruction_lines = len(_split_instruction_lines(recipe.instructions))
    required_count = len(_required_ingredient_names(ingredient_rows))
    instruction_length = len((recipe.instructions or "").strip())
    return (instruction_lines, required_count, instruction_length)


def _enrich_recipe(recipe: Recipe, ingredient_rows: list[IngredientRow]) -> dict:
    servings = recipe.servings or 2
    meal_type = _infer_meal_type(recipe.name, ingredient_rows)
    cook_method = _normalized_value(recipe.cook_method) or _infer_cook_method(recipe.name, ingredient_rows)
    difficulty = _normalized_value(recipe.difficulty) or _infer_difficulty(recipe, ingredient_rows)
    equipment = _infer_equipment(cook_method)
    tags = _infer_tags(recipe, ingredient_rows, meal_type, cook_method)
    steps = _build_steps(recipe, ingredient_rows, cook_method)
    tips = _infer_tips(recipe, ingredient_rows, cook_method)
    substitutions = _infer_substitutions(ingredient_rows)
    storage = _infer_storage(recipe)
    warnings = _infer_warnings(recipe, ingredient_rows)

    enriched_ingredients = []
    for sort_order, row in enumerate(ingredient_rows, start=1):
        profile = _ingredient_profile(row.ingredient.canonical_name, servings)
        requirement_quantity, requirement_unit, has_practical_default = _canonical_requirement_from_profile(profile)
        enriched_ingredients.append(
            {
                "row": row,
                "sort_order": sort_order,
                "display_name": _display_name(row.ingredient.canonical_name),
                "pantry_name": row.ingredient.canonical_name,
                "prep_state": PREP_STATES.get(row.ingredient.canonical_name),
                "display_quantity": profile[0],
                "display_unit": profile[1],
                "notes": _ingredient_note(row.ingredient.canonical_name, row.recipe_ingredient.is_required),
                "measurement_is_estimated": not has_practical_default,
                "required_quantity": requirement_quantity,
                "unit": requirement_unit,
            }
        )

    instructions = "\n".join(step["instruction_text"] for step in steps)
    short_description = _build_short_description(recipe.name, ingredient_rows, cook_method, meal_type)

    return {
        "meal_type": meal_type,
        "cook_method": cook_method,
        "difficulty": difficulty,
        "equipment": equipment,
        "tags": tags,
        "steps": steps,
        "tips": tips,
        "substitutions": substitutions,
        "storage": storage,
        "warnings": warnings,
        "ingredients": enriched_ingredients,
        "instructions": instructions,
        "short_description": short_description,
        "is_weeknight_friendly": bool(recipe.total_time_minutes is not None and recipe.total_time_minutes <= 35 and meal_type != "breakfast"),
        "is_beginner_friendly": difficulty in {"Beginner", "Easy"},
    }


def _score_recipe(
    recipe: Recipe,
    ingredient_rows: list[IngredientRow],
    enrichment: dict,
    duplicate_winner_id: int | None,
) -> dict:
    scorecard = _score_recipe_components(recipe, ingredient_rows, enrichment, duplicate_winner_id)
    reasons = list(scorecard["reasons"])
    total_score = scorecard["total_score"]
    product_value = scorecard["components"]["product_value"]

    if duplicate_winner_id is not None:
        bucket = MERGE_WITH_DUPLICATE
        production_ready = False
        review_status = "merged_duplicate"
    elif product_value <= 2:
        bucket = KEEP_BUT_FLAG_FOR_REVIEW
        production_ready = False
        review_status = "review"
    elif total_score >= 25:
        bucket = KEEP_AS_IS
        production_ready = True
        review_status = "approved"
    elif total_score >= 18:
        bucket = KEEP_AND_ENRICH
        production_ready = True
        review_status = "approved"
    elif total_score >= 14:
        bucket = KEEP_BUT_FLAG_FOR_REVIEW
        production_ready = False
        review_status = "review"
    else:
        bucket = REMOVE_AS_JUNK
        production_ready = False
        review_status = "remove"

    return {
        "score": total_score,
        "bucket": bucket,
        "reasons": reasons or ["passes_current_rubric"],
        "production_ready": production_ready,
        "review_status": review_status,
        "score_breakdown": scorecard["components"],
    }


def _score_recipe_components(
    recipe: Recipe,
    ingredient_rows: list[IngredientRow],
    enrichment: dict,
    duplicate_winner_id: int | None,
) -> dict:
    reasons: list[str] = []
    components: dict[str, int] = {}

    title_quality = 5
    normalized_title = _normalize_title(recipe.name)
    if any(word in normalized_title for word in GENERIC_TITLE_WORDS):
        title_quality -= 1
        reasons.append("title_has_generic_modifier")
    if len(recipe.name.split()) < 2:
        title_quality -= 2
        reasons.append("title_is_too_short")
    components["title_quality"] = max(0, title_quality)

    required_names = _required_ingredient_names(ingredient_rows)
    display_ready = sum(
        1
        for item in enrichment["ingredients"]
        if item["display_quantity"] is not None and item["row"].recipe_ingredient.is_required
    )
    ingredient_completeness = 2
    if len(required_names) >= 3:
        ingredient_completeness += 1
    if display_ready >= max(2, len(required_names) // 2):
        ingredient_completeness += 1
    if any(not row.recipe_ingredient.is_required for row in ingredient_rows):
        ingredient_completeness += 1
    if display_ready == 0:
        reasons.append("measurements_still_missing")
    components["ingredient_completeness"] = max(0, ingredient_completeness)

    steps = enrichment["steps"]
    step_quality = 2
    if len(steps) >= 3:
        step_quality += 2
    if any(step.get("doneness_cue") for step in steps):
        step_quality += 1
    if len(steps) < 2:
        reasons.append("instructions_too_thin")
    components["step_quality"] = max(0, step_quality)

    trust = 2
    if recipe.servings:
        trust += 1
    if recipe.total_time_minutes:
        trust += 1
    if recipe.prep_time_minutes is not None and recipe.cook_time_minutes is not None:
        trust += 1
    if recipe.cook_method == "no_cook" and (recipe.cook_time_minutes or 0) > 0:
        trust -= 1
        reasons.append("cook_method_time_conflict")
    components["trust_and_cookability"] = max(0, trust)

    product_value = 5
    if enrichment["meal_type"] == "breakfast":
        product_value = 2
        reasons.append("low_dinner_relevance")
    elif recipe.total_time_minutes and recipe.total_time_minutes > 55:
        product_value -= 1
        reasons.append("slow_for_weeknight")
    components["product_value"] = max(0, product_value)

    data_hygiene = 5
    if duplicate_winner_id is not None:
        data_hygiene = 1
        reasons.append(f"duplicate_of_{duplicate_winner_id}")
    components["data_hygiene"] = max(0, data_hygiene)

    total_score = sum(components.values())
    return {
        "components": components,
        "reasons": reasons,
        "total_score": total_score,
    }


def _apply_recipe_enrichment(
    recipe: Recipe,
    ingredient_rows: list[IngredientRow],
    enrichment: dict,
    decision: dict,
) -> None:
    recipe.short_description = enrichment["short_description"]
    recipe.instructions = enrichment["instructions"]
    recipe.cook_method = enrichment["cook_method"]
    recipe.difficulty = enrichment["difficulty"]
    recipe.meal_type = enrichment["meal_type"]
    recipe.equipment_json = json.dumps(enrichment["equipment"], sort_keys=True)
    recipe.substitutions_json = json.dumps(enrichment["substitutions"], sort_keys=True)
    recipe.tips_json = json.dumps(enrichment["tips"], sort_keys=True)
    recipe.warnings_json = json.dumps(enrichment["warnings"], sort_keys=True)
    recipe.storage_json = json.dumps(enrichment["storage"], sort_keys=True)
    recipe.tags_json = json.dumps(enrichment["tags"], sort_keys=True)
    recipe.quality_score = decision["score"]
    recipe.quality_bucket = decision["bucket"]
    recipe.quality_reason = "; ".join(decision["reasons"])
    recipe.review_status = decision["review_status"]
    recipe.is_weeknight_friendly = enrichment["is_weeknight_friendly"]
    recipe.is_beginner_friendly = enrichment["is_beginner_friendly"]
    recipe.is_production_ready = decision["production_ready"]

    for ingredient in enrichment["ingredients"]:
        row = ingredient["row"].recipe_ingredient
        row.sort_order = ingredient["sort_order"]
        row.display_name = ingredient["display_name"]
        row.pantry_name = ingredient["pantry_name"]
        row.prep_state = ingredient["prep_state"]
        row.display_quantity = ingredient["display_quantity"]
        row.display_unit = ingredient["display_unit"]
        row.notes = ingredient["notes"]
        row.measurement_is_estimated = ingredient["measurement_is_estimated"]
        if row.is_required:
            row.required_quantity = ingredient["required_quantity"]
            row.unit = ingredient["unit"]
        elif row.required_quantity is None or row.required_quantity < 0:
            row.required_quantity = 0.0
        if not row.unit:
            row.unit = "ea"

    recipe.steps.clear()
    for step in enrichment["steps"]:
        recipe.steps.append(
            RecipeStep(
                step_number=step["step_number"],
                instruction_text=step["instruction_text"],
                timing_minutes=step.get("timing_minutes"),
                temperature_f=step.get("temperature_f"),
                equipment=step.get("equipment"),
                doneness_cue=step.get("doneness_cue"),
            )
        )


def _build_steps(recipe: Recipe, ingredient_rows: list[IngredientRow], cook_method: str) -> list[dict]:
    lines = _split_instruction_lines(recipe.instructions)
    if len(lines) < 2:
        lines = _generate_steps_from_template(recipe, ingredient_rows, cook_method)

    steps = []
    for index, line in enumerate(lines, start=1):
        steps.append(
            {
                "step_number": index,
                "instruction_text": line,
                "timing_minutes": _timing_hint(recipe, index, len(lines)),
                "temperature_f": _temperature_hint(recipe, index, cook_method),
                "equipment": _step_equipment(cook_method),
                "doneness_cue": _doneness_hint(line),
            }
        )
    return steps


def _generate_steps_from_template(recipe: Recipe, ingredient_rows: list[IngredientRow], cook_method: str) -> list[str]:
    required = _required_ingredient_names(ingredient_rows)
    aromatics = [name for name in required if name in {"garlic", "ginger", "onion"}]
    protein = next((name for name in required if name in {"chicken", "ground beef", "ground turkey", "pork", "salmon", "shrimp", "fish", "tilapia", "cod", "catfish", "tofu", "sausage", "ham"}), None)
    starch = next((name for name in required if name in {"pasta", "rice", "tortilla", "bread", "potato", "sweet potato", "ramen"}), None)
    produce = [name for name in required if name not in {protein, starch, *aromatics}]

    first = "Prep the ingredients so they are ready to cook."
    if aromatics or produce:
        prep_items = ", ".join(_display_name(name).lower() for name in [*aromatics, *produce][:3])
        first = f"Prep the ingredients first: cut or measure the {prep_items} and keep them within reach."

    steps = [first]

    if cook_method in {"stovetop", "skillet"}:
        if starch in {"pasta", "rice", "ramen"}:
            steps.append(f"Start the {starch} first so it is ready when the rest of the dish finishes cooking.")
        if protein:
            steps.append(f"Cook the {protein} in a hot pan until browned and cooked through, then add any aromatics and vegetables.")
        else:
            steps.append("Cook the main ingredients in a hot pan until they are tender and lightly browned.")
        steps.append("Stir in the sauce or seasonings, combine everything, and cook just until the flavors come together.")
    elif cook_method in {"oven", "air_fryer"}:
        temp = recipe.oven_temp_f if cook_method == "oven" else recipe.air_fryer_temp_f
        if temp:
            steps.append(f"Heat the {cook_method.replace('_', ' ')} to {temp}F.")
        steps.append("Arrange the main ingredients in a single layer, season well, and cook until browned and fully done.")
        steps.append("Rest briefly, then finish with any quick toppings or herbs before serving.")
    elif cook_method == "no_cook":
        if starch == "pasta":
            steps.append("Cook the pasta, rinse or chill it if needed, and drain well before assembling.")
        steps.append("Combine the main ingredients in a bowl, add the dressing or sauce, and toss until evenly coated.")
        steps.append("Taste, adjust seasoning, and serve right away or chilled.")
    else:
        steps.append("Cook the main ingredients using the listed method until the base is well developed.")
        steps.append("Add the remaining ingredients and finish until everything is hot and well combined.")

    return steps[:4]


def _split_instruction_lines(instructions: str | None) -> list[str]:
    if not instructions:
        return []

    normalized = instructions.replace("\r", "\n")
    raw_lines = [line.strip() for line in normalized.split("\n") if line.strip()]
    if len(raw_lines) >= 2:
        return raw_lines

    text = raw_lines[0] if raw_lines else ""
    parts = re.split(r"\.\s+|,\s+then\s+|;\s+|\s+then\s+", text)
    lines = [part.strip().rstrip(".") for part in parts if part.strip()]
    return lines


def _required_ingredient_names(ingredient_rows: list[IngredientRow]) -> set[str]:
    return {
        row.ingredient.canonical_name
        for row in ingredient_rows
        if row.recipe_ingredient.is_required and row.ingredient.canonical_name not in STAPLES
    }


def _jaccard_similarity(left: set[str], right: set[str]) -> float:
    if not left and not right:
        return 1.0
    return len(left & right) / len(left | right)


def _same_ingredient_family(left_title: str, right_title: str) -> bool:
    left = set(left_title.split())
    right = set(right_title.split())
    return len(left & right) >= 2


def _normalize_title(value: str) -> str:
    lowered = value.strip().lower().replace("&", "and")
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def _normalized_value(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _infer_meal_type(recipe_name: str, ingredient_rows: list[IngredientRow]) -> str:
    title = _normalize_title(recipe_name)
    required = _required_ingredient_names(ingredient_rows)
    if any(token in title for token in DINNER_MISMATCH_TOKENS):
        return "breakfast"
    if "soup" in title or "stew" in title or "chili" in title:
        return "soup"
    if "salad" in title:
        return "salad"
    if "bowl" in title:
        return "bowl"
    if "sandwich" in title or "blt" in title or "wrap" in title or "quesadilla" in title or "taco" in title:
        return "handheld"
    if "pasta" in title or "ziti" in title or "noodle" in title or "ramen" in title:
        return "pasta"
    if "rice" in title:
        return "rice"
    if required & {"egg"} and not required & {"chicken", "ground beef", "pork", "fish", "shrimp"}:
        return "breakfast"
    return "dinner"


def _infer_cook_method(recipe_name: str, ingredient_rows: list[IngredientRow]) -> str:
    title = _normalize_title(recipe_name)
    if "oven" in title or "bake" in title or "roast" in title or "sheet pan" in title or "casserole" in title:
        return "oven"
    if "air fryer" in title:
        return "air_fryer"
    if "salad" in title or "wrap" in title:
        return "no_cook"
    if "soup" in title or "stew" in title or "chili" in title:
        return "stovetop"
    if "skillet" in title or "hash" in title or "stir fry" in title or "omelet" in title or "frittata" in title:
        return "skillet"
    if _required_ingredient_names(ingredient_rows) & {"pasta", "rice"}:
        return "stovetop"
    return "skillet"


def _infer_difficulty(recipe: Recipe, ingredient_rows: list[IngredientRow]) -> str:
    required_count = len(_required_ingredient_names(ingredient_rows))
    total_time = recipe.total_time_minutes or 0
    if required_count <= 4 and total_time <= 20:
        return "Easy"
    if required_count <= 6 and total_time <= 35:
        return "Beginner"
    return "Intermediate"


def _infer_equipment(cook_method: str) -> list[str]:
    if cook_method == "oven":
        return ["oven", "sheet pan"]
    if cook_method == "air_fryer":
        return ["air fryer", "mixing bowl"]
    if cook_method == "no_cook":
        return ["mixing bowl", "knife"]
    if cook_method == "stovetop":
        return ["pot", "skillet"]
    return ["skillet", "spatula"]


def _infer_tags(recipe: Recipe, ingredient_rows: list[IngredientRow], meal_type: str, cook_method: str) -> list[str]:
    tags = {meal_type, cook_method}
    required = _required_ingredient_names(ingredient_rows)
    if recipe.total_time_minutes and recipe.total_time_minutes <= 35:
        tags.add("weeknight")
    if required & {"chicken", "ground beef", "ground turkey", "pork", "salmon", "shrimp", "fish"}:
        tags.add("protein_forward")
    if required & {"beans", "black beans", "lentils", "chickpeas", "tofu"}:
        tags.add("pantry_friendly")
    return sorted(tags)


def _infer_tips(recipe: Recipe, ingredient_rows: list[IngredientRow], cook_method: str) -> list[str]:
    required = _required_ingredient_names(ingredient_rows)
    tips: list[str] = []
    if "pasta" in required:
        tips.append("Reserve a splash of pasta water if the finished dish needs loosening.")
    if cook_method in {"oven", "air_fryer"}:
        tips.append("Check doneness a few minutes early since ovens and air fryers can run hot.")
    if "rice" in required and "fried" in _normalize_title(recipe.name):
        tips.append("Cold leftover rice gives the best texture if you have it.")
    if not tips:
        tips.append("Taste at the end and adjust salt, acid, or heat before serving.")
    return tips


def _infer_substitutions(ingredient_rows: list[IngredientRow]) -> list[str]:
    required = _required_ingredient_names(ingredient_rows)
    substitutions: list[str] = []
    if "chicken" in required:
        substitutions.append("Turkey or firm tofu can replace the chicken if needed.")
    if "ground beef" in required:
        substitutions.append("Ground turkey works in place of the beef with a similar cook time.")
    if "pasta" in required:
        substitutions.append("Any short pasta shape works here if that is what you have.")
    if "rice" in required:
        substitutions.append("Cooked leftover rice can shorten the total time.")
    return substitutions[:2]


def _infer_storage(recipe: Recipe) -> list[str]:
    if recipe.meal_type == "salad" or recipe.cook_method == "no_cook":
        return ["Refrigerate leftovers in a sealed container and use within 2 days."]
    return ["Refrigerate leftovers in a sealed container and use within 3 days."]


def _infer_warnings(recipe: Recipe, ingredient_rows: list[IngredientRow]) -> list[str]:
    required = _required_ingredient_names(ingredient_rows)
    warnings: list[str] = []
    if required & {"fish", "salmon", "shrimp", "tilapia", "cod", "catfish"}:
        warnings.append("Cook seafood just until opaque to avoid drying it out.")
    if "ground beef" in required or "ground turkey" in required or "chicken" in required:
        warnings.append("Cook the protein through before combining it with the rest of the dish.")
    return warnings


def _ingredient_profile(name: str, servings: int) -> tuple[float | None, str | None]:
    profile = MEASURE_PROFILES.get(name)
    if profile is None:
        return None, None
    base_quantity, unit = profile
    scale = max(servings, 1) / 2.0
    return round(base_quantity * scale, 2), unit


def _canonical_requirement_from_profile(profile: tuple[float | None, str | None]) -> tuple[float, str, bool]:
    quantity, unit = profile
    if quantity is None or unit is None:
        return 1.0, "ea", False

    normalized = unit.strip().lower()
    if normalized in {"strip", "slice", "clove", "ea", "can"}:
        return float(quantity), "ea", True

    if normalized in {"cup", "tbsp", "tsp", "oz", "lb"}:
        return float(quantity), normalized, True

    return 1.0, "ea", False


def _display_name(name: str) -> str:
    special = {
        "bbq": "BBQ",
        "blt": "BLT",
    }
    words = []
    for word in name.split():
        words.append(special.get(word.lower(), word.capitalize()))
    return " ".join(words)


def _ingredient_note(name: str, is_required: bool) -> str | None:
    if name in STAPLES:
        return "Season to taste."
    if not is_required:
        return "Optional finishing ingredient."
    return None


def _build_short_description(
    recipe_name: str,
    ingredient_rows: list[IngredientRow],
    cook_method: str,
    meal_type: str,
) -> str:
    required = sorted(_required_ingredient_names(ingredient_rows))
    focus = ", ".join(_display_name(name) for name in required[:3])
    method_label = cook_method.replace("_", " ")
    if meal_type == "breakfast":
        return f"A {method_label} meal built around {focus}."
    return f"A {method_label} dinner built around {focus} with a pantry-first ingredient list."


def _timing_hint(recipe: Recipe, index: int, total_steps: int) -> int | None:
    total = recipe.total_time_minutes
    if total is None or total_steps <= 0:
        return None
    return max(1, round(total / total_steps))


def _temperature_hint(recipe: Recipe, index: int, cook_method: str) -> int | None:
    if cook_method == "oven" and index == 2:
        return recipe.oven_temp_f
    if cook_method == "air_fryer" and index == 2:
        return recipe.air_fryer_temp_f
    return None


def _step_equipment(cook_method: str) -> str | None:
    if cook_method == "oven":
        return "sheet pan"
    if cook_method == "air_fryer":
        return "air fryer basket"
    if cook_method == "no_cook":
        return "mixing bowl"
    if cook_method == "stovetop":
        return "pot"
    return "skillet"


def _doneness_hint(line: str) -> str | None:
    lowered = line.lower()
    for phrase in ("golden", "tender", "flaky", "set", "bubbling", "cooked through", "opaque"):
        if phrase in lowered:
            return phrase
    return None
