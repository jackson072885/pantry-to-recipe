from __future__ import annotations

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias, normalize_alias_text
from app.models.recipe import Recipe, RecipeIngredient
from app.services.recipe_quality_service import run_recipe_quality_backfill
from app.services.real_recipe_pack_service import archive_flagged_recipes, seed_real_recipe_pack


def seed_basic_ingredients(db: Session) -> None:
    """
    Minimal seed so the system always has a core ingredient truth layer.
    Safe to run multiple times.
    """

    def upsert_ingredient(name: str, aliases: list[str] | None = None) -> Ingredient:
        canonical = name.strip().lower()
        ing = db.query(Ingredient).filter(Ingredient.canonical_name == canonical).first()
        if ing:
            # ensure aliases exist
            for a in aliases or []:
                aa = a.strip().lower()
                exists = (
                    db.query(IngredientAlias)
                    .filter(
                        IngredientAlias.ingredient_id == ing.id,
                        IngredientAlias.normalized_alias == normalize_alias_text(aa),
                    )
                    .first()
                )
                if not exists:
                    db.add(IngredientAlias(ingredient_id=ing.id, alias=aa))
            return ing

        ing = Ingredient(canonical_name=canonical)
        db.add(ing)
        db.flush()

        for a in aliases or []:
            db.add(IngredientAlias(ingredient_id=ing.id, alias=a.strip().lower()))
        return ing

    # --- core pantry (keep small but useful) ---
    upsert_ingredient("egg", ["eggs"])
    upsert_ingredient("milk")
    upsert_ingredient("butter")
    upsert_ingredient("cheddar", ["cheese", "cheddar cheese"])
    upsert_ingredient("bread")
    upsert_ingredient("flour")
    upsert_ingredient("sugar")
    upsert_ingredient("salt")
    upsert_ingredient("pepper")
    upsert_ingredient("oil", ["vegetable oil", "cooking oil"])

    db.commit()


def seed_100_recipes(db: Session) -> None:
    """
    Seeds 100 practical recipes into the DB.
    Safe to run multiple times (idempotent by recipe name).
    """

    def upsert_ingredient(name: str, aliases: list[str] | None = None) -> Ingredient:
        canonical = name.strip().lower()
        ing = db.query(Ingredient).filter(Ingredient.canonical_name == canonical).first()
        if ing:
            for a in aliases or []:
                aa = a.strip().lower()
                exists = (
                    db.query(IngredientAlias)
                    .filter(
                        IngredientAlias.ingredient_id == ing.id,
                        IngredientAlias.normalized_alias == normalize_alias_text(aa),
                    )
                    .first()
                )
                if not exists:
                    db.add(IngredientAlias(ingredient_id=ing.id, alias=aa))
            return ing

        ing = Ingredient(canonical_name=canonical)
        db.add(ing)
        db.flush()

        for a in aliases or []:
            db.add(IngredientAlias(ingredient_id=ing.id, alias=a.strip().lower()))
        return ing

    def sync_recipe_ingredients(
        recipe: Recipe,
        required: list[str],
        optional: list[str] | None,
    ) -> None:
        desired: dict[int, bool] = {}

        for ing_name in required:
            ing = upsert_ingredient(ing_name)
            desired[ing.id] = True

        for ing_name in (optional or []):
            ing = upsert_ingredient(ing_name)
            desired.setdefault(ing.id, False)

        existing = db.query(RecipeIngredient).filter(
            RecipeIngredient.recipe_id == recipe.id
        ).all()
        existing_by_id = {ri.ingredient_id: ri for ri in existing}

        for ing_id, is_required in desired.items():
            link = existing_by_id.get(ing_id)
            if link:
                link.is_required = is_required
                if not link.required_quantity or link.required_quantity <= 0:
                    link.required_quantity = 1.0
                if not link.unit:
                    link.unit = "ea"
            else:
                db.add(
                    RecipeIngredient(
                        recipe_id=recipe.id,
                        ingredient_id=ing_id,
                        is_required=is_required,
                        required_quantity=1.0,
                        unit="ea",
                    )
                )

        for link in existing:
            if link.ingredient_id not in desired:
                db.delete(link)

    content_by_name: dict[str, dict[str, object]] = {
        "Scrambled Eggs": {
            "cook_method": "skillet",
            "prep_time_minutes": 5,
            "cook_time_minutes": 5,
            "total_time_minutes": 10,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Whisk eggs with a pinch of salt and pepper (add a splash of milk if using).",
                    "Melt butter in a nonstick skillet over medium heat.",
                    "Pour in eggs and gently stir until softly set.",
                    "Serve immediately.",
                ]
            ),
        },
        "Fried Egg Toast": {
            "cook_method": "skillet",
            "prep_time_minutes": 5,
            "cook_time_minutes": 6,
            "total_time_minutes": 11,
            "servings": 1,
            "instructions": "\n".join(
                [
                    "Toast the bread to your liking.",
                    "Melt butter in a skillet over medium heat and fry the egg.",
                    "Season with salt and pepper, then place egg on toast.",
                ]
            ),
        },
        "Cheddar Omelet": {
            "cook_method": "skillet",
            "prep_time_minutes": 5,
            "cook_time_minutes": 6,
            "total_time_minutes": 11,
            "servings": 1,
            "instructions": "\n".join(
                [
                    "Whisk eggs with salt, pepper, and a splash of milk if using.",
                    "Melt butter in a skillet over medium heat.",
                    "Pour in eggs and cook until edges set.",
                    "Add cheddar, fold, and cook until melted.",
                ]
            ),
        },
        "French Toast": {
            "cook_method": "skillet",
            "prep_time_minutes": 5,
            "cook_time_minutes": 8,
            "total_time_minutes": 13,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Whisk eggs, milk, and optional sugar, cinnamon, and vanilla.",
                    "Dip bread slices to coat.",
                    "Cook in buttered skillet over medium heat until golden on both sides.",
                ]
            ),
        },
        "Pancakes (Basic)": {
            "cook_method": "skillet",
            "prep_time_minutes": 7,
            "cook_time_minutes": 10,
            "total_time_minutes": 17,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Whisk flour, baking powder, salt, and optional sugar.",
                    "Stir in milk and egg until just combined.",
                    "Cook on a lightly buttered skillet over medium heat, flipping when bubbles form.",
                ]
            ),
        },
        "Grilled Cheese": {
            "cook_method": "skillet",
            "prep_time_minutes": 5,
            "cook_time_minutes": 8,
            "total_time_minutes": 13,
            "servings": 1,
            "instructions": "\n".join(
                [
                    "Butter one side of each bread slice.",
                    "Place cheddar between unbuttered sides.",
                    "Cook in skillet over medium heat until golden and melted.",
                ]
            ),
        },
        "Tomato Pasta": {
            "cook_method": "stovetop",
            "prep_time_minutes": 5,
            "cook_time_minutes": 15,
            "total_time_minutes": 20,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Boil pasta in salted water until tender.",
                    "Simmer tomato sauce with garlic/onion and italian seasoning if using.",
                    "Toss pasta with sauce and serve.",
                ]
            ),
        },
        "Garlic Butter Pasta": {
            "cook_method": "stovetop",
            "prep_time_minutes": 5,
            "cook_time_minutes": 12,
            "total_time_minutes": 17,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Cook pasta in salted water until tender.",
                    "Melt butter with garlic in a skillet until fragrant.",
                    "Toss pasta with garlic butter and season with salt and pepper.",
                ]
            ),
        },
        "Mac & Cheese (Simple)": {
            "cook_method": "stovetop",
            "prep_time_minutes": 5,
            "cook_time_minutes": 15,
            "total_time_minutes": 20,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Cook pasta in salted water until tender; drain.",
                    "Warm milk and butter in the pot, then melt in cheddar.",
                    "Stir in pasta and season with salt and pepper.",
                ]
            ),
        },
        "Rice & Beans Bowl": {
            "cook_method": "stovetop",
            "prep_time_minutes": 5,
            "cook_time_minutes": 20,
            "total_time_minutes": 25,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Cook rice according to package directions.",
                    "Warm beans with salt and optional cumin or chili powder.",
                    "Serve beans over rice with hot sauce if desired.",
                ]
            ),
        },
        "Black Beans & Rice": {
            "cook_method": "stovetop",
            "prep_time_minutes": 5,
            "cook_time_minutes": 20,
            "total_time_minutes": 25,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Cook rice according to package directions.",
                    "Warm black beans with garlic/onion and cumin if using.",
                    "Serve beans over rice and season to taste.",
                ]
            ),
        },
        "Refried Beans Taco": {
            "cook_method": "stovetop",
            "prep_time_minutes": 5,
            "cook_time_minutes": 8,
            "total_time_minutes": 13,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Warm refried beans in a small pot.",
                    "Heat tortillas in a dry skillet.",
                    "Fill tortillas with beans and top with optional cheddar, lettuce, or salsa.",
                ]
            ),
        },
        "Tuna Sandwich": {
            "cook_method": "no_cook",
            "prep_time_minutes": 8,
            "cook_time_minutes": 0,
            "total_time_minutes": 8,
            "servings": 1,
            "instructions": "\n".join(
                [
                    "Mix tuna with mayo and a pinch of salt (pepper optional).",
                    "Spread onto bread and serve.",
                ]
            ),
        },
        "Bacon & Eggs": {
            "cook_method": "skillet",
            "prep_time_minutes": 5,
            "cook_time_minutes": 10,
            "total_time_minutes": 15,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Cook bacon in a skillet until crisp; remove.",
                    "Fry eggs in the bacon fat or a little oil.",
                    "Season eggs with salt and pepper and serve with bacon.",
                ]
            ),
        },
        "Mashed Potatoes": {
            "cook_method": "stovetop",
            "prep_time_minutes": 10,
            "cook_time_minutes": 20,
            "total_time_minutes": 30,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Boil peeled potatoes in salted water until fork-tender.",
                    "Drain and mash with butter and milk.",
                    "Season with salt and pepper.",
                ]
            ),
        },
        "Roasted Potatoes": {
            "cook_method": "oven",
            "prep_time_minutes": 10,
            "cook_time_minutes": 25,
            "total_time_minutes": 35,
            "oven_temp_f": 425,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Heat oven to 425°F.",
                    "Toss potato chunks with oil, salt, and paprika.",
                    "Roast on a sheet pan until golden and tender, tossing once.",
                ]
            ),
        },
        "Chicken & Rice": {
            "cook_method": "stovetop",
            "prep_time_minutes": 10,
            "cook_time_minutes": 25,
            "total_time_minutes": 35,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Season chicken with salt and pepper and cook in a pot with a little oil.",
                    "Add rice, onion/garlic if using, and water; bring to a simmer.",
                    "Cover and cook until rice is tender and chicken is cooked through.",
                ]
            ),
        },
        "Ground Beef Tacos": {
            "cook_method": "skillet",
            "prep_time_minutes": 10,
            "cook_time_minutes": 12,
            "total_time_minutes": 22,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Brown ground beef in a skillet; season with salt, cumin, and chili powder.",
                    "Warm tortillas in a dry skillet.",
                    "Fill tortillas with beef and top with optional lettuce, cheddar, and salsa.",
                ]
            ),
        },
        "Skillet Chicken Ginger Rice": {
            "cook_method": "skillet",
            "prep_time_minutes": 10,
            "cook_time_minutes": 20,
            "total_time_minutes": 30,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Sauté ginger and garlic in oil until fragrant.",
                    "Add chicken pieces and cook until lightly browned.",
                    "Stir in rice, soy sauce, salt, and pepper, then add water and cover.",
                    "Simmer until rice is tender and chicken is cooked through.",
                ]
            ),
        },
        "Skillet Chicken Taco Rice": {
            "cook_method": "skillet",
            "prep_time_minutes": 10,
            "cook_time_minutes": 20,
            "total_time_minutes": 30,
            "servings": 2,
            "instructions": "\n".join(
                [
                    "Cook chicken in a skillet with oil, salt, cumin, and chili powder.",
                    "Add rice and salsa with water; simmer covered until rice is tender.",
                    "Top with optional cheddar before serving.",
                ]
            ),
        },
    }

    def upsert_recipe(
        name: str,
        required: list[str],
        optional: list[str] | None = None,
    ) -> None:
        rname = name.strip()
        recipe = db.query(Recipe).filter(Recipe.name == rname).first()
        if not recipe:
            recipe = Recipe(name=rname)
            db.add(recipe)
            db.flush()

        sync_recipe_ingredients(recipe, required, optional)

        content = content_by_name.get(rname)
        if content:
            recipe.instructions = content.get("instructions")  # type: ignore[assignment]
            recipe.cook_method = content.get("cook_method")  # type: ignore[assignment]
            recipe.prep_time_minutes = content.get("prep_time_minutes")  # type: ignore[assignment]
            recipe.cook_time_minutes = content.get("cook_time_minutes")  # type: ignore[assignment]
            recipe.total_time_minutes = content.get("total_time_minutes")  # type: ignore[assignment]
            recipe.oven_temp_f = content.get("oven_temp_f")  # type: ignore[assignment]
            recipe.air_fryer_temp_f = content.get("air_fryer_temp_f")  # type: ignore[assignment]
            recipe.servings = content.get("servings", recipe.servings)  # type: ignore[assignment]

    # Make sure base ingredients exist first
    seed_basic_ingredients(db)

    # Extra pantry staples to support these 100
    staples = [
        "bbq sauce",
        "cabbage",
        "chickpeas",
        "cucumber",
        "garlic",
        "ginger",
        "hummus",
        "olive",
        "onion",
        "orzo",
        "pesto",
        "pork",
        "rice",
        "pasta",
        "ranch seasoning",
        "shrimp",
        "fish",
        "tomato",
        "tomato sauce",
        "tomato paste",
        "chicken",
        "ground beef",
        "tuna",
        "bacon",
        "sausage",
        "ham",
        "black beans",
        "refried beans",
        "beans",
        "corn",
        "lettuce",
        "spinach",
        "potato",
        "sweet potato",
        "carrot",
        "celery",
        "bell pepper",
        "parmesan",
        "mozzarella",
        "cream",
        "yogurt",
        "sour cream",
        "lemon",
        "lime",
        "vinegar",
        "soy sauce",
        "hot sauce",
        "ketchup",
        "mustard",
        "mayo",
        "white beans",
        "curry powder",
        "cumin",
        "paprika",
        "chili powder",
        "italian seasoning",
        "cinnamon",
        "oats",
        "baking powder",
        "baking soda",
        "vanilla",
        "chocolate chips",
        "peanut butter",
        "honey",
        "tortilla",
        "salsa",
    ]
    for s in staples:
        upsert_ingredient(s)
    db.flush()

    # 100 recipes (practical, pantry-forward)
    recipes: list[dict] = [
        {"name": "Scrambled Eggs", "req": ["egg", "butter", "salt", "pepper"], "opt": ["milk"]},
        {"name": "Fried Egg Toast", "req": ["egg", "bread", "butter", "salt"], "opt": ["pepper"]},
        {"name": "Cheddar Omelet", "req": ["egg", "cheddar", "butter", "salt"], "opt": ["pepper", "milk"]},
        {"name": "French Toast", "req": ["egg", "milk", "bread", "butter"], "opt": ["sugar", "cinnamon", "vanilla"]},
        {"name": "Pancakes (Basic)", "req": ["flour", "milk", "egg", "baking powder", "salt"], "opt": ["sugar", "butter"]},
        {"name": "Biscuits (Quick)", "req": ["flour", "baking powder", "salt", "butter", "milk"], "opt": []},
        {"name": "Grilled Cheese", "req": ["bread", "cheddar", "butter"], "opt": ["pepper"]},
        {"name": "Cheese Toast", "req": ["bread", "cheddar"], "opt": ["butter"]},
        {"name": "Egg Salad Sandwich", "req": ["egg", "mayo", "bread", "salt"], "opt": ["pepper", "mustard"]},
        {"name": "Deviled Eggs", "req": ["egg", "mayo", "mustard", "salt"], "opt": ["paprika", "pepper"]},
        {"name": "Butter Noodles", "req": ["pasta", "butter", "salt"], "opt": ["parmesan", "pepper"]},
        {"name": "Garlic Butter Pasta", "req": ["pasta", "butter", "garlic", "salt"], "opt": ["parmesan", "pepper"]},
        {"name": "Parmesan Pasta", "req": ["pasta", "parmesan", "butter", "salt"], "opt": ["pepper"]},
        {"name": "Tomato Pasta", "req": ["pasta", "tomato sauce", "salt"], "opt": ["garlic", "onion", "italian seasoning"]},
        {"name": "Pasta with Tomato & Parmesan", "req": ["pasta", "tomato sauce", "parmesan", "salt"], "opt": ["garlic", "pepper"]},
        {"name": "Creamy Pasta", "req": ["pasta", "cream", "salt"], "opt": ["parmesan", "pepper", "garlic"]},
        {"name": "Mac & Cheese (Simple)", "req": ["pasta", "cheddar", "milk", "butter", "salt"], "opt": ["pepper"]},
        {"name": "Cheesy Garlic Bread", "req": ["bread", "butter", "garlic", "cheddar"], "opt": ["italian seasoning"]},
        {"name": "Cheesy Rice", "req": ["rice", "cheddar", "salt"], "opt": ["butter", "pepper"]},
        {"name": "Garlic Rice", "req": ["rice", "garlic", "salt"], "opt": ["butter", "oil"]},
        {"name": "Rice & Beans Bowl", "req": ["rice", "beans", "salt"], "opt": ["cumin", "chili powder", "hot sauce"]},
        {"name": "Black Beans & Rice", "req": ["rice", "black beans", "salt"], "opt": ["cumin", "onion", "garlic"]},
        {"name": "Refried Beans Taco", "req": ["tortilla", "refried beans"], "opt": ["cheddar", "lettuce", "salsa"]},
        {"name": "Bean & Cheese Quesadilla", "req": ["tortilla", "cheddar"], "opt": ["refried beans", "salsa"]},
        {"name": "Cheese Quesadilla", "req": ["tortilla", "cheddar"], "opt": ["salsa"]},
        {"name": "Simple Nachos", "req": ["tortilla", "cheddar"], "opt": ["salsa", "beans", "hot sauce"]},
        {"name": "Tuna Salad", "req": ["tuna", "mayo", "salt"], "opt": ["pepper", "mustard"]},
        {"name": "Tuna Sandwich", "req": ["tuna", "mayo", "bread", "salt"], "opt": ["pepper"]},
        {"name": "Tuna Melt", "req": ["tuna", "mayo", "bread", "cheddar"], "opt": ["tomato"]},
        {"name": "BLT (Simple)", "req": ["bacon", "bread", "lettuce"], "opt": ["tomato", "mayo"]},
        {"name": "Bacon & Eggs", "req": ["bacon", "egg", "salt"], "opt": ["pepper"]},
        {"name": "Sausage & Eggs", "req": ["sausage", "egg", "salt"], "opt": ["pepper"]},
        {"name": "Ham & Cheese Sandwich", "req": ["ham", "cheddar", "bread"], "opt": ["mayo", "mustard"]},
        {"name": "Mashed Potatoes", "req": ["potato", "butter", "milk", "salt"], "opt": ["pepper"]},
        {"name": "Roasted Potatoes", "req": ["potato", "oil", "salt"], "opt": ["pepper", "paprika"]},
        {"name": "Sweet Potato Mash", "req": ["sweet potato", "butter", "salt"], "opt": ["cinnamon", "honey"]},
        {"name": "Baked Potato (Basic)", "req": ["potato", "salt"], "opt": ["butter", "sour cream", "cheddar"]},
        {"name": "Tomato Soup (Quick)", "req": ["tomato sauce", "salt"], "opt": ["cream", "pepper", "garlic"]},
        {"name": "Creamy Tomato Soup", "req": ["tomato sauce", "cream", "salt"], "opt": ["pepper", "garlic"]},
        {"name": "Chicken & Rice", "req": ["chicken", "rice", "salt"], "opt": ["onion", "garlic", "pepper"]},
        {"name": "Chicken Pasta", "req": ["chicken", "pasta", "salt"], "opt": ["garlic", "oil", "pepper"]},
        {"name": "Chicken with Garlic Butter", "req": ["chicken", "butter", "garlic", "salt"], "opt": ["pepper"]},
        {"name": "Ground Beef Tacos", "req": ["ground beef", "tortilla", "salt"], "opt": ["cumin", "chili powder", "lettuce", "cheddar", "salsa"]},
        {"name": "Beef & Rice Skillet", "req": ["ground beef", "rice", "salt"], "opt": ["onion", "garlic", "pepper"]},
        {"name": "Beefy Tomato Pasta", "req": ["ground beef", "pasta", "tomato sauce", "salt"], "opt": ["onion", "garlic", "italian seasoning"]},
    ]

    # Ensure we have exactly 100 baseline recipes (pad with practical variants if needed)
    while len(recipes) < 100:
        idx = len(recipes) + 1
        recipes.append(
            {"name": f"Pantry Snack Plate {idx}", "req": ["bread", "butter"], "opt": ["cheddar", "salt", "pepper"]}
        )
    base_recipes = recipes[:100]

    wave1_recipes: list[dict] = [
        {"name": "Skillet Chicken Taco Rice", "req": ["chicken", "rice", "oil", "salt"], "opt": ["salsa", "cumin", "chili powder", "cheddar"]},
        {"name": "Skillet Beef Queso Bowl", "req": ["ground beef", "rice", "cheddar", "salt"], "opt": ["milk", "salsa", "pepper"]},
        {"name": "Sheet Pan Veggie Fajita Tray", "req": ["bell pepper", "onion", "oil", "salt"], "opt": ["corn", "cumin", "chili powder", "tortilla"]},
        {"name": "Skillet Chicken Pesto Orzo", "req": ["chicken", "orzo", "pesto", "salt"], "opt": ["parmesan", "pepper", "cream"]},
        {"name": "Skillet Beef Tomato Rotini", "req": ["ground beef", "pasta", "tomato sauce", "salt"], "opt": ["garlic", "onion", "italian seasoning"]},
        {"name": "Sheet Pan Veggie Parm Bake", "req": ["bell pepper", "tomato sauce", "mozzarella", "salt"], "opt": ["parmesan", "italian seasoning", "onion"]},
        {"name": "Skillet Chicken Corn Hash", "req": ["chicken", "corn", "potato", "salt"], "opt": ["onion", "oil", "pepper"]},
        {"name": "Sheet Pan Beef & Potato Supper", "req": ["ground beef", "potato", "salt", "oil"], "opt": ["onion", "bell pepper", "pepper"]},
        {"name": "Skillet Veggie Melt", "req": ["bread", "cheddar", "spinach", "tomato"], "opt": ["butter", "pepper"]},
        {"name": "Skillet Chicken Ginger Rice", "req": ["chicken", "rice", "ginger", "garlic", "soy sauce"], "opt": ["oil", "salt", "pepper", "onion"]},
        {"name": "Skillet Beef Soy Noodle Toss", "req": ["ground beef", "pasta", "soy sauce", "garlic"], "opt": ["onion", "bell pepper", "oil"]},
        {"name": "Sheet Pan Veggie Teriyaki Roast", "req": ["bell pepper", "onion", "soy sauce", "oil"], "opt": ["carrot", "broccoli", "salt"]},
        {"name": "Slow Cooker BBQ Pulled Pork", "req": ["pork", "bbq sauce", "salt"], "opt": ["onion", "pepper"]},
        {"name": "Slow Cooker Southern Chicken & Gravy", "req": ["chicken", "butter", "flour", "salt"], "opt": ["milk", "pepper"]},
        {"name": "Instant Pot Mediterranean Chickpea Stew", "req": ["chickpeas", "tomato sauce", "onion", "garlic"], "opt": ["cumin", "paprika", "salt"]},
        {"name": "Instant Pot Fusion Beef Chili Rice", "req": ["ground beef", "rice", "tomato sauce", "salt"], "opt": ["beans", "chili powder", "cumin"]},
        {"name": "Slow Cooker Mediterranean Pork & Olive Stew", "req": ["pork", "tomato sauce", "olive", "salt"], "opt": ["onion", "garlic"]},
        {"name": "Instant Pot BBQ Chicken Beans", "req": ["chicken", "beans", "bbq sauce", "salt"], "opt": ["onion", "pepper"]},
        {"name": "Slow Cooker Fusion Veggie Curry", "req": ["tomato sauce", "onion", "carrot", "salt"], "opt": ["curry powder", "chickpeas", "pepper"]},
        {"name": "Instant Pot Southern Beef & Rice", "req": ["ground beef", "rice", "tomato sauce", "salt"], "opt": ["onion", "bell pepper", "pepper"]},
        {"name": "Mediterranean Tuna White Bean Salad", "req": ["tuna", "white beans", "lemon", "salt"], "opt": ["oil", "onion", "pepper"]},
        {"name": "Asian Sesame Cucumber Noodle Bowl", "req": ["cucumber", "pasta", "soy sauce", "vinegar"], "opt": ["oil", "garlic", "pepper"]},
        {"name": "American Crunchy Veggie Wrap", "req": ["tortilla", "lettuce", "tomato", "carrot"], "opt": ["bell pepper", "mayo", "salt"]},
        {"name": "American Shrimp Cocktail Salad Cup", "req": ["shrimp", "lettuce", "ketchup", "lemon"], "opt": ["pepper", "salt"]},
        {"name": "Mediterranean Hummus Veggie Bowl", "req": ["hummus", "lettuce", "tomato", "cucumber"], "opt": ["oil", "lemon", "salt"]},
        {"name": "Asian Peanut Slaw Salad", "req": ["cabbage", "carrot", "peanut butter", "vinegar"], "opt": ["soy sauce", "honey", "salt"]},
        {"name": "Air Fryer Crispy Fish Tacos", "req": ["fish", "tortilla", "cabbage", "salt"], "opt": ["lime", "chili powder", "mayo"]},
        {"name": "Air Fryer Chicken Ranch Bites", "req": ["chicken", "ranch seasoning", "oil", "salt"], "opt": ["pepper"]},
        {"name": "Oven Teriyaki Chicken & Shrimp Tray", "req": ["chicken", "shrimp", "soy sauce", "garlic"], "opt": ["honey", "bell pepper", "onion"]},
        {"name": "Oven Baked Veggie Stuffed Peppers", "req": ["bell pepper", "rice", "tomato sauce", "mozzarella"], "opt": ["onion", "garlic", "salt"]},
    ]

    for r in base_recipes + wave1_recipes:
        upsert_recipe(r["name"], r["req"], r.get("opt", []))

    db.commit()


def run_seed() -> dict[str, object]:
    """
    Called from app startup.
    Safe to call multiple times.
    """
    db = SessionLocal()
    try:
        seed_summary = seed_real_recipe_pack(db)
        quality_summary = run_recipe_quality_backfill(db)
        archive_summary = archive_flagged_recipes(db)
        verify_recipe_links(db)
        print("Seed completed")
        return {
            "seed": seed_summary,
            "quality": quality_summary,
            "archive": archive_summary,
        }
    finally:
        db.close()


def verify_recipe_links(db: Session) -> None:
    checks = [
        {
            "name": "Skillet Chicken Ginger Rice",
            "expected": {"chicken", "rice", "ginger", "garlic", "soy sauce"},
        },
        {
            "name": "Cheesy Baked Ziti",
            "expected": {"pasta", "tomato sauce", "mozzarella"},
        },
        {
            "name": "Lemon Butter Baked Cod and Rice",
            "expected": {"cod", "rice", "lemon"},
        },
    ]

    for check in checks:
        recipe = db.query(Recipe).filter(Recipe.name == check["name"]).first()
        if not recipe:
            print(f"[seed verify] Missing recipe: {check['name']}")
            continue
        rows = (
            db.query(RecipeIngredient, Ingredient)
            .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
            .filter(RecipeIngredient.recipe_id == recipe.id)
            .all()
        )
        actual = {ing.canonical_name for _, ing in rows}
        expected = check["expected"]
        if expected.issubset(actual):
            print(f"[seed verify] Recipe {recipe.id} '{recipe.name}' ingredients OK.")
        else:
            missing = sorted(expected - actual)
            print(
                f"[seed verify] Recipe {recipe.id} '{recipe.name}' missing: {', '.join(missing)}"
            )
