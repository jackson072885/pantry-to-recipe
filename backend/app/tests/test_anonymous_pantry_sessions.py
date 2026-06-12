from __future__ import annotations

import json
import uuid

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.pantry_item import PantryItem
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user_action import UserAction
from app.services.recommendation_service import recommend_recipes


SESSION_A = {"X-Pantry-Session-Id": "test-session-a"}
SESSION_B = {"X-Pantry-Session-Id": "test-session-b"}


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def _create_single_ingredient_recipe() -> tuple[int, str]:
    suffix = uuid.uuid4().hex[:8]
    ingredient_name = f"session-egg-{suffix}"

    with SessionLocal() as db:
        ingredient = Ingredient(canonical_name=ingredient_name)
        db.add(ingredient)
        db.flush()

        recipe = Recipe(
            name=f"Session Omelet {suffix}",
            servings=1,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
            is_production_ready=True,
            quality_score=24,
        )
        db.add(recipe)
        db.flush()

        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                is_required=True,
                required_quantity=2,
                unit="ea",
            )
        )
        db.commit()
        return recipe.id, ingredient_name


def test_pantry_routes_keep_two_sessions_separate(client):
    client.post("/pantry/clear", headers=SESSION_A)
    client.post("/pantry/clear", headers=SESSION_B)

    add_a = client.post("/pantry/add", json={"name": "session rice", "amount": 2}, headers=SESSION_A)
    add_b = client.post("/pantry/add", json={"name": "session lentils", "amount": 4}, headers=SESSION_B)
    assert add_a.status_code == 200
    assert add_b.status_code == 200

    pantry_a = _unwrap(client.get("/pantry", headers=SESSION_A))
    pantry_b = _unwrap(client.get("/pantry", headers=SESSION_B))

    assert [item["ingredient"] for item in pantry_a["items"]] == ["session rice"]
    assert [item["ingredient"] for item in pantry_b["items"]] == ["session lentil"]

    clear_a = _unwrap(client.post("/pantry/clear", headers=SESSION_A))
    assert clear_a == {"cleared_count": 1}
    assert _unwrap(client.get("/pantry", headers=SESSION_A))["items"] == []
    assert [item["ingredient"] for item in _unwrap(client.get("/pantry", headers=SESSION_B))["items"]] == [
        "session lentil"
    ]


def test_recommendations_recipe_detail_and_cook_use_request_session(client):
    recipe_id, ingredient_name = _create_single_ingredient_recipe()
    client.post("/pantry/clear", headers=SESSION_A)
    client.post("/pantry/clear", headers=SESSION_B)
    client.post("/pantry/add", json={"name": ingredient_name, "amount": 3, "unit": "ea"}, headers=SESSION_A)

    params = [("pantry", ingredient_name)]
    session_a_recommendations = _unwrap(client.get("/recommendations", params=params, headers=SESSION_A))
    session_b_recommendations = _unwrap(client.get("/recommendations", params=params, headers=SESSION_B))

    assert recipe_id in {row["recipe"]["recipe_id"] for row in session_a_recommendations["cook_now"]}
    assert recipe_id not in {row["recipe"]["recipe_id"] for row in session_b_recommendations["cook_now"]}

    detail_a = _unwrap(client.get(f"/recipes/{recipe_id}", headers=SESSION_A))
    detail_b = _unwrap(client.get(f"/recipes/{recipe_id}", headers=SESSION_B))
    assert detail_a["readiness"]["can_cook_now"] is True
    assert detail_b["readiness"]["can_cook_now"] is False
    assert detail_b["readiness"]["missing_required_ingredients"] == [ingredient_name]

    cook_b = client.post(f"/cook/{recipe_id}", headers=SESSION_B)
    assert cook_b.status_code == 409

    cook_a = client.post(f"/cook/{recipe_id}", headers=SESSION_A)
    assert cook_a.status_code == 200
    assert _unwrap(cook_a)["deductions"] == [{"ingredient": ingredient_name, "quantity": 2.0, "unit": "ea"}]

    remaining_a = {
        item["ingredient"]: item for item in _unwrap(client.get("/pantry", headers=SESSION_A))["items"]
    }
    assert remaining_a[ingredient_name]["quantity"] == 1.0
    assert _unwrap(client.get("/pantry", headers=SESSION_B))["items"] == []


def test_service_recommendations_and_event_history_are_session_scoped(client):
    recipe_id, ingredient_name = _create_single_ingredient_recipe()

    with SessionLocal() as db:
        ingredient = db.query(Ingredient).filter(Ingredient.canonical_name == ingredient_name).one()
        db.add(
            PantryItem(
                session_id="service-session-a",
                ingredient_id=ingredient.id,
                quantity=2,
                unit="ea",
            )
        )
        db.add(
            UserAction(
                session_id="service-session-a",
                event="recipe_liked",
                recipe_id=recipe_id,
                metadata_json=json.dumps({"source": "test"}, sort_keys=True),
            )
        )
        db.commit()

        session_a = recommend_recipes(db, [ingredient_name], session_id="service-session-a")
        session_b = recommend_recipes(db, [ingredient_name], session_id="service-session-b")

    session_a_entry = next(row for row in session_a["cook_now"] if row["recipe"]["recipe_id"] == recipe_id)
    assert session_a_entry["behavior"]["has_signal"] is True
    assert recipe_id not in {row["recipe"]["recipe_id"] for row in session_b["cook_now"]}
