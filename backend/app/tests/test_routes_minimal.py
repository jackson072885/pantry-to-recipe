from __future__ import annotations

import json
import uuid

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user_action import UserAction


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def _create_recipe_with_requirements(requirements: list[dict]) -> tuple[int, dict[str, str]]:
    suffix = uuid.uuid4().hex[:8]
    db = SessionLocal()
    try:
        ingredient_names: dict[str, str] = {}
        ingredient_ids: dict[str, int] = {}

        for row in requirements:
            canonical_name = f"qty-{row['key']}-{suffix}"
            ingredient = Ingredient(canonical_name=canonical_name)
            db.add(ingredient)
            db.flush()
            ingredient_names[row["key"]] = canonical_name
            ingredient_ids[row["key"]] = ingredient.id

        recipe = Recipe(
            name=f"Quantity Recipe {suffix}",
            servings=2,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
            is_production_ready=True,
        )
        db.add(recipe)
        db.flush()

        for row in requirements:
            db.add(
                RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredient_ids[row["key"]],
                    is_required=True,
                    required_quantity=row["quantity"],
                    unit=row.get("unit", "ea"),
                )
            )

        db.commit()
        return recipe.id, ingredient_names
    finally:
        db.close()


def _create_ranked_recipe(
    *,
    name: str,
    ingredient_names: list[str],
    total_time_minutes: int = 20,
    difficulty: str = "Easy",
    prep_complexity: str = "simple",
    quality_score: int = 20,
) -> int:
    db = SessionLocal()
    try:
        ingredient_ids: list[int] = []
        for canonical_name in ingredient_names:
            ingredient = (
                db.query(Ingredient)
                .filter(Ingredient.canonical_name == canonical_name)
                .one_or_none()
            )
            if ingredient is None:
                ingredient = Ingredient(canonical_name=canonical_name)
                db.add(ingredient)
                db.flush()
            ingredient_ids.append(ingredient.id)

        recipe = Recipe(
            name=name,
            servings=2,
            total_time_minutes=total_time_minutes,
            difficulty=difficulty,
            prep_complexity=prep_complexity,
            quality_score=quality_score,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
            is_production_ready=True,
        )
        db.add(recipe)
        db.flush()

        for ingredient_id in ingredient_ids:
            db.add(
                RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredient_id,
                    is_required=True,
                    required_quantity=1,
                    unit="ea",
                )
            )

        db.commit()
        return recipe.id
    finally:
        db.close()


def _record_user_action(event: str, recipe_id: int, metadata: dict | None = None) -> None:
    db = SessionLocal()
    try:
        db.add(
            UserAction(
                event=event,
                recipe_id=recipe_id,
                metadata_json=json.dumps(metadata or {}, sort_keys=True),
            )
        )
        db.commit()
    finally:
        db.close()


def test_recommendations_endpoint(client):
    response = client.get(
        "/recommendations",
        params=[("pantry", "chicken"), ("pantry", "rice"), ("pantry", "salt")],
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert "best_tonight" in data
    assert "alternatives" in data
    assert "closest_options" in data
    assert "decision_mode" in data
    assert "cook_now" in data
    assert "almost_there" in data
    assert "not_worth_it" in data
    assert data["contract_version"] == "2026-04-05"
    assert data["recommendation_status"] in {"strong_match", "no_strong_match"}
    assert "generated_from" in data
    assert "tie_break_rule" in data
    assert data["decision_mode"]["key"] == "balanced"
    assert isinstance(data["cook_now"], list)
    assert isinstance(data["almost_there"], list)
    assert isinstance(data["not_worth_it"], list)
    assert isinstance(data["closest_options"], list)


def test_recommendations_refresh_from_cleared_tiny_pantry_without_stale_bass(client):
    client.post("/pantry/clear")
    for item in ["rice", "salt", "oil", "eggs"]:
        response = client.post("/pantry/add", json={"name": item, "amount": 1})
        assert response.status_code == 200

    pantry_response = client.get("/pantry")
    assert pantry_response.status_code == 200
    pantry_data = _unwrap(pantry_response)
    assert [item["ingredient"] for item in pantry_data["items"]] == ["egg", "oil", "rice", "salt"]

    response = client.get(
        "/recommendations",
        params=[("pantry", "rice"), ("pantry", "salt"), ("pantry", "oil"), ("pantry", "eggs")],
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["generated_from"] == {
        "pantry_items": ["egg", "oil", "rice", "salt"],
        "pantry_count": 4,
    }
    closest_names = [row["recipe"]["recipe_name"] for row in data["closest_options"]]
    assert closest_names
    assert data["recommendation_status"] in {"strong_match", "no_strong_match"}
    assert len(closest_names) <= 3


def test_recommendations_refresh_from_shrimp_pantry_without_stale_bass(client):
    client.post("/pantry/clear")
    for item in ["shrimp", "garlic", "butter", "lemon"]:
        response = client.post("/pantry/add", json={"name": item, "amount": 1})
        assert response.status_code == 200

    pantry_response = client.get("/pantry")
    assert pantry_response.status_code == 200
    pantry_data = _unwrap(pantry_response)
    assert [item["ingredient"] for item in pantry_data["items"]] == ["butter", "garlic", "lemon", "shrimp"]

    response = client.get(
        "/recommendations",
        params=[("pantry", "shrimp"), ("pantry", "garlic"), ("pantry", "butter"), ("pantry", "lemon")],
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["generated_from"] == {
        "pantry_items": ["butter", "garlic", "lemon", "shrimp"],
        "pantry_count": 4,
    }
    if data["best_tonight"] is not None:
        assert data["best_tonight"]["recipe"]["recipe_name"] != "Crispy Lemon Pan-Fried Bass"
    closest_names = [row["recipe"]["recipe_name"] for row in data["closest_options"]]
    assert closest_names
    assert closest_names[0] != "Crispy Lemon Pan-Fried Bass"


def test_pantry_add_remove(client):
    response = client.post("/pantry/add", json={"name": "test_ingredient", "amount": 2})
    assert response.status_code == 200
    data = _unwrap(response)
    items = {item["ingredient"]: item for item in data.get("items", [])}
    assert items["test_ingredient"]["quantity"] == 2.0
    assert items["test_ingredient"]["unit"] == "ea"

    response = client.post("/pantry/remove", json={"name": "test_ingredient", "amount": 1})
    assert response.status_code == 200
    data = _unwrap(response)
    items = {item["ingredient"]: item for item in data.get("items", [])}
    assert items["test_ingredient"]["quantity"] == 1.0
    assert items["test_ingredient"]["unit"] == "ea"


def test_pantry_clear_returns_count_and_empties_pantry(client):
    client.post("/pantry/clear")
    client.post("/pantry/add", json={"name": "clear_test_a", "amount": 2})
    client.post("/pantry/add", json={"name": "clear_test_b", "amount": 1})

    response = client.post("/pantry/clear")
    assert response.status_code == 200
    data = _unwrap(response)
    assert data == {"cleared_count": 2}

    pantry_response = client.get("/pantry")
    pantry_data = _unwrap(pantry_response)
    assert pantry_data["items"] == []


def test_pantry_clear_is_idempotent_when_empty(client):
    client.post("/pantry/clear")

    response = client.post("/pantry/clear")
    assert response.status_code == 200
    data = _unwrap(response)
    assert data == {"cleared_count": 0}


def test_recipe_404_uses_standard_error_envelope(client):
    response = client.get("/recipes/999999")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert data["data"] is None
    assert data["error"] == {
        "code": "NOT_FOUND",
        "message": "Recipe not found",
    }


def test_validation_error_uses_standard_error_envelope(client):
    response = client.get("/recommendations")
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["data"] is None
    assert data["error"] == {
        "code": "BAD_REQUEST",
        "message": "At least one pantry item is required",
    }


def test_blank_pantry_item_uses_standard_error_envelope(client):
    response = client.get(
        "/recommendations",
        params=[("pantry", "   ")],
    )
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["data"] is None
    assert data["error"] == {
        "code": "BAD_REQUEST",
        "message": "Pantry items must be non-empty strings",
    }


def test_handled_route_error_uses_standard_error_envelope(client):
    response = client.post("/pantry/add", json={"name": "rice", "amount": 0})
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["data"] is None
    assert data["error"] == {
        "code": "BAD_REQUEST",
        "message": "Amount must be greater than 0",
    }


def test_recommendation_item_shape(client):
    response = client.get(
        "/recommendations",
        params=[("pantry", "chicken"), ("pantry", "rice")],
    )
    assert response.status_code == 200
    data = _unwrap(response)
    bucket = data["cook_now"] or data["almost_there"] or data["not_worth_it"]
    if bucket:
        item = bucket[0]
        assert "recipe" in item
        assert "explanation" in item
        assert "why_best" in item
        assert "recommendation_type" in item
        assert "confidence_score" in item
        assert "confidence_label" in item
        assert "behavior" in item
        assert "score_breakdown" in item
        assert "missing" in item
        assert "cta" in item
        recipe = item["recipe"]
        assert "recipe_id" in recipe
        assert "recipe_name" in recipe
        assert "pantry_coverage_pct" in recipe
        assert "missing_count" in recipe
        assert "missing_ingredients" in recipe
        assert "estimated_time_minutes" in recipe
        assert "simplicity" in recipe
        assert "short_description" in recipe
        assert "difficulty" in recipe
        assert "meal_type" in recipe
        assert "servings" in recipe
        assert "quality_score" in recipe
        assert "quality_bucket" in recipe
        assert "review_status" in recipe
        assert "is_weeknight_friendly" in recipe
        assert "is_beginner_friendly" in recipe
        assert "present_required_count" in recipe
        assert "required_count" in recipe
        assert "recommendation_type" in recipe
        assert "_behavior_points" not in recipe
        assert "_behavior_details" not in recipe
        assert "behavior" not in recipe
        assert set(item["behavior"].keys()) == {
            "has_signal",
            "points",
            "direct_recipe_points",
            "direct_recipe_event_count",
            "recent_positive_event_count",
            "ingredient_affinity_points",
            "ingredient_matches",
            "positive_preference",
            "negative_preference",
            "signal_scope",
        }
        assert set(item["score_breakdown"].keys()) == {
            "base_tonight_score",
            "mode_key",
            "mode_points",
            "mode_applied",
            "use_soon_points",
            "use_soon_applied",
            "hero_fatigue_points",
            "hero_fatigue_applied",
            "behavior_points",
            "behavior_applied",
        }
        assert item["missing"]["count"] == recipe["missing_count"]
        assert item["missing"]["ingredients"] == recipe["missing_ingredients"]
        assert item["cta"]["missing_count"] == recipe["missing_count"]
        assert item["cta"]["internal_path"] == f"/recipes/{recipe['recipe_id']}"


def test_best_tonight_and_alternatives_shape(client):
    response = client.get(
        "/recommendations",
        params=[("pantry", "chicken"), ("pantry", "rice"), ("pantry", "salt")],
    )
    assert response.status_code == 200
    data = _unwrap(response)
    best = data["best_tonight"]
    assert best is None or {
        "recipe",
        "explanation",
        "why_best",
        "recommendation_type",
        "confidence_score",
        "confidence_label",
        "behavior",
        "score_breakdown",
        "missing",
        "cta",
        "tonight_score",
    }.issubset(best.keys())
    assert len(data["alternatives"]) <= 3
    assert len(data["closest_options"]) <= 3
    if best is not None:
        assert {
            "recipe_id",
            "recipe_name",
            "pantry_coverage_pct",
            "missing_count",
            "missing_ingredients",
            "recommendation_type",
        }.issubset(best["recipe"].keys())
        assert best["recommendation_type"] == best["recipe"]["recommendation_type"]
        assert best["confidence_label"] in {"high", "medium", "low"}
        assert best["cta"]["internal_path"] == f"/recipes/{best['recipe']['recipe_id']}"
        assert "_behavior_points" not in best["recipe"]
        assert "_behavior_details" not in best["recipe"]
        assert "_mode_details" not in best["recipe"]
        assert "behavior" not in best["recipe"]


def test_recommendations_endpoint_accepts_decision_mode_and_returns_mode_metadata(client):
    response = client.get(
        "/recommendations",
        params=[
            ("pantry", "chicken"),
            ("pantry", "rice"),
            ("mode", "lowest_effort"),
        ],
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["decision_mode"] == {
        "key": "lowest_effort",
        "label": "Lowest effort tonight",
        "description": "Pantry fit stays first. Close calls favor shorter, simpler dinners.",
        "default": False,
    }


def test_recommendations_endpoint_accepts_common_alias_inputs_without_drift(client):
    response = client.get(
        "/recommendations",
        params=[("pantry", "scallions"), ("pantry", "egg"), ("pantry", "rice")],
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert "green onion" in data["generated_from"]["pantry_items"]
    assert "scallions" not in data["generated_from"]["pantry_items"]


def test_weak_pantry_returns_no_strong_match_with_closest_options(client):
    suffix = uuid.uuid4().hex[:8]
    pantry_name = f"weak-pantry-{suffix}"
    support_name = f"weak-support-{suffix}"

    closer_recipe_id = _create_ranked_recipe(
        name=f"Closer Weak Fit {suffix}",
        ingredient_names=[
            pantry_name,
            support_name,
            f"closer-missing-a-{suffix}",
            f"closer-missing-b-{suffix}",
        ],
        quality_score=12,
    )
    distant_recipe_id = _create_ranked_recipe(
        name=f"Distant Weak Fit {suffix}",
        ingredient_names=[
            pantry_name,
            f"distant-missing-a-{suffix}",
            f"distant-missing-b-{suffix}",
            f"distant-missing-c-{suffix}",
            f"distant-missing-d-{suffix}",
        ],
        quality_score=30,
    )
    client.post("/pantry/add", json={"name": pantry_name, "amount": 1, "unit": "ea"})
    client.post("/pantry/add", json={"name": support_name, "amount": 1, "unit": "ea"})

    response = client.get(
        "/recommendations",
        params=[("pantry", pantry_name), ("pantry", support_name)],
    )
    assert response.status_code == 200
    data = _unwrap(response)

    assert data["recommendation_status"] == "no_strong_match"
    assert data["best_tonight"] is None
    closest_ids = [row["recipe"]["recipe_id"] for row in data["closest_options"]]
    assert closer_recipe_id in closest_ids
    assert distant_recipe_id in closest_ids
    assert closest_ids.index(closer_recipe_id) < closest_ids.index(distant_recipe_id)
    assert data["alternatives"] == data["closest_options"]


def test_strong_pantry_still_returns_best_tonight(client):
    suffix = uuid.uuid4().hex[:8]
    pantry_names = [
        f"strong-a-{suffix}",
        f"strong-b-{suffix}",
        f"strong-c-{suffix}",
    ]
    recipe_id = _create_ranked_recipe(
        name=f"Strong Pantry Winner {suffix}",
        ingredient_names=pantry_names,
        quality_score=18,
    )
    for pantry_name in pantry_names:
        client.post("/pantry/add", json={"name": pantry_name, "amount": 1, "unit": "ea"})

    response = client.get(
        "/recommendations",
        params=[("pantry", pantry_names[0]), ("pantry", pantry_names[1]), ("pantry", pantry_names[2])],
    )
    assert response.status_code == 200
    data = _unwrap(response)

    assert data["recommendation_status"] == "strong_match"
    assert data["best_tonight"] is not None
    assert data["best_tonight"]["recipe"]["recipe_id"] == recipe_id
    assert data["best_tonight"]["recipe"]["missing_count"] == 0



def test_recipe_detail_returns_enriched_structure(client):
    listing = client.get("/recipes", params={"limit": 1})
    assert listing.status_code == 200
    rows = _unwrap(listing)
    assert rows

    recipe_id = rows[0]["id"]
    response = client.get(f"/recipes/{recipe_id}")
    assert response.status_code == 200
    data = _unwrap(response)

    assert data["id"] == recipe_id
    assert isinstance(data["ingredients"], list)
    assert isinstance(data["steps"], list)
    assert isinstance(data["equipment"], list)
    assert isinstance(data["tips"], list)
    assert isinstance(data["warnings"], list)
    assert isinstance(data["storage"], list)
    assert isinstance(data["tags"], list)
    assert data["quality_bucket"] in {"KEEP_AS_IS", "KEEP_AND_ENRICH"}
    assert data["review_status"] == "approved"

    if data["ingredients"]:
        ingredient = data["ingredients"][0]
        assert "display_name" in ingredient
        assert "pantry_name" in ingredient
        assert "measurement_is_estimated" in ingredient
        assert "required_quantity" in ingredient
        assert "unit" in ingredient


def test_recommendation_tie_break_rule_is_stable(client):
    suffix = uuid.uuid4().hex[:8]
    pantry_name = f"stable-pantry-{suffix}"
    alpha_name = f"stable-alpha-{suffix}"
    beta_name = f"stable-beta-{suffix}"

    db = SessionLocal()
    try:
        ingredients = {}
        for canonical_name in [pantry_name, alpha_name, beta_name]:
            ingredient = Ingredient(canonical_name=canonical_name)
            db.add(ingredient)
            db.flush()
            ingredients[canonical_name] = ingredient.id

        alpha_recipe = Recipe(
            name=f"A Stable Recipe {suffix}",
            servings=2,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
            is_production_ready=True,
        )
        beta_recipe = Recipe(
            name=f"B Stable Recipe {suffix}",
            servings=2,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
            is_production_ready=True,
        )
        db.add_all([alpha_recipe, beta_recipe])
        db.flush()

        db.add_all([
            RecipeIngredient(recipe_id=alpha_recipe.id, ingredient_id=ingredients[pantry_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=alpha_recipe.id, ingredient_id=ingredients[alpha_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=beta_recipe.id, ingredient_id=ingredients[pantry_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=beta_recipe.id, ingredient_id=ingredients[beta_name], is_required=True, required_quantity=1, unit="ea"),
        ])
        db.commit()
        alpha_recipe_id = alpha_recipe.id
        beta_recipe_id = beta_recipe.id
    finally:
        db.close()

    client.post("/pantry/add", json={"name": pantry_name, "amount": 1, "unit": "ea"})

    response = client.get(
        "/recommendations",
        params=[("pantry", pantry_name)],
    )
    assert response.status_code == 200
    data = _unwrap(response)

    ids = [row["recipe"]["recipe_id"] for row in data["almost_there"] if row["recipe"]["recipe_id"] in {alpha_recipe_id, beta_recipe_id}]
    assert ids == [alpha_recipe_id, beta_recipe_id]


def test_recommendations_use_quality_score_as_ranking_factor(client):
    suffix = uuid.uuid4().hex[:8]
    pantry_name = f"quality-pantry-{suffix}"
    shared_name = f"quality-shared-{suffix}"
    top_name = f"quality-top-{suffix}"
    lower_name = f"quality-lower-{suffix}"

    db = SessionLocal()
    try:
        ingredients = {}
        for canonical_name in [pantry_name, shared_name, top_name, lower_name]:
            ingredient = Ingredient(canonical_name=canonical_name)
            db.add(ingredient)
            db.flush()
            ingredients[canonical_name] = ingredient.id

        top_recipe = Recipe(
            name=f"A Quality Leader {suffix}",
            servings=2,
            total_time_minutes=20,
            difficulty="Easy",
            prep_complexity="simple",
            quality_score=29,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
            is_production_ready=True,
        )
        lower_recipe = Recipe(
            name=f"B Quality Follower {suffix}",
            servings=2,
            total_time_minutes=20,
            difficulty="Easy",
            prep_complexity="simple",
            quality_score=16,
            quality_bucket="KEEP_AND_ENRICH",
            review_status="approved",
            is_production_ready=True,
        )
        db.add_all([top_recipe, lower_recipe])
        db.flush()

        db.add_all([
            RecipeIngredient(recipe_id=top_recipe.id, ingredient_id=ingredients[pantry_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=top_recipe.id, ingredient_id=ingredients[shared_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=top_recipe.id, ingredient_id=ingredients[top_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=lower_recipe.id, ingredient_id=ingredients[pantry_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=lower_recipe.id, ingredient_id=ingredients[shared_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=lower_recipe.id, ingredient_id=ingredients[lower_name], is_required=True, required_quantity=1, unit="ea"),
        ])
        db.commit()
        top_recipe_id = top_recipe.id
        lower_recipe_id = lower_recipe.id
    finally:
        db.close()

    client.post("/pantry/add", json={"name": pantry_name, "amount": 1, "unit": "ea"})
    client.post("/pantry/add", json={"name": shared_name, "amount": 1, "unit": "ea"})

    response = client.get(
        "/recommendations",
        params=[("pantry", pantry_name), ("pantry", shared_name)],
    )
    assert response.status_code == 200
    data = _unwrap(response)

    ids = [
        row["recipe"]["recipe_id"]
        for row in data["almost_there"]
        if row["recipe"]["recipe_id"] in {top_recipe_id, lower_recipe_id}
    ]
    assert ids == [top_recipe_id, lower_recipe_id]


def test_quality_score_cannot_override_obviously_poor_pantry_fit(client):
    suffix = uuid.uuid4().hex[:8]
    pantry_name = f"fit-pantry-{suffix}"
    support_name = f"fit-support-{suffix}"

    realistic_recipe_id = _create_ranked_recipe(
        name=f"Realistic Fit {suffix}",
        ingredient_names=[
            pantry_name,
            support_name,
            f"fit-missing-{suffix}",
        ],
        total_time_minutes=20,
        quality_score=8,
    )
    poor_fit_recipe_id = _create_ranked_recipe(
        name=f"Poor Fit Prestige {suffix}",
        ingredient_names=[
            pantry_name,
            f"poor-missing-a-{suffix}",
            f"poor-missing-b-{suffix}",
            f"poor-missing-c-{suffix}",
            f"poor-missing-d-{suffix}",
        ],
        total_time_minutes=20,
        quality_score=30,
    )
    client.post("/pantry/add", json={"name": pantry_name, "amount": 1, "unit": "ea"})
    client.post("/pantry/add", json={"name": support_name, "amount": 1, "unit": "ea"})

    response = client.get(
        "/recommendations",
        params=[("pantry", pantry_name), ("pantry", support_name)],
    )
    assert response.status_code == 200
    data = _unwrap(response)

    ranked_ids = [row["recipe"]["recipe_id"] for row in data["closest_options"]]
    assert realistic_recipe_id in ranked_ids
    assert poor_fit_recipe_id in ranked_ids
    assert ranked_ids.index(realistic_recipe_id) < ranked_ids.index(poor_fit_recipe_id)


def test_event_endpoint_persists_tracked_action(client):
    response = client.post(
        "/events",
        json={
            "event": "recipe_selected",
            "recipe_id": 19,
            "metadata": {
                "client_id": "client-test-1",
                "source": "recommendations",
            },
        },
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["accepted"] is True
    assert isinstance(data["event_id"], int)

    db = SessionLocal()
    try:
        action = db.query(UserAction).filter(UserAction.id == data["event_id"]).one()
        assert action.event == "recipe_selected"
        assert action.recipe_id == 19
        assert json.loads(action.metadata_json or "{}") == {
            "client_id": "client-test-1",
            "source": "recommendations",
        }
    finally:
        db.close()


def test_event_endpoint_accepts_explicit_preference_signals(client):
    response = client.post(
        "/events",
        json={
            "event": "recipe_liked",
            "recipe_id": 21,
            "metadata": {
                "client_id": "client-test-2",
                "source": "recipe_detail:preference_feedback",
            },
        },
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["accepted"] is True
    assert data["event"] == "recipe_liked"


def test_event_endpoint_validation_uses_standard_error_envelope(client):
    response = client.post(
        "/events",
        json={
            "event": "unknown_event",
            "recipe_id": 1,
        },
    )
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_global_behavior_history_can_influence_ranking(client):
    suffix = uuid.uuid4().hex[:8]
    preferred_name = f"fav-preferred-{suffix}"
    support_name = f"fav-support-{suffix}"
    pantry_name = f"fav-pantry-{suffix}"
    neutral_name = f"fav-neutral-{suffix}"

    db = SessionLocal()
    try:
        ingredients = {}
        for canonical_name in [preferred_name, support_name, pantry_name, neutral_name]:
            ingredient = Ingredient(canonical_name=canonical_name)
            db.add(ingredient)
            db.flush()
            ingredients[canonical_name] = ingredient.id

        historical_recipe = Recipe(
            name=f"History Recipe {suffix}",
            servings=2,
            instructions="Cook and serve.",
            quality_score=24,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
        )
        preferred_recipe = Recipe(
            name=f"Preferred Recipe {suffix}",
            servings=2,
            instructions="Cook and serve.",
            quality_score=24,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
        )
        neutral_recipe = Recipe(
            name=f"Neutral Recipe {suffix}",
            servings=2,
            instructions="Cook and serve.",
            quality_score=24,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
        )
        db.add_all([historical_recipe, preferred_recipe, neutral_recipe])
        db.flush()

        db.add_all([
            RecipeIngredient(recipe_id=historical_recipe.id, ingredient_id=ingredients[preferred_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=historical_recipe.id, ingredient_id=ingredients[support_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=preferred_recipe.id, ingredient_id=ingredients[preferred_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=preferred_recipe.id, ingredient_id=ingredients[pantry_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=neutral_recipe.id, ingredient_id=ingredients[neutral_name], is_required=True, required_quantity=1, unit="ea"),
            RecipeIngredient(recipe_id=neutral_recipe.id, ingredient_id=ingredients[pantry_name], is_required=True, required_quantity=1, unit="ea"),
        ])

        db.commit()
        historical_recipe_id = historical_recipe.id
        preferred_recipe_id = preferred_recipe.id
        neutral_recipe_id = neutral_recipe.id
    finally:
        db.close()

    _record_user_action("recipe_cooked_confirmed", historical_recipe_id, {"source": "test-history"})
    _record_user_action("cook_clicked", historical_recipe_id, {"source": "test-history"})

    client.post("/pantry/add", json={"name": pantry_name, "amount": 1, "unit": "ea"})

    response = client.get(
        "/recommendations",
        params=[("pantry", pantry_name)],
    )
    assert response.status_code == 200
    data = _unwrap(response)

    almost_ids = [row["recipe"]["recipe_id"] for row in data["almost_there"]]
    assert preferred_recipe_id in almost_ids
    assert neutral_recipe_id in almost_ids
    assert almost_ids.index(preferred_recipe_id) < almost_ids.index(neutral_recipe_id)

    preferred_item = next(
        row for row in data["almost_there"] if row["recipe"]["recipe_id"] == preferred_recipe_id
    )
    neutral_item = next(
        row for row in data["almost_there"] if row["recipe"]["recipe_id"] == neutral_recipe_id
    )
    assert preferred_item["behavior"]["has_signal"] is True
    assert preferred_item["behavior"]["points"] > neutral_item["behavior"]["points"]
    assert any(
        match["ingredient"] == preferred_name
        for match in preferred_item["behavior"]["ingredient_matches"]
    )


def test_recommendations_use_required_quantities_against_pantry(client):
    recipe_id, ingredient_names = _create_recipe_with_requirements([
        {"key": "protein", "quantity": 2, "unit": "ea"},
        {"key": "grain", "quantity": 1, "unit": "ea"},
    ])

    client.post("/pantry/add", json={"name": ingredient_names["protein"], "amount": 1, "unit": "ea"})
    client.post("/pantry/add", json={"name": ingredient_names["grain"], "amount": 1, "unit": "ea"})

    response = client.get(
        "/recommendations",
        params=[
            ("pantry", ingredient_names["protein"]),
            ("pantry", ingredient_names["grain"]),
        ],
    )
    assert response.status_code == 200
    data = _unwrap(response)

    all_rows = data["cook_now"] + data["almost_there"] + data["not_worth_it"]
    matching = [row for row in all_rows if row["recipe"]["recipe_id"] == recipe_id]
    if matching:
        recipe = matching[0]["recipe"]
        assert recipe["required_count"] >= 1
        assert recipe["present_required_count"] <= recipe["required_count"]


def test_cook_uses_required_quantities_and_deducts_actual_amount(client):
    recipe_id, ingredient_names = _create_recipe_with_requirements([
        {"key": "egg", "quantity": 2, "unit": "ea"},
    ])

    client.post("/pantry/add", json={"name": ingredient_names["egg"], "amount": 3, "unit": "ea"})

    response = client.post(f"/cook/{recipe_id}")
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["recipe_id"] == recipe_id
    assert data["deductions"] == [
        {
            "ingredient": ingredient_names["egg"],
            "quantity": 2.0,
            "unit": "ea",
        }
    ]

    pantry_response = client.get("/pantry")
    pantry_data = _unwrap(pantry_response)
    items = {item["ingredient"]: item for item in pantry_data.get("items", [])}
    assert items[ingredient_names["egg"]]["quantity"] == 1.0


def test_cook_blocks_when_quantity_is_insufficient(client):
    recipe_id, ingredient_names = _create_recipe_with_requirements([
        {"key": "milk", "quantity": 2, "unit": "cup"},
    ])

    client.post("/pantry/add", json={"name": ingredient_names["milk"], "amount": 1, "unit": "cup"})

    response = client.post(f"/cook/{recipe_id}")
    assert response.status_code == 409
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "INSUFFICIENT_PANTRY"
    assert ingredient_names["milk"] in data["error"]["message"]

