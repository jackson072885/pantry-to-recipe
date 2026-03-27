from __future__ import annotations

from collections import defaultdict
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.recipe import Recipe, RecipeIngredient
from app.models.ingredient import Ingredient
from app.models.tag import Tag
from app.services.recipe_dataset_service import active_recipe_query


TAG_DEFS: dict[str, list[str]] = {
    "Meal Timing": [
        "Breakfast",
        "Lunch",
        "Dinner",
        "Snack",
        "Dessert",
        "Brunch",
        "Late Night",
    ],
    "Time & Effort": [
        "10 Minutes",
        "20 Minutes",
        "30 Minutes",
        "45+ Minutes",
        "Minimal Prep",
        "One Pan",
        "Set & Forget",
        "Low Cleanup",
    ],
    "Cooking Method": [
        "Skillet",
        "Oven",
        "Air Fryer",
        "Grill",
        "Slow Cooker",
        "Instant Pot",
        "No Cook",
        "Sheet Pan",
    ],
    "Protein Base": [
        "Chicken",
        "Beef",
        "Pork",
        "Fish",
        "Seafood",
        "Egg-Based",
        "Vegetarian",
        "Vegan",
        "Mixed Protein",
    ],
    "Cuisine Influence": [
        "American",
        "Southern",
        "Mexican",
        "Italian",
        "Asian",
        "Mediterranean",
        "BBQ",
        "Tex-Mex",
        "Comfort Classic",
        "Fusion",
    ],
    "Style / Outcome": [
        "Comfort Food",
        "Healthy",
        "High Protein",
        "Low Carb",
        "Budget Friendly",
        "Kid Friendly",
        "Date Night",
        "Meal Prep",
        "Party Food",
        "Light & Fresh",
    ],
    "Difficulty": [
        "Beginner",
        "Moderate",
        "Advanced",
    ],
    "Ingredient Density": [
        "5 Ingredients or Less",
        "Pantry Heavy",
        "Fresh Produce Heavy",
    ],
    "Texture / Outcome": [
        "Crispy",
        "Creamy",
        "Saucy",
        "Baked",
        "Grilled",
    ],
    "Temperature": [
        "Hot",
        "Cold",
        "Room Temp",
    ],
}

FILTER_GROUPS: dict[str, list[str]] = {
    "cuisine": ["Cuisine Influence"],
    "meal_type": ["Meal Timing"],
    "method": ["Cooking Method"],
    "style": [
        "Style / Outcome",
        "Time & Effort",
        "Difficulty",
        "Ingredient Density",
        "Texture / Outcome",
        "Temperature",
    ],
    "ingredients": ["Protein Base"],
}


def _slugify(value: str) -> str:
    return (
        value.strip()
        .lower()
        .replace("+", "plus")
        .replace("&", "and")
        .replace("/", "-")
        .replace("  ", " ")
        .replace(" ", "-")
    )


def ensure_tags(db: Session) -> list[Tag]:
    existing = {tag.slug: tag for tag in db.query(Tag).all()}
    created: list[Tag] = []

    for group, tags in TAG_DEFS.items():
        for display in tags:
            slug = _slugify(display)
            if slug in existing:
                continue
            tag = Tag(
                group_name=group,
                display_name=display,
                slug=slug,
                weight=0,
            )
            db.add(tag)
            created.append(tag)

    if created:
        db.commit()
    return db.query(Tag).all()


def _keyword_map() -> dict[str, list[str]]:
    return {
        "chicken": ["Chicken", "Dinner", "High Protein"],
        "beef": ["Beef", "Dinner", "Comfort Food"],
        "pork": ["Pork", "Dinner"],
        "fish": ["Fish", "Dinner", "Light & Fresh"],
        "seafood": ["Seafood", "Dinner", "Light & Fresh"],
        "egg": ["Egg-Based", "Breakfast"],
        "salad": ["Vegetarian", "Light & Fresh"],
        "pasta": ["Italian", "Dinner"],
        "taco": ["Mexican", "Dinner"],
        "nachos": ["Tex-Mex", "Snack"],
        "sandwich": ["Lunch"],
        "toast": ["Breakfast"],
        "pancake": ["Breakfast"],
        "oatmeal": ["Breakfast"],
        "soup": ["Dinner"],
        "chili": ["Dinner"],
        "quesadilla": ["Mexican", "Lunch"],
        "grilled": ["Grilled"],
        "baked": ["Baked"],
        "creamy": ["Creamy"],
    }


def _infer_tags(name: str, ingredient_names: list[str], tag_by_display: dict[str, Tag]) -> set[Tag]:
    text = f"{name} {' '.join(ingredient_names)}".lower()
    matched: set[Tag] = set()

    for keyword, tag_names in _keyword_map().items():
        if keyword in text:
            for tag_name in tag_names:
                tag = tag_by_display.get(tag_name)
                if tag:
                    matched.add(tag)

    return matched


def assign_tags_to_recipes(db: Session, tags: Iterable[Tag]) -> None:
    tag_by_display = {tag.display_name: tag for tag in tags}

    recipes = active_recipe_query(db).all()
    if not recipes:
        return

    rows = (
        db.query(RecipeIngredient.recipe_id, Ingredient.canonical_name)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .all()
    )
    ingredient_map: dict[int, list[str]] = defaultdict(list)
    for recipe_id, ingredient_name in rows:
        ingredient_map[recipe_id].append(ingredient_name)

    updated = False

    for recipe in recipes:
        if recipe.tags:
            continue

        matched = _infer_tags(recipe.name, ingredient_map.get(recipe.id, []), tag_by_display)
        if not matched:
            continue

        for tag in matched:
            recipe.tags.append(tag)
        updated = True

    if updated:
        db.commit()


def get_grouped_tags(tags: Iterable[Tag]) -> list[dict]:
    grouped: dict[str, list[Tag]] = defaultdict(list)
    for tag in tags:
        grouped[tag.group_name].append(tag)

    result = []
    for group_name, items in grouped.items():
        result.append({
            "name": group_name,
            "tags": sorted(items, key=lambda t: (t.weight, t.display_name)),
        })

    return sorted(result, key=lambda g: g["name"].lower())


def get_filter_options(db: Session) -> dict[str, list[str]]:
    tags = ensure_tags(db)
    tag_by_group: dict[str, list[Tag]] = defaultdict(list)
    for tag in tags:
        tag_by_group[tag.group_name].append(tag)

    def group_tags(group_names: list[str]) -> list[str]:
        items = []
        for name in group_names:
            items.extend(tag_by_group.get(name, []))
        items.sort(key=lambda t: (t.weight, t.display_name))
        return [tag.display_name for tag in items]

    ingredients = [
        row[0]
        for row in db.query(Ingredient.canonical_name).order_by(Ingredient.canonical_name).all()
    ]

    ingredient_tags = group_tags(FILTER_GROUPS["ingredients"])
    combined_ingredients = sorted(
        {name for name in ingredients + ingredient_tags},
        key=lambda s: s.lower(),
    )

    return {
        "cuisine": group_tags(FILTER_GROUPS["cuisine"]),
        "meal_type": group_tags(FILTER_GROUPS["meal_type"]),
        "method": group_tags(FILTER_GROUPS["method"]),
        "ingredients": combined_ingredients,
        "style": group_tags(FILTER_GROUPS["style"]),
    }


def _normalize(value: str) -> str:
    return value.strip().lower()


def search_recipes(
    db: Session,
    include: dict[str, list[str]],
    exclude: dict[str, list[str]],
    filters: dict[str, list[str]] | None = None,
    mode: dict[str, str] | None = None,
) -> dict:
    tags = ensure_tags(db)
    assign_tags_to_recipes(db, tags)

    tag_by_slug = {tag.slug: tag for tag in tags}

    use_new_filters = bool(filters) or bool(mode)
    filters = filters or {}
    mode = mode or {}

    include_map = {}
    exclude_set = set()

    if not use_new_filters:
        include_map = {
            group: [tag_by_slug[slug] for slug in slugs if slug in tag_by_slug]
            for group, slugs in include.items()
        }
        exclude_set = {
            tag_by_slug[slug].id
            for slugs in exclude.values()
            for slug in slugs
            if slug in tag_by_slug
        }

    recipes = active_recipe_query(db).all()
    results = []

    ingredient_rows = (
        db.query(RecipeIngredient.recipe_id, Ingredient.canonical_name)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .all()
    )
    ingredient_map: dict[int, list[str]] = defaultdict(list)
    for recipe_id, ingredient_name in ingredient_rows:
        ingredient_map[recipe_id].append(ingredient_name)

    for recipe in recipes:
        recipe_tag_ids = {tag.id for tag in recipe.tags}

        if not use_new_filters and exclude_set.intersection(recipe_tag_ids):
            continue

        if use_new_filters:
            include_groups = [
                (group, values)
                for group, values in filters.items()
                if values
            ]
        else:
            include_groups = [
                group_tags for group_tags in include_map.values() if group_tags
            ]

        matched_groups = 0
        total_groups = len(include_groups)

        if use_new_filters:
            recipe_tag_values: dict[str, set[str]] = {
                "cuisine": set(),
                "meal_type": set(),
                "method": set(),
                "style": set(),
                "ingredients": set(),
            }

            for tag in recipe.tags:
                normalized_display = _normalize(tag.display_name)
                normalized_slug = _normalize(tag.slug)
                if tag.group_name in FILTER_GROUPS["cuisine"]:
                    recipe_tag_values["cuisine"].update([normalized_display, normalized_slug])
                if tag.group_name in FILTER_GROUPS["meal_type"]:
                    recipe_tag_values["meal_type"].update([normalized_display, normalized_slug])
                if tag.group_name in FILTER_GROUPS["method"]:
                    recipe_tag_values["method"].update([normalized_display, normalized_slug])
                if tag.group_name in FILTER_GROUPS["style"]:
                    recipe_tag_values["style"].update([normalized_display, normalized_slug])
                if tag.group_name in FILTER_GROUPS["ingredients"]:
                    recipe_tag_values["ingredients"].update([normalized_display, normalized_slug])

            recipe_ingredients = {
                _normalize(name) for name in ingredient_map.get(recipe.id, [])
            }
            recipe_tag_values["ingredients"].update(recipe_ingredients)

            for group, values in include_groups:
                required = [_normalize(value) for value in values]
                available = recipe_tag_values.get(group, set())
                mode_value = _normalize(mode.get(group, "any"))
                if mode_value == "all":
                    matched = all(value in available for value in required)
                else:
                    matched = any(value in available for value in required)
                if matched:
                    matched_groups += 1
        else:
            for group_tags in include_groups:
                if any(tag.id in recipe_tag_ids for tag in group_tags):
                    matched_groups += 1

        results.append({
            "recipe": recipe,
            "matched_groups": matched_groups,
            "total_groups": total_groups,
        })

    cook_now = []
    almost_there = []
    not_practical = []

    for entry in results:
        recipe = entry["recipe"]
        matched_groups = entry["matched_groups"]
        total_groups = entry["total_groups"]

        matched_tags = [tag.slug for tag in recipe.tags]
        missing_count = max(total_groups - matched_groups, 0)

        if total_groups == 0 or matched_groups == total_groups:
            cook_now.append({
                "recipe": recipe,
                "matched_tags": matched_tags,
                "missing_count": missing_count,
            })
        elif matched_groups > 0:
            almost_there.append({
                "recipe": recipe,
                "matched_tags": matched_tags,
                "missing_count": missing_count,
            })
        else:
            not_practical.append({
                "recipe": recipe,
                "matched_tags": matched_tags,
                "missing_count": missing_count,
            })

    def sort_key(item):
        return item["recipe"].name.lower()

    cook_now.sort(key=sort_key)
    almost_there.sort(key=sort_key)
    not_practical.sort(key=sort_key)

    return {
        "cook_now": cook_now,
        "almost_there": almost_there,
        "not_practical": not_practical,
        "meta": {
            "total": len(results),
        },
    }
