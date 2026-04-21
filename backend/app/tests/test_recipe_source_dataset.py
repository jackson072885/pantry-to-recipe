from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


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
TIME_TAGS = {"15_min", "30_min", "45_min_plus"}
DIFFICULTY_TAGS = {"easy", "medium"}
COST_TAGS = {"budget", "moderate"}
CLEANUP_TAGS = {"one_pan", "one_pot", "sheet_pan", "multi_pan"}
STYLE_TAGS = {
    "tacos",
    "quesadillas",
    "fajitas",
    "burrito_bowls",
    "enchilada_style",
    "tostadas",
    "bean_forward",
    "rice_skillet",
}
PLACEHOLDER_PATTERNS = ("placeholder", "todo", "lorem ipsum", "tbd", "until done")


def _dataset_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "recipes_real_v1.json"


def _normalize_title(value: str) -> str:
    lowered = value.strip().lower()
    lowered = re.sub(r"[^a-z0-9\\s]", "", lowered)
    return re.sub(r"\\s+", " ", lowered).strip()


def test_recipe_source_dataset_contract() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    assert isinstance(rows, list)
    assert len(rows) >= 450

    normalized_titles = [_normalize_title(row["name"]) for row in rows]
    assert len(normalized_titles) == len(set(normalized_titles))

    cuisine_counts = Counter()
    style_coverage: set[str] = set()
    seafood_count = 0
    seafood_cuisines: set[str] = set()

    for row in rows:
        assert (row.get("name") or "").strip() != ""
        assert isinstance(row.get("required"), list) and len(row["required"]) >= 2
        assert isinstance(row.get("optional"), list)
        assert (row.get("instructions") or "").strip() != ""
        lowered_instructions = row["instructions"].strip().lower()
        assert not any(token in lowered_instructions for token in PLACEHOLDER_PATTERNS)
        assert lowered_instructions.count(".") >= 2

        cuisine = row.get("cuisine")
        assert cuisine in VALID_CUISINES
        cuisine_counts[cuisine] += 1

        required = {str(item).strip().lower() for item in row.get("required", [])}
        if required & {"shrimp", "salmon", "cod", "tilapia", "catfish", "white fish", "tuna"}:
            seafood_count += 1
            seafood_cuisines.add(cuisine)

        tags = row.get("tags")
        assert isinstance(tags, list) and tags
        assert len(tags) == len(set(tags))
        assert all(tag == tag.lower() for tag in tags)
        assert all("-" not in tag for tag in tags)
        assert all(" " not in tag for tag in tags)
        assert all(re.fullmatch(r"[a-z0-9_]+", tag) for tag in tags)

        assert len(set(tags) & TIME_TAGS) == 1
        assert len(set(tags) & DIFFICULTY_TAGS) == 1
        assert len(set(tags) & COST_TAGS) == 1
        assert len(set(tags) & CLEANUP_TAGS) == 1
        style_coverage.update(set(tags) & STYLE_TAGS)

    assert cuisine_counts["asian"] >= 80
    assert cuisine_counts["tex_mex"] >= 40
    assert cuisine_counts["mexican"] >= 35
    assert cuisine_counts["mediterranean"] >= 40
    assert cuisine_counts["italian"] >= 40
    assert cuisine_counts["indian"] >= 35
    assert cuisine_counts["southern"] >= 30
    assert cuisine_counts["bbq"] >= 25
    assert seafood_count >= 80
    assert len(seafood_cuisines) >= 7
    assert style_coverage == STYLE_TAGS


def test_recipe_source_dataset_aligns_high_value_browser_ingredients() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    recipes_by_name = {row["name"]: row for row in rows}

    assert recipes_by_name["Salsa Verde Chicken Burrito Bowl"]["optional"] == [
        "salsa verde",
        "corn",
        "cheddar",
        "cilantro",
    ]
    assert recipes_by_name["Verde Bean Enchiladas"]["required"] == [
        "black beans",
        "corn tortillas",
        "salsa verde",
    ]
    assert recipes_by_name["Creamy White Chicken Chili"]["required"] == [
        "chicken",
        "white beans",
        "onion",
    ]
    assert recipes_by_name["Salsa Verde Turkey Skillet"]["required"] == [
        "ground turkey",
        "rice",
        "salsa verde",
    ]
    assert recipes_by_name["Turkey Taco Rice Skillet"]["required"] == [
        "ground turkey",
        "rice",
        "salsa",
    ]
    assert recipes_by_name["Korean-Inspired Beef Sesame Rice Bowls"]["required"] == [
        "ground beef",
        "rice",
        "cabbage",
    ]
    assert recipes_by_name["Green Chile Beef Rice Bowls"]["required"] == [
        "ground beef",
        "rice",
        "green chiles",
    ]
    assert recipes_by_name["Sticky Soy Chicken Thigh Tray"]["required"] == [
        "chicken thighs",
        "cabbage",
        "rice",
    ]
    assert recipes_by_name["Mozzarella Chicken Parmesan Bake"]["required"] == [
        "chicken breast",
        "tomato sauce",
        "mozzarella",
    ]
    assert recipes_by_name["Skillet Chicken Parmesan Pasta"]["required"] == [
        "chicken breast",
        "pasta",
        "tomato sauce",
    ]
    assert recipes_by_name["Chicken Mozzarella Bake"]["required"] == [
        "chicken breast",
        "pasta",
        "tomato sauce",
    ]
    assert recipes_by_name["Smothered Pork Chop Rice"]["required"] == [
        "pork chops",
        "rice",
        "onion",
    ]
    assert recipes_by_name["Beef and Potato Tacos"]["required"] == [
        "ground beef",
        "potato",
        "corn tortillas",
    ]
    assert recipes_by_name["Ground Beef Quesadillas"]["required"] == [
        "ground beef",
        "flour tortillas",
        "cheddar",
    ]
    assert recipes_by_name["Lime Slaw Fish Tacos"]["required"] == [
        "white fish",
        "corn tortillas",
        "cabbage",
    ]
    assert recipes_by_name["Sizzling Chicken Fajitas"]["optional"] == [
        "flour tortillas",
        "lime",
        "cumin",
    ]
    assert recipes_by_name["Chicken Tortilla Soup"]["required"] == [
        "chicken",
        "tomato sauce",
        "corn tortillas",
    ]
    assert recipes_by_name["Chicken Tortilla Rice Soup"]["optional"] == [
        "corn tortillas",
        "lime",
        "cilantro",
    ]
    assert recipes_by_name["Baked Ravioli with Sausage"]["required"] == [
        "sausage",
        "ravioli",
        "marinara",
    ]
    assert recipes_by_name["Cheesy Baked Ziti"]["required"] == [
        "pasta",
        "marinara",
        "mozzarella",
    ]
    assert recipes_by_name["One Pot Sausage Marinara Pasta"]["required"] == [
        "sausage",
        "pasta",
        "marinara",
    ]
    assert recipes_by_name["Red Chicken Enchiladas"]["required"] == [
        "chicken",
        "corn tortillas",
        "enchilada sauce",
    ]
    assert recipes_by_name["Black Bean Enchilada Skillet"]["required"] == [
        "black beans",
        "corn tortillas",
        "enchilada sauce",
    ]
    assert recipes_by_name["Veggie Black Bean Quesadillas"]["optional"] == [
        "onion",
        "salsa",
        "black beans",
    ]
    assert recipes_by_name["Chicken Enchilada Rice Skillet"]["required"] == [
        "chicken",
        "rice",
        "enchilada sauce",
    ]
    assert recipes_by_name["Beef Enchilada Casserole"]["required"] == [
        "ground beef",
        "corn tortillas",
        "enchilada sauce",
    ]
    assert recipes_by_name["Bean and Cheese Enchilada Bake"]["optional"] == [
        "enchilada sauce",
        "green onion",
        "corn",
    ]
    assert recipes_by_name["Beef Sloppy Joes"]["required"] == [
        "ground beef",
        "tomato paste",
        "bread",
    ]
    assert recipes_by_name["Homestyle Beef Vegetable Soup"]["optional"] == [
        "onion",
        "diced tomatoes",
        "green beans",
    ]
    assert recipes_by_name["Lentil Tomato Stew"]["required"] == [
        "lentils",
        "diced tomatoes",
        "onion",
    ]
    assert recipes_by_name["Zucchini Chickpea Orzo"]["required"] == [
        "chickpeas",
        "orzo",
        "zucchini",
    ]
    assert recipes_by_name["Chicken Orzo Soup"]["required"] == [
        "chicken",
        "orzo",
        "spinach",
    ]
    assert recipes_by_name["Chicken White Bean Soup"]["required"] == [
        "chicken",
        "white beans",
        "spinach",
    ]
    assert recipes_by_name["Creamy White Bean Chicken Soup"]["required"] == [
        "chicken",
        "white beans",
        "spinach",
    ]
    assert recipes_by_name["Minestrone Soup"]["required"] == [
        "pasta",
        "beans",
        "crushed tomatoes",
    ]
    assert recipes_by_name["Sausage Tortellini Soup"]["required"] == [
        "sausage",
        "tortellini",
        "tomato sauce",
    ]
    assert recipes_by_name["Classic Chicken Noodle Soup"]["required"] == [
        "chicken",
        "noodles",
        "carrot",
    ]
    assert recipes_by_name["Scallion Egg Fried Noodles"]["required"] == [
        "egg",
        "noodles",
        "soy sauce",
    ]
    assert recipes_by_name["Shrimp Garlic Noodles"]["required"] == [
        "shrimp",
        "noodles",
        "garlic",
    ]
    assert recipes_by_name["Creamy Beef Stroganoff Skillet Noodles"]["required"] == [
        "beef",
        "noodles",
        "mushroom",
    ]
    assert recipes_by_name["Creamy Tuna Noodle Casserole"]["required"] == [
        "tuna",
        "noodles",
        "cream",
    ]
    assert recipes_by_name["Turkey Chili"]["required"] == [
        "ground turkey",
        "crushed tomatoes",
        "beans",
    ]
    assert recipes_by_name["Paprika Catfish Corn Skillet"]["required"] == [
        "white fish",
        "corn",
        "onion",
    ]
    assert recipes_by_name["Crispy Lemon Pan-Fried Bass"]["required"] == [
        "white fish",
        "oil",
        "salt",
    ]


def test_recipe_source_dataset_keeps_representative_dairy_leaf_matches_honest() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    recipes_by_name = {row["name"]: row for row in rows}

    baked_ravioli = recipes_by_name["Baked Ravioli with Sausage"]
    assert "mozzarella" in baked_ravioli["optional"]
    assert "parmesan" in baked_ravioli["optional"]
    assert "mozzarella" in baked_ravioli["instructions"].lower()
    assert "parmesan" in baked_ravioli["instructions"].lower()

    chicken_mozzarella_bake = recipes_by_name["Chicken Mozzarella Bake"]
    assert chicken_mozzarella_bake["optional"] == ["mozzarella", "parmesan", "parsley"]
    assert "mozzarella" in chicken_mozzarella_bake["instructions"].lower()
    assert "parmesan" in chicken_mozzarella_bake["instructions"].lower()

    greek_stuffed_peppers = recipes_by_name["Greek Stuffed Peppers"]
    assert "feta" in greek_stuffed_peppers["optional"]
    assert "feta" in greek_stuffed_peppers["instructions"].lower()

    bbq_chicken_stuffed_potatoes = recipes_by_name["BBQ Chicken Stuffed Potatoes"]
    assert "sour cream" in bbq_chicken_stuffed_potatoes["optional"]
    assert "sour cream" in bbq_chicken_stuffed_potatoes["instructions"].lower()

    creamy_white_bean_chicken_soup = recipes_by_name["Creamy White Bean Chicken Soup"]
    assert "milk" in creamy_white_bean_chicken_soup["optional"]
    assert "milk" in creamy_white_bean_chicken_soup["instructions"].lower()

    curried_tuna_rice_bowls = recipes_by_name["Curried Tuna Rice Bowls"]
    assert "yogurt" in curried_tuna_rice_bowls["required"]
    assert "yogurt" in curried_tuna_rice_bowls["instructions"].lower()


def test_recipe_source_dataset_aligns_aromatic_and_herb_browser_leaves() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    recipes_by_name = {row["name"]: row for row in rows}

    assert recipes_by_name["Salsa Verde Chicken Burrito Bowl"]["optional"] == [
        "salsa verde",
        "corn",
        "cheddar",
        "cilantro",
    ]
    assert recipes_by_name["Teriyaki Salmon Edamame Bowls"]["optional"] == [
        "cucumber",
        "teriyaki sauce",
        "green onion",
        "ginger",
    ]
    assert recipes_by_name["Ginger Soy Chicken Cucumber Bowls"]["optional"] == [
        "carrot",
        "mayo",
        "green onion",
        "ginger",
    ]
    assert recipes_by_name["Ginger Garlic Pork Noodles"]["optional"] == [
        "cabbage",
        "carrot",
        "green onion",
        "ginger",
        "garlic",
    ]
    assert recipes_by_name["Ginger Snap Pea Chicken Stir-Fry"]["optional"] == [
        "carrot",
        "green onion",
        "rice",
        "ginger",
    ]
    assert recipes_by_name["Soy Ginger Mushroom Cabbage Stir-Fry"]["optional"] == [
        "carrot",
        "green onion",
        "rice",
        "ginger",
    ]
    assert recipes_by_name["Salmon Edamame Fried Rice"]["optional"] == [
        "green onion",
        "sesame oil",
        "carrot",
        "ginger",
    ]
    assert recipes_by_name["Garlic Lime Shrimp Tostadas"]["optional"] == [
        "cabbage",
        "mayo",
        "hot sauce",
        "garlic",
    ]
    assert recipes_by_name["Garlic Sesame Chicken Noodle Bowls"]["optional"] == [
        "green onion",
        "carrot",
        "sesame oil",
        "garlic",
    ]
    assert recipes_by_name["Garlic Lime Fish Tacos"]["optional"] == [
        "cabbage",
        "mayo",
        "cilantro",
        "garlic",
    ]
    assert recipes_by_name["Garlic Shrimp Skillet"]["optional"] == [
        "cilantro",
        "lime",
        "yogurt",
        "garlic",
    ]
    assert recipes_by_name["Tomato Basil White Fish Pasta"]["optional"] == [
        "parmesan",
        "parsley",
        "lemon",
        "basil",
    ]


def test_recipe_source_dataset_aligns_cheese_and_dairy_browser_leaves() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    recipes_by_name = {row["name"]: row for row in rows}

    assert recipes_by_name["Minestrone Soup"]["optional"] == [
        "carrot",
        "celery",
        "zucchini",
        "parmesan",
    ]
    assert recipes_by_name["Turkey Chili"]["optional"] == [
        "onion",
        "garlic",
        "chili powder",
        "cheddar",
        "sour cream",
    ]
    assert recipes_by_name["Tomato Feta Chicken Skillet"]["optional"] == [
        "feta",
        "parsley",
        "lemon",
        "olive oil",
    ]
    assert recipes_by_name["Cheddar Broccoli Chicken Sheet Pan"]["optional"] == [
        "cheddar",
        "parsley",
        "pepper",
        "butter",
    ]
    assert recipes_by_name["Cheddar Beef Rice Soup"]["optional"] == [
        "cheddar",
        "parsley",
        "pepper",
        "milk",
    ]
    assert recipes_by_name["Coconut Shrimp Curry"]["optional"] == [
        "cilantro",
        "lime",
        "onion",
        "yogurt",
    ]
    assert recipes_by_name["Coconut Salmon Curry"]["optional"] == [
        "cilantro",
        "lime",
        "onion",
        "yogurt",
    ]
    assert recipes_by_name["Ginger Garlic Chicken Curry"]["optional"] == [
        "cilantro",
        "lime",
        "onion",
        "yogurt",
    ]
    assert recipes_by_name["Tomato Cod Curry"]["optional"] == [
        "cilantro",
        "lime",
        "onion",
        "yogurt",
    ]
    assert recipes_by_name["Chickpea Spinach Chickpea Curry"]["optional"] == [
        "cilantro",
        "lime",
        "onion",
        "yogurt",
    ]
    assert recipes_by_name["Lentil Tomato Lentil Curry"]["optional"] == [
        "cilantro",
        "lime",
        "onion",
        "yogurt",
    ]
