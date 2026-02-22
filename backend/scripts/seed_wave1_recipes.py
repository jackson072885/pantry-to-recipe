from __future__ import annotations

from dataclasses import dataclass

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.db import SessionLocal
from app.models.recipe import Recipe
from app.services.search_service import ensure_tags


@dataclass
class RecipeSeed:
    name: str
    cook_time_minutes: int
    difficulty: str
    primary_method: str
    primary_protein: str
    cuisine: str
    prep_complexity: float
    cleanup_score: float
    tags: list[str]


def seed_wave1() -> None:
    db = SessionLocal()
    try:
        tags = ensure_tags(db)
        tag_by_slug = {tag.slug: tag for tag in tags}

        recipes: list[RecipeSeed] = [
            # Batch A (12)
            RecipeSeed(
                name="Skillet Chicken Taco Rice",
                cook_time_minutes=20,
                difficulty="Beginner",
                primary_method="Skillet",
                primary_protein="Chicken",
                cuisine="Mexican",
                prep_complexity=0.30,
                cleanup_score=0.40,
                tags=[
                    "dinner", "20-minutes", "skillet", "chicken", "mexican",
                    "high-protein", "pantry-heavy", "saucy", "hot",
                ],
            ),
            RecipeSeed(
                name="Skillet Beef Queso Bowl",
                cook_time_minutes=10,
                difficulty="Beginner",
                primary_method="Skillet",
                primary_protein="Beef",
                cuisine="Mexican",
                prep_complexity=0.25,
                cleanup_score=0.35,
                tags=[
                    "dinner", "10-minutes", "skillet", "beef", "mexican",
                    "comfort-food", "pantry-heavy", "creamy", "hot",
                ],
            ),
            RecipeSeed(
                name="Sheet Pan Veggie Fajita Tray",
                cook_time_minutes=20,
                difficulty="Beginner",
                primary_method="Sheet Pan",
                primary_protein="Vegetarian",
                cuisine="Mexican",
                prep_complexity=0.35,
                cleanup_score=0.45,
                tags=[
                    "dinner", "20-minutes", "sheet-pan", "vegetarian", "mexican",
                    "budget-friendly", "fresh-produce-heavy", "crispy", "hot",
                ],
            ),
            RecipeSeed(
                name="Skillet Chicken Pesto Orzo",
                cook_time_minutes=20,
                difficulty="Moderate",
                primary_method="Skillet",
                primary_protein="Chicken",
                cuisine="Italian",
                prep_complexity=0.40,
                cleanup_score=0.45,
                tags=[
                    "dinner", "20-minutes", "skillet", "chicken", "italian",
                    "comfort-food", "pantry-heavy", "creamy", "hot",
                ],
            ),
            RecipeSeed(
                name="Skillet Beef Tomato Rotini",
                cook_time_minutes=30,
                difficulty="Moderate",
                primary_method="Skillet",
                primary_protein="Beef",
                cuisine="Italian",
                prep_complexity=0.45,
                cleanup_score=0.50,
                tags=[
                    "dinner", "30-minutes", "skillet", "beef", "italian",
                    "high-protein", "pantry-heavy", "saucy", "hot",
                ],
            ),
            RecipeSeed(
                name="Sheet Pan Veggie Parm Bake",
                cook_time_minutes=30,
                difficulty="Beginner",
                primary_method="Sheet Pan",
                primary_protein="Vegetarian",
                cuisine="Italian",
                prep_complexity=0.35,
                cleanup_score=0.40,
                tags=[
                    "dinner", "30-minutes", "sheet-pan", "vegetarian", "italian",
                    "healthy", "fresh-produce-heavy", "baked", "hot",
                ],
            ),
            RecipeSeed(
                name="Skillet Chicken Corn Hash",
                cook_time_minutes=10,
                difficulty="Beginner",
                primary_method="Skillet",
                primary_protein="Chicken",
                cuisine="American",
                prep_complexity=0.25,
                cleanup_score=0.35,
                tags=[
                    "dinner", "10-minutes", "one-pan", "skillet", "chicken", "american",
                    "budget-friendly", "pantry-heavy", "crispy", "hot",
                ],
            ),
            RecipeSeed(
                name="Sheet Pan Beef & Potato Supper",
                cook_time_minutes=30,
                difficulty="Beginner",
                primary_method="Sheet Pan",
                primary_protein="Beef",
                cuisine="American",
                prep_complexity=0.40,
                cleanup_score=0.45,
                tags=[
                    "dinner", "30-minutes", "sheet-pan", "beef", "american",
                    "kid-friendly", "pantry-heavy", "baked", "hot",
                ],
            ),
            RecipeSeed(
                name="Skillet Veggie Melt",
                cook_time_minutes=10,
                difficulty="Beginner",
                primary_method="Skillet",
                primary_protein="Vegetarian",
                cuisine="American",
                prep_complexity=0.30,
                cleanup_score=0.35,
                tags=[
                    "dinner", "10-minutes", "one-pan", "skillet", "vegetarian", "american",
                    "light-and-fresh", "fresh-produce-heavy", "creamy", "hot",
                ],
            ),
            RecipeSeed(
                name="Skillet Chicken Ginger Rice",
                cook_time_minutes=20,
                difficulty="Moderate",
                primary_method="Skillet",
                primary_protein="Chicken",
                cuisine="Asian",
                prep_complexity=0.35,
                cleanup_score=0.40,
                tags=[
                    "dinner", "20-minutes", "skillet", "chicken", "asian",
                    "high-protein", "pantry-heavy", "saucy", "hot",
                ],
            ),
            RecipeSeed(
                name="Skillet Beef Soy Noodle Toss",
                cook_time_minutes=10,
                difficulty="Beginner",
                primary_method="Skillet",
                primary_protein="Beef",
                cuisine="Asian",
                prep_complexity=0.30,
                cleanup_score=0.35,
                tags=[
                    "dinner", "10-minutes", "skillet", "beef", "asian",
                    "budget-friendly", "pantry-heavy", "saucy", "hot",
                ],
            ),
            RecipeSeed(
                name="Sheet Pan Veggie Teriyaki Roast",
                cook_time_minutes=30,
                difficulty="Beginner",
                primary_method="Sheet Pan",
                primary_protein="Vegetarian",
                cuisine="Asian",
                prep_complexity=0.35,
                cleanup_score=0.40,
                tags=[
                    "dinner", "30-minutes", "sheet-pan", "vegetarian", "asian",
                    "healthy", "fresh-produce-heavy", "baked", "hot",
                ],
            ),
            # Batch B (8)
            RecipeSeed(
                name="Slow Cooker BBQ Pulled Pork",
                cook_time_minutes=360,
                difficulty="Beginner",
                primary_method="Slow Cooker",
                primary_protein="Pork",
                cuisine="BBQ",
                prep_complexity=0.25,
                cleanup_score=0.35,
                tags=[
                    "dinner", "45plus-minutes", "set-and-forget", "slow-cooker", "pork", "bbq",
                    "meal-prep", "pantry-heavy", "saucy", "hot", "low-cleanup",
                ],
            ),
            RecipeSeed(
                name="Slow Cooker Southern Chicken & Gravy",
                cook_time_minutes=300,
                difficulty="Beginner",
                primary_method="Slow Cooker",
                primary_protein="Chicken",
                cuisine="Southern",
                prep_complexity=0.30,
                cleanup_score=0.40,
                tags=[
                    "dinner", "45plus-minutes", "set-and-forget", "slow-cooker", "chicken", "southern",
                    "comfort-food", "pantry-heavy", "saucy", "hot",
                ],
            ),
            RecipeSeed(
                name="Instant Pot Mediterranean Chickpea Stew",
                cook_time_minutes=45,
                difficulty="Moderate",
                primary_method="Instant Pot",
                primary_protein="Vegan",
                cuisine="Mediterranean",
                prep_complexity=0.35,
                cleanup_score=0.40,
                tags=[
                    "dinner", "45plus-minutes", "set-and-forget", "instant-pot", "vegan", "mediterranean",
                    "meal-prep", "pantry-heavy", "saucy", "hot", "low-cleanup",
                ],
            ),
            RecipeSeed(
                name="Instant Pot Fusion Beef Chili Rice",
                cook_time_minutes=50,
                difficulty="Moderate",
                primary_method="Instant Pot",
                primary_protein="Beef",
                cuisine="Fusion",
                prep_complexity=0.40,
                cleanup_score=0.45,
                tags=[
                    "dinner", "45plus-minutes", "set-and-forget", "instant-pot", "beef", "fusion",
                    "meal-prep", "pantry-heavy", "saucy", "hot",
                ],
            ),
            RecipeSeed(
                name="Slow Cooker Mediterranean Pork & Olive Stew",
                cook_time_minutes=360,
                difficulty="Moderate",
                primary_method="Slow Cooker",
                primary_protein="Pork",
                cuisine="Mediterranean",
                prep_complexity=0.40,
                cleanup_score=0.45,
                tags=[
                    "dinner", "45plus-minutes", "set-and-forget", "slow-cooker", "pork", "mediterranean",
                    "high-protein", "pantry-heavy", "saucy", "hot", "low-cleanup",
                ],
            ),
            RecipeSeed(
                name="Instant Pot BBQ Chicken Beans",
                cook_time_minutes=45,
                difficulty="Beginner",
                primary_method="Instant Pot",
                primary_protein="Chicken",
                cuisine="BBQ",
                prep_complexity=0.30,
                cleanup_score=0.35,
                tags=[
                    "dinner", "45plus-minutes", "set-and-forget", "instant-pot", "chicken", "bbq",
                    "meal-prep", "pantry-heavy", "saucy", "hot",
                ],
            ),
            RecipeSeed(
                name="Slow Cooker Fusion Veggie Curry",
                cook_time_minutes=300,
                difficulty="Moderate",
                primary_method="Slow Cooker",
                primary_protein="Vegan",
                cuisine="Fusion",
                prep_complexity=0.35,
                cleanup_score=0.40,
                tags=[
                    "dinner", "45plus-minutes", "set-and-forget", "slow-cooker", "vegan", "fusion",
                    "budget-friendly", "pantry-heavy", "saucy", "hot", "low-cleanup",
                ],
            ),
            RecipeSeed(
                name="Instant Pot Southern Beef & Rice",
                cook_time_minutes=50,
                difficulty="Moderate",
                primary_method="Instant Pot",
                primary_protein="Beef",
                cuisine="Southern",
                prep_complexity=0.40,
                cleanup_score=0.45,
                tags=[
                    "dinner", "45plus-minutes", "set-and-forget", "instant-pot", "beef", "southern",
                    "budget-friendly", "pantry-heavy", "saucy", "hot",
                ],
            ),
            # Batch C (6)
            RecipeSeed(
                name="Mediterranean Tuna White Bean Salad",
                cook_time_minutes=10,
                difficulty="Beginner",
                primary_method="No Cook",
                primary_protein="Seafood",
                cuisine="Mediterranean",
                prep_complexity=0.20,
                cleanup_score=0.20,
                tags=[
                    "lunch", "10-minutes", "minimal-prep", "no-cook", "seafood", "mediterranean",
                    "light-and-fresh", "pantry-heavy", "creamy", "cold", "healthy",
                ],
            ),
            RecipeSeed(
                name="Asian Sesame Cucumber Noodle Bowl",
                cook_time_minutes=10,
                difficulty="Beginner",
                primary_method="No Cook",
                primary_protein="Vegan",
                cuisine="Asian",
                prep_complexity=0.20,
                cleanup_score=0.20,
                tags=[
                    "lunch", "10-minutes", "minimal-prep", "no-cook", "vegan", "asian",
                    "light-and-fresh", "fresh-produce-heavy", "crispy", "cold", "healthy",
                ],
            ),
            RecipeSeed(
                name="American Crunchy Veggie Wrap",
                cook_time_minutes=20,
                difficulty="Beginner",
                primary_method="No Cook",
                primary_protein="Vegetarian",
                cuisine="American",
                prep_complexity=0.25,
                cleanup_score=0.25,
                tags=[
                    "lunch", "20-minutes", "minimal-prep", "no-cook", "vegetarian", "american",
                    "light-and-fresh", "fresh-produce-heavy", "crispy", "room-temp",
                ],
            ),
            RecipeSeed(
                name="American Shrimp Cocktail Salad Cup",
                cook_time_minutes=10,
                difficulty="Beginner",
                primary_method="No Cook",
                primary_protein="Seafood",
                cuisine="American",
                prep_complexity=0.25,
                cleanup_score=0.25,
                tags=[
                    "snack", "10-minutes", "minimal-prep", "no-cook", "seafood", "american",
                    "light-and-fresh", "fresh-produce-heavy", "saucy", "room-temp", "healthy",
                ],
            ),
            RecipeSeed(
                name="Mediterranean Hummus Veggie Bowl",
                cook_time_minutes=20,
                difficulty="Beginner",
                primary_method="No Cook",
                primary_protein="Vegan",
                cuisine="Mediterranean",
                prep_complexity=0.25,
                cleanup_score=0.25,
                tags=[
                    "lunch", "20-minutes", "minimal-prep", "no-cook", "vegan", "mediterranean",
                    "light-and-fresh", "fresh-produce-heavy", "creamy", "cold", "healthy",
                ],
            ),
            RecipeSeed(
                name="Asian Peanut Slaw Salad",
                cook_time_minutes=10,
                difficulty="Beginner",
                primary_method="No Cook",
                primary_protein="Vegetarian",
                cuisine="Asian",
                prep_complexity=0.25,
                cleanup_score=0.25,
                tags=[
                    "lunch", "10-minutes", "minimal-prep", "no-cook", "vegetarian", "asian",
                    "light-and-fresh", "fresh-produce-heavy", "crispy", "cold", "healthy",
                ],
            ),
            # Batch D (4)
            RecipeSeed(
                name="Air Fryer Crispy Fish Tacos",
                cook_time_minutes=20,
                difficulty="Moderate",
                primary_method="Air Fryer",
                primary_protein="Fish",
                cuisine="Mexican",
                prep_complexity=0.40,
                cleanup_score=0.40,
                tags=[
                    "dinner", "20-minutes", "air-fryer", "fish", "mexican",
                    "high-protein", "fresh-produce-heavy", "crispy", "hot",
                ],
            ),
            RecipeSeed(
                name="Air Fryer Chicken Ranch Bites",
                cook_time_minutes=20,
                difficulty="Beginner",
                primary_method="Air Fryer",
                primary_protein="Chicken",
                cuisine="American",
                prep_complexity=0.30,
                cleanup_score=0.35,
                tags=[
                    "dinner", "20-minutes", "air-fryer", "chicken", "american",
                    "kid-friendly", "pantry-heavy", "crispy", "hot",
                ],
            ),
            RecipeSeed(
                name="Oven Teriyaki Chicken & Shrimp Tray",
                cook_time_minutes=30,
                difficulty="Moderate",
                primary_method="Oven",
                primary_protein="Mixed Protein",
                cuisine="Asian",
                prep_complexity=0.45,
                cleanup_score=0.45,
                tags=[
                    "dinner", "30-minutes", "oven", "mixed-protein", "asian",
                    "high-protein", "fresh-produce-heavy", "baked", "hot",
                ],
            ),
            RecipeSeed(
                name="Oven Baked Veggie Stuffed Peppers",
                cook_time_minutes=30,
                difficulty="Moderate",
                primary_method="Oven",
                primary_protein="Vegetarian",
                cuisine="Fusion",
                prep_complexity=0.45,
                cleanup_score=0.45,
                tags=[
                    "dinner", "30-minutes", "oven", "vegetarian", "fusion",
                    "healthy", "fresh-produce-heavy", "baked", "hot",
                ],
            ),
        ]

        for entry in recipes:
            missing_slugs = [slug for slug in entry.tags if slug not in tag_by_slug]
            if missing_slugs:
                raise ValueError(f"Missing tags: {missing_slugs}")

            recipe = db.query(Recipe).filter(Recipe.name == entry.name).first()
            if not recipe:
                recipe = Recipe(name=entry.name)
                db.add(recipe)

            recipe.cook_time_minutes = entry.cook_time_minutes
            recipe.difficulty = entry.difficulty
            recipe.primary_method = entry.primary_method
            recipe.primary_protein = entry.primary_protein
            recipe.cuisine = entry.cuisine
            recipe.prep_complexity = entry.prep_complexity
            recipe.cleanup_score = entry.cleanup_score

            recipe.tags = [tag_by_slug[slug] for slug in entry.tags]

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_wave1()
