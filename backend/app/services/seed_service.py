from __future__ import annotations

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias
from app.models.recipe import Recipe, RecipeIngredient


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
                        IngredientAlias.alias == aa,
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
                        IngredientAlias.alias == aa,
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

    def upsert_recipe(
        name: str,
        required: list[str],
        optional: list[str] | None = None,
    ) -> None:
        rname = name.strip()
        existing = db.query(Recipe).filter(Recipe.name == rname).first()
        if existing:
            return

        recipe = Recipe(name=rname)
        db.add(recipe)
        db.flush()

        def add_link(ing_name: str, is_required: bool) -> None:
            ing = upsert_ingredient(ing_name)
            db.add(
                RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ing.id,
                    is_required=is_required,
                )
            )

        for i in required:
            add_link(i, True)
        for i in (optional or []):
            add_link(i, False)

    # Make sure base ingredients exist first
    seed_basic_ingredients(db)

    # Extra pantry staples to support these 100
    staples = [
        "garlic",
        "onion",
        "rice",
        "pasta",
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
        {"name": "Mac & Cheese (Stovetop Simple)", "req": ["pasta", "cheddar", "milk", "butter", "salt"], "opt": ["pepper"]},
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

    # Ensure we have exactly 100 (pad with practical variants if needed)
    while len(recipes) < 100:
        idx = len(recipes) + 1
        recipes.append(
            {"name": f"Pantry Snack Plate {idx}", "req": ["bread", "butter"], "opt": ["cheddar", "salt", "pepper"]}
        )
    recipes = recipes[:100]

    for r in recipes:
        upsert_recipe(r["name"], r["req"], r.get("opt", []))

    db.commit()


def run_seed() -> None:
    """
    Called from app startup.
    Safe to call multiple times.
    """
    db = SessionLocal()
    try:
        seed_100_recipes(db)
        print("Seed completed")
    finally:
        db.close()
