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
MIN_DATASET_RECIPE_COUNT = 260
MIN_CUISINE_COUNTS = {
    "asian": 65,
    "tex_mex": 30,
    "mexican": 30,
    "mediterranean": 18,
    "italian": 25,
    "indian": 18,
    "southern": 20,
    "bbq": 8,
}
MIN_SEAFOOD_RECIPE_COUNT = 75
MIN_SEAFOOD_CUISINE_COUNT = 7


def _dataset_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "recipes_real_v1.json"


def _normalize_title(value: str) -> str:
    lowered = value.strip().lower()
    lowered = re.sub(r"[^a-z0-9\\s]", "", lowered)
    return re.sub(r"\\s+", " ", lowered).strip()


def test_recipe_source_dataset_contract() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    assert isinstance(rows, list)
    assert len(rows) >= MIN_DATASET_RECIPE_COUNT

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

    for cuisine, minimum_count in MIN_CUISINE_COUNTS.items():
        assert cuisine_counts[cuisine] >= minimum_count
    assert seafood_count >= MIN_SEAFOOD_RECIPE_COUNT
    assert len(seafood_cuisines) >= MIN_SEAFOOD_CUISINE_COUNT
    assert style_coverage == STYLE_TAGS


def test_recipe_source_dataset_aligns_high_value_browser_ingredients() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    recipes_by_name = {row["name"]: row for row in rows}

    assert recipes_by_name["Salsa Verde Chicken Burrito Bowl"]["required"] == [
        "chicken",
        "rice",
        "black beans",
        "salsa verde",
    ]
    assert recipes_by_name["Salsa Verde Chicken Burrito Bowl"]["optional"] == [
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
        "green chiles",
        "cream",
    ]
    assert "Turkey Taco Rice Skillet" not in recipes_by_name
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
        "mozzarella",
        "parmesan",
    ]
    assert recipes_by_name["Chicken Mozzarella Bake"]["required"] == [
        "chicken breast",
        "pasta",
        "tomato sauce",
    ]
    assert "Smothered Pork Chop Rice" not in recipes_by_name
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
        "lime",
    ]
    assert "Sizzling Chicken Fajitas" not in recipes_by_name
    assert recipes_by_name["Chicken Tortilla Soup"]["required"] == [
        "chicken",
        "tomato sauce",
        "corn tortillas",
    ]
    assert recipes_by_name["Chicken Tortilla Rice Soup"]["optional"] == [
        "corn tortillas",
        "lime",
        "cilantro",
        "chicken broth",
    ]
    assert recipes_by_name["Baked Ravioli with Sausage"]["required"] == [
        "sausage",
        "ravioli",
        "marinara",
    ]
    assert recipes_by_name["Cheesy Baked Ziti"]["required"] == [
        "ziti",
        "marinara",
        "mozzarella",
        "parmesan",
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
        "beef broth",
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
        "steak",
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
        "chili powder",
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

    assert "Curried Tuna Rice Bowls" not in recipes_by_name


def test_recipe_source_dataset_keeps_title_promised_specific_leaves_honest() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    recipes_by_name = {row["name"]: row for row in rows}

    pesto_salmon_pasta = recipes_by_name["Pesto Salmon Pasta"]
    assert pesto_salmon_pasta["required"] == ["salmon", "pasta", "pesto"]
    assert pesto_salmon_pasta["optional"] == ["spinach", "parmesan", "lemon"]
    assert "pesto" in pesto_salmon_pasta["instructions"].lower()

    ginger_chicken_fried_rice = recipes_by_name["Ginger Chicken Fried Rice"]
    assert "ginger" in ginger_chicken_fried_rice["required"]
    assert "ginger" in ginger_chicken_fried_rice["instructions"].lower()

    coconut_ginger_chickpea_curry = recipes_by_name["Coconut Ginger Chickpea Curry"]
    assert coconut_ginger_chickpea_curry["required"] == ["chickpeas", "coconut milk", "onion", "ginger"]
    assert "ginger" in coconut_ginger_chickpea_curry["instructions"].lower()

    soy_ginger_shrimp_lo_mein = recipes_by_name["Soy Ginger Shrimp Lo Mein"]
    assert soy_ginger_shrimp_lo_mein["required"] == ["shrimp", "noodles", "soy sauce", "ginger"]
    assert "ginger" in soy_ginger_shrimp_lo_mein["instructions"].lower()

    garlic_ginger_pork_stir_fry = recipes_by_name["Garlic Ginger Pork Stir-Fry"]
    assert garlic_ginger_pork_stir_fry["required"] == ["pork", "soy sauce", "bell pepper", "garlic", "ginger"]
    assert "garlic" in garlic_ginger_pork_stir_fry["instructions"].lower()
    assert "ginger" in garlic_ginger_pork_stir_fry["instructions"].lower()

    assert "Garlic Vegetable Fried Rice" not in recipes_by_name

    ginger_garlic_chicken_curry = recipes_by_name["Ginger Garlic Chicken Curry"]
    assert ginger_garlic_chicken_curry["required"] == ["chicken", "rice", "tomato sauce", "ginger", "garlic", "curry powder"]
    assert "ginger" in ginger_garlic_chicken_curry["instructions"].lower()
    assert "garlic" in ginger_garlic_chicken_curry["instructions"].lower()
    assert "curry powder" in ginger_garlic_chicken_curry["instructions"].lower()

    ginger_chicken_lentil_skillet = recipes_by_name["Ginger Chicken Lentil Skillet"]
    assert ginger_chicken_lentil_skillet["required"] == ["chicken", "lentils", "spinach", "ginger"]
    assert ginger_chicken_lentil_skillet["optional"] == ["rice", "cilantro", "lime", "yogurt"]
    assert "lentils" in ginger_chicken_lentil_skillet["instructions"].lower()
    assert "ginger" in ginger_chicken_lentil_skillet["instructions"].lower()

    garlic_spinach_lentil_curry = recipes_by_name["Garlic Spinach Lentil Curry"]
    assert garlic_spinach_lentil_curry["required"] == ["lentils", "rice", "spinach", "garlic"]
    assert "garlic" in garlic_spinach_lentil_curry["instructions"].lower()


def test_recipe_source_dataset_keeps_representative_beef_leaves_honest() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    recipes_by_name = {row["name"]: row for row in rows}

    ginger_soy_beef = recipes_by_name["Ginger Soy Beef and Broccoli Stir-Fry"]
    assert ginger_soy_beef["required"] == ["steak", "broccoli", "ginger", "soy sauce"]
    assert "steak" in ginger_soy_beef["instructions"].lower()

    black_pepper_beef = recipes_by_name["Black Pepper Beef Broccoli Stir-Fry"]
    assert black_pepper_beef["required"] == ["steak", "broccoli", "soy sauce", "garlic", "pepper"]
    assert "steak" in black_pepper_beef["instructions"].lower()

    bok_choy_beef = recipes_by_name["Garlic Bok Choy Beef Stir-Fry"]
    assert bok_choy_beef["required"] == ["steak", "bok choy", "soy sauce"]
    assert "steak" in bok_choy_beef["instructions"].lower()

    beef_fajita_bowls = recipes_by_name["Beef Fajita Rice Bowls"]
    assert beef_fajita_bowls["required"] == ["steak", "rice", "bell pepper"]
    assert "steak" in beef_fajita_bowls["instructions"].lower()

    beef_stroganoff = recipes_by_name["Creamy Beef Stroganoff Skillet Noodles"]
    assert beef_stroganoff["required"] == ["steak", "noodles", "mushroom"]
    assert "steak" in beef_stroganoff["instructions"].lower()

    japanese_beef_curry = recipes_by_name["Japanese-Inspired Beef Curry Bowls"]
    assert japanese_beef_curry["required"] == ["beef", "rice", "potato"]
    assert "steak" not in japanese_beef_curry["instructions"].lower()



def test_recipe_source_dataset_aligns_aromatic_and_herb_browser_leaves() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    recipes_by_name = {row["name"]: row for row in rows}

    assert recipes_by_name["Salsa Verde Chicken Burrito Bowl"]["optional"] == [
        "corn",
        "cheddar",
        "cilantro",
    ]
    assert recipes_by_name["Teriyaki Salmon Edamame Bowls"]["required"] == [
        "salmon",
        "rice",
        "edamame",
        "teriyaki sauce",
        "cucumber",
    ]
    assert recipes_by_name["Teriyaki Salmon Edamame Bowls"]["optional"] == [
        "green onion",
        "ginger",
    ]
    assert "Ginger Soy Chicken Cucumber Bowls" not in recipes_by_name
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
    assert "Soy Ginger Mushroom Cabbage Stir-Fry" not in recipes_by_name
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
    assert recipes_by_name["Garlic Sesame Chicken Noodle Bowls"]["required"] == [
        "chicken",
        "noodles",
        "soy sauce",
        "sesame oil",
        "garlic",
    ]
    assert recipes_by_name["Garlic Sesame Chicken Noodle Bowls"]["optional"] == [
        "green onion",
        "carrot",
    ]
    assert recipes_by_name["Garlic Lime Fish Tacos"]["optional"] == [
        "cabbage",
        "mayo",
        "cilantro",
        "garlic",
    ]
    assert "Tomato Basil White Fish Pasta" not in recipes_by_name


def test_recipe_source_dataset_keeps_condiment_oil_and_broth_leaves_honest() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    recipes_by_name = {row["name"]: row for row in rows}

    assert recipes_by_name["Spicy Shrimp Sushi Rice Bowls"]["optional"] == [
        "soy sauce",
        "sriracha",
        "mayo",
        "avocado",
        "green onion",
    ]
    assert "Sriracha Garlic Shrimp Cabbage Stir-Fry" not in recipes_by_name
    assert "Ginger Soy Chicken Cucumber Bowls" not in recipes_by_name
    assert recipes_by_name["Sesame Tuna Cucumber Rice Bowls"]["optional"] == [
        "mayo",
        "sesame oil",
        "carrot",
        "green onion",
    ]
    assert recipes_by_name["Sesame Edamame Udon Bowls"]["optional"] == [
        "soy sauce",
        "sesame oil",
        "cucumber",
        "green onion",
    ]
    assert recipes_by_name["Sesame Green Bean Pork Stir-Fry"]["optional"] == [
        "carrot",
        "green onion",
        "rice",
        "sesame oil",
    ]
    assert recipes_by_name["Sesame Edamame Tofu Stir-Fry"]["optional"] == [
        "carrot",
        "green onion",
        "rice",
        "sesame oil",
    ]
    assert "Soy Ginger Mushroom Cabbage Stir-Fry" not in recipes_by_name
    assert recipes_by_name["Miso Mushroom Fried Rice"]["optional"] == [
        "green onion",
        "carrot",
        "miso",
        "sesame oil",
        "soy sauce",
    ]
    assert "BBQ Shrimp Corn Bowls" not in recipes_by_name
    assert "BBQ Chicken Black Bean Bowls" not in recipes_by_name
    assert "Tex-Mex Tuna Melt Quesadillas" not in recipes_by_name
    assert recipes_by_name["Spinach Feta Chicken Pasta"]["optional"] == [
        "feta",
        "parsley",
        "lemon",
        "olive oil",
    ]
    assert recipes_by_name["Classic Chicken Noodle Soup"]["optional"] == [
        "celery",
        "onion",
        "parsley",
        "chicken broth",
    ]
    assert recipes_by_name["Chicken Tortilla Soup"]["optional"] == [
        "beans",
        "corn",
        "onion",
        "chicken broth",
    ]
    assert recipes_by_name["Chicken Tortilla Rice Soup"]["optional"] == [
        "corn tortillas",
        "lime",
        "cilantro",
        "chicken broth",
    ]
    assert recipes_by_name["Homestyle Beef Vegetable Soup"]["optional"] == [
        "beef broth",
        "onion",
        "diced tomatoes",
        "green beans",
    ]
    assert recipes_by_name["Creamy White Bean Chicken Soup"]["optional"] == [
        "parsley",
        "pepper",
        "milk",
        "chicken broth",
    ]
    assert "Cheddar Beef Rice Soup" not in recipes_by_name
    assert recipes_by_name["Minestrone Soup"]["optional"] == [
        "carrot",
        "celery",
        "zucchini",
        "parmesan",
        "vegetable broth",
    ]


def test_recipe_source_dataset_aligns_cheese_and_dairy_browser_leaves() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    recipes_by_name = {row["name"]: row for row in rows}

    assert recipes_by_name["Minestrone Soup"]["optional"] == [
        "carrot",
        "celery",
        "zucchini",
        "parmesan",
        "vegetable broth",
    ]
    assert recipes_by_name["Turkey Chili"]["optional"] == [
        "onion",
        "garlic",
        "cheddar",
        "sour cream",
    ]
    assert recipes_by_name["Tomato Feta Chicken Skillet"]["optional"] == [
        "feta",
        "parsley",
        "lemon",
        "olive oil",
    ]
    assert "Cheddar Broccoli Chicken Sheet Pan" not in recipes_by_name
    assert "Cheddar Beef Rice Soup" not in recipes_by_name
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
    assert "Chickpea Spinach Chickpea Curry" not in recipes_by_name
    assert "Lentil Tomato Lentil Curry" not in recipes_by_name
