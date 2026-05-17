from __future__ import annotations

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def _ensure_ingredient(db, canonical_name: str) -> Ingredient:
    ingredient = db.query(Ingredient).filter(Ingredient.canonical_name == canonical_name).first()
    if ingredient is not None:
        return ingredient

    ingredient = Ingredient(canonical_name=canonical_name)
    db.add(ingredient)
    db.flush()
    return ingredient


def _create_recipe_with_rows(db, *, name: str, rows: list[dict]) -> int:
    recipe = Recipe(
        name=name,
        servings=2,
        total_time_minutes=25,
        difficulty="easy",
        prep_complexity="simple",
        quality_score=24,
        quality_bucket="KEEP_AS_IS",
        review_status="approved",
        is_weeknight_friendly=True,
        is_beginner_friendly=True,
        is_production_ready=True,
    )
    db.add(recipe)
    db.flush()

    for row in rows:
        ingredient = _ensure_ingredient(db, row["ingredient_name"])
        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                is_required=row.get("is_required", True),
                required_quantity=row.get("required_quantity", 1.0),
                unit=row.get("unit", "ea"),
                measurement_is_estimated=False,
                notes=row.get("notes"),
            )
        )

    db.commit()
    return recipe.id


def test_ingredient_only_import_lists_unknown_quantity_instead_of_fake_each(client):
    client.post("/pantry/clear")

    commit_response = client.post("/pantry/import/commit", json={"lines": ["onion"]})
    assert commit_response.status_code == 200

    data = _unwrap(commit_response)
    assert data["items"] == [
        {
            "ingredient": "onion",
            "quantity": None,
            "unit": None,
            "quantity_is_known": False,
            "use_soon": False,
        }
    ]


def test_quick_start_presence_add_lists_unknown_quantity_instead_of_fake_each(client):
    client.post("/pantry/clear")

    add_response = client.post("/pantry/add-presence", json={"name": "chicken"})
    assert add_response.status_code == 200

    data = _unwrap(add_response)
    assert data["items"] == [
        {
            "ingredient": "chicken",
            "quantity": None,
            "unit": None,
            "quantity_is_known": False,
            "use_soon": False,
        }
    ]


def test_unknown_quantity_import_can_surface_as_closest_option_without_claiming_strong_match(client):
    client.post("/pantry/clear")

    with SessionLocal() as db:
        recipe_id = _create_recipe_with_rows(
            db,
            name="Chicken Enchilada Rice Skillet Route Anchor",
            rows=[
                {"ingredient_name": "chicken breast", "required_quantity": 1.25, "unit": "lb"},
                {"ingredient_name": "rice", "required_quantity": 2, "unit": "cup"},
                {"ingredient_name": "enchilada sauce", "required_quantity": 1.5, "unit": "cup"},
            ],
        )

    client.post("/pantry/import/commit", json={"lines": ["chicken breast", "enchilada sauce"]})
    client.post("/pantry/add", json={"name": "rice", "amount": 2, "unit": "cup"})

    recommendations_response = client.get(
        "/recommendations",
        params=[
            ("pantry", "chicken breast"),
            ("pantry", "rice"),
            ("pantry", "enchilada sauce"),
        ],
    )
    assert recommendations_response.status_code == 200

    data = _unwrap(recommendations_response)
    assert data["recommendation_status"] == "no_strong_match"
    assert data["best_tonight"] is None
    assert data["closest_options"][0]["recipe"]["recipe_id"] == recipe_id
    assert data["closest_options"][0]["recipe"]["recommendation_type"] == "almost_there"
    assert data["closest_options"][0]["recipe"]["pantry_coverage_pct"] == 100
    assert data["closest_options"][0]["recipe"]["missing_count"] == 2
    assert data["closest_options"][0]["recipe"]["missing_core_count"] == 0
    assert data["closest_options"][0]["missing"]["quantity_confirmation_count"] == 2
    assert sorted(data["closest_options"][0]["missing"]["quantity_confirmation_ingredients"]) == [
        "chicken breast",
        "enchilada sauce",
    ]
    assert data["closest_options"][0]["missing"]["summary"] == (
        "Need quantity confirmation for 2 ingredients: chicken breast, enchilada sauce."
    )
    assert data["closest_options"][0]["cta"]["type"] == "cook_recipe"
    assert data["closest_options"][0]["cta"]["pantry_ready"] is False


def test_cook_blocks_when_required_ingredient_quantity_is_unknown_from_import(client):
    client.post("/pantry/clear")

    with SessionLocal() as db:
        recipe_id = _create_recipe_with_rows(
            db,
            name="Truthful Quesadilla",
            rows=[
                {"ingredient_name": "truth_tortilla", "required_quantity": 4, "unit": "ea"},
                {"ingredient_name": "truth_cheddar", "required_quantity": 1, "unit": "cup"},
            ],
        )

    client.post("/pantry/import/commit", json={"lines": ["truth_tortilla", "truth_cheddar"]})

    cook_response = client.post(f"/cook/{recipe_id}")
    assert cook_response.status_code == 409
    message = cook_response.json()["error"]["message"]
    assert "truth_tortilla" in message
    assert "truth_cheddar" in message


def test_quick_start_presence_add_keeps_measured_ingredients_in_quantity_confirmation_bucket(client):
    client.post("/pantry/clear")

    with SessionLocal() as db:
        recipe_id = _create_recipe_with_rows(
            db,
            name="Quick Start Truth Bowl",
            rows=[
                {"ingredient_name": "rice", "required_quantity": 1.5, "unit": "cup"},
                {"ingredient_name": "garlic", "required_quantity": 3, "unit": "ea"},
                {"ingredient_name": "oil", "required_quantity": 1, "unit": "tbsp"},
            ],
        )

    for ingredient_name in ["rice", "garlic", "oil"]:
        response = client.post("/pantry/add-presence", json={"name": ingredient_name})
        assert response.status_code == 200

    recommendations_response = client.get(
        "/recommendations",
        params=[
            ("pantry", "rice"),
            ("pantry", "garlic"),
            ("pantry", "oil"),
        ],
    )
    assert recommendations_response.status_code == 200

    data = _unwrap(recommendations_response)
    assert data["recommendation_status"] == "no_strong_match"
    assert data["best_tonight"] is None
    all_rows = data["cook_now"] + data["almost_there"] + data["not_worth_it"]
    closest = next(row for row in all_rows if row["recipe"]["recipe_id"] == recipe_id)
    assert closest["recipe"]["recommendation_type"] == "almost_there"
    assert closest["recipe"]["missing_core_count"] == 0
    assert closest["missing"]["quantity_confirmation_count"] == 3
    assert sorted(closest["missing"]["quantity_confirmation_ingredients"]) == ["garlic", "oil", "rice"]
    assert closest["cta"]["pantry_ready"] is False

    recipe_detail_response = client.get(f"/recipes/{recipe_id}")
    assert recipe_detail_response.status_code == 200
    recipe_detail = _unwrap(recipe_detail_response)
    assert recipe_detail["readiness"]["can_cook_now"] is False
    assert sorted(recipe_detail["readiness"]["required_quantity_confirmation_ingredients"]) == ["garlic", "oil", "rice"]

    ingredient_rows = {row["ingredient_name"]: row for row in recipe_detail["ingredients"]}
    assert ingredient_rows["rice"]["pantry_status"] == "needs_quantity_confirmation"
    assert ingredient_rows["rice"]["pantry_quantity"] is None
    assert ingredient_rows["rice"]["pantry_unit"] is None
    assert ingredient_rows["rice"]["pantry_quantity_is_known"] is False
    assert ingredient_rows["garlic"]["pantry_status"] == "needs_quantity_confirmation"
    assert ingredient_rows["oil"]["pantry_status"] == "needs_quantity_confirmation"


def test_recipe_detail_marks_incompatible_known_units_for_manual_confirmation(client):
    client.post("/pantry/clear")

    with SessionLocal() as db:
        recipe_id = _create_recipe_with_rows(
            db,
            name="Chicken Unit Truth Bowl",
            rows=[
                {"ingredient_name": "chicken breast", "required_quantity": 1.5, "unit": "lb"},
            ],
        )

    pantry_response = client.post("/pantry/add", json={"name": "chicken breast", "amount": 3, "unit": "ea"})
    assert pantry_response.status_code == 200

    recipe_detail_response = client.get(f"/recipes/{recipe_id}")
    assert recipe_detail_response.status_code == 200
    recipe_detail = _unwrap(recipe_detail_response)

    assert recipe_detail["readiness"]["can_cook_now"] is False
    assert recipe_detail["readiness"]["missing_required_ingredients"] == []
    assert recipe_detail["readiness"]["required_quantity_confirmation_ingredients"] == ["chicken breast"]

    ingredient_rows = {row["ingredient_name"]: row for row in recipe_detail["ingredients"]}
    chicken = ingredient_rows["chicken breast"]
    assert chicken["pantry_status"] == "needs_quantity_confirmation"
    assert chicken["pantry_quantity"] == 3
    assert chicken["pantry_unit"] == "ea"
    assert chicken["pantry_quantity_is_known"] is True
    assert chicken["pantry_has_enough"] is False


def test_recipe_detail_marks_generic_cheese_as_family_check_not_missing(client):
    client.post("/pantry/clear")

    with SessionLocal() as db:
        recipe_id = _create_recipe_with_rows(
            db,
            name="Cheddar Detail Truth Bowl",
            rows=[
                {"ingredient_name": "cheddar", "required_quantity": 2, "unit": "cup"},
            ],
        )

    pantry_response = client.post("/pantry/import/commit", json={"lines": ["cheese"]})
    assert pantry_response.status_code == 200

    recipe_detail_response = client.get(f"/recipes/{recipe_id}")
    assert recipe_detail_response.status_code == 200
    recipe_detail = _unwrap(recipe_detail_response)

    assert recipe_detail["readiness"]["can_cook_now"] is False
    assert recipe_detail["readiness"]["missing_required_ingredients"] == []
    assert recipe_detail["readiness"]["required_quantity_confirmation_ingredients"] == ["cheddar"]

    ingredient_rows = {row["ingredient_name"]: row for row in recipe_detail["ingredients"]}
    cheddar = ingredient_rows["cheddar"]
    assert cheddar["ingredient_name"] == "cheddar"
    assert cheddar["pantry_status"] == "needs_quantity_confirmation"
    assert cheddar["pantry_match_kind"] == "family"
    assert cheddar["pantry_matched_name"] == "cheese"
    assert cheddar["pantry_quantity_is_known"] is False
    assert cheddar["pantry_has_enough"] is False
    assert "You have cheese saved" in cheddar["pantry_note"]


def test_recipe_detail_keeps_specialty_cheese_missing_without_family_support(client):
    client.post("/pantry/clear")

    with SessionLocal() as db:
        recipe_id = _create_recipe_with_rows(
            db,
            name="Ricotta Detail Truth Bowl",
            rows=[
                {"ingredient_name": "ricotta", "required_quantity": 1, "unit": "cup"},
            ],
        )

    pantry_response = client.post("/pantry/import/commit", json={"lines": ["cheese"]})
    assert pantry_response.status_code == 200

    recipe_detail_response = client.get(f"/recipes/{recipe_id}")
    assert recipe_detail_response.status_code == 200
    recipe_detail = _unwrap(recipe_detail_response)

    assert recipe_detail["readiness"]["missing_required_ingredients"] == ["ricotta"]
    ingredient_rows = {row["ingredient_name"]: row for row in recipe_detail["ingredients"]}
    assert ingredient_rows["ricotta"]["pantry_status"] == "missing"


def test_quick_start_presence_soft_covers_common_meal_floors_without_claiming_pantry_ready(client):
    client.post("/pantry/clear")

    with SessionLocal() as db:
        recipe_id = _create_recipe_with_rows(
            db,
            name="Quick Start Chicken Rice Plate",
            rows=[
                {"ingredient_name": "chicken breast", "required_quantity": 1.25, "unit": "lb"},
                {"ingredient_name": "rice", "required_quantity": 2, "unit": "cup"},
                {"ingredient_name": "oil", "required_quantity": 1, "unit": "tbsp"},
            ],
        )

    for ingredient_name in ["chicken", "rice", "oil"]:
        response = client.post("/pantry/add-presence", json={"name": ingredient_name})
        assert response.status_code == 200

    recommendations_response = client.get(
        "/recommendations",
        params=[
          ("pantry", "chicken"),
          ("pantry", "rice"),
          ("pantry", "oil"),
        ],
    )
    assert recommendations_response.status_code == 200

    data = _unwrap(recommendations_response)
    assert data["recommendation_status"] == "no_strong_match"
    assert data["best_tonight"] is None
    closest = next(row for row in data["closest_options"] if row["recipe"]["recipe_id"] == recipe_id)
    assert closest["recipe"]["recommendation_type"] == "almost_there"
    assert closest["recipe"]["pantry_coverage_pct"] == 100
    assert closest["recipe"]["missing_core_count"] == 0
    assert closest["missing"]["quantity_confirmation_count"] == 3
    assert closest["missing"]["summary"] == "Need quantity confirmation for 3 ingredients: chicken breast, oil, rice."
    assert closest["cta"]["type"] == "cook_recipe"
    assert closest["cta"]["missing_ingredients"] == []
    assert closest["cta"]["pantry_ready"] is False


def test_quick_start_presence_does_not_soft_cover_requirements_above_the_floor(client):
    client.post("/pantry/clear")

    with SessionLocal() as db:
        recipe_id = _create_recipe_with_rows(
            db,
            name="Oversized Quick Start Chicken Tray",
            rows=[
                {"ingredient_name": "chicken breast", "required_quantity": 2.5, "unit": "lb"},
                {"ingredient_name": "rice", "required_quantity": 3, "unit": "cup"},
            ],
        )

    for ingredient_name in ["chicken", "rice"]:
        response = client.post("/pantry/add-presence", json={"name": ingredient_name})
        assert response.status_code == 200

    recommendations_response = client.get(
        "/recommendations",
        params=[
            ("pantry", "chicken"),
            ("pantry", "rice"),
        ],
    )
    assert recommendations_response.status_code == 200

    data = _unwrap(recommendations_response)
    all_rows = data["cook_now"] + data["almost_there"] + data["not_worth_it"]
    closest = next(row for row in all_rows if row["recipe"]["recipe_id"] == recipe_id)
    assert closest["recipe"]["recommendation_type"] == "not_worth_it"
    assert closest["recipe"]["pantry_coverage_pct"] == 0
    assert closest["recipe"]["missing_core_count"] == 2
    assert closest["missing"]["quantity_confirmation_count"] == 1
