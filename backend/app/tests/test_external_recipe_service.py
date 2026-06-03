from __future__ import annotations

from app.core.config import settings
from app.services import external_recipe_service as service


def _provider_payload():
    return [
        {
            "id": 101,
            "title": "Chicken Rice Skillet",
            "image": "https://example.test/chicken.jpg",
            "sourceUrl": "https://example.test/chicken-rice",
            "usedIngredients": [{"name": "chicken"}, {"originalName": "rice"}],
            "missedIngredients": [],
            "unusedIngredients": [{"original": "onion"}],
            "likes": 12,
            "readyInMinutes": 35,
            "servings": 4,
        },
        {
            "id": 202,
            "title": "Chicken Pepper Pasta",
            "usedIngredients": [{"name": "chicken"}],
            "missedIngredients": [{"name": "pasta"}, {"name": "pepper"}],
            "unusedIngredients": [],
            "readyInMinutes": 50,
        },
    ]


def _display_contract_payload():
    return [
        {
            "id": 303,
            "title": "  Garlic Chicken  ",
            "sourceUrl": "https://example.test/garlic-chicken",
            "usedIngredients": [
                {"name": "bulbs garlic"},
                {"name": "chicken weighing 2.3kg"},
                {"name": "salt and pepper"},
            ],
            "missedIngredients": [{"name": "soy sauce"}],
            "unusedIngredients": [{"name": "optional herbs"}],
            "instructions": ["Cook it."],
        }
    ]


def test_disabled_provider_returns_empty_result_without_provider_call(monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "disabled")

    def fail_fetch(_ingredients, _limit):
        raise AssertionError("provider should not be called")

    monkeypatch.setattr(service, "_fetch_spoonacular_candidates", fail_fetch)

    result = service.search_external_recipes_by_ingredients(["chicken"], limit=10)

    assert result.provider == "disabled"
    assert result.provider_status == "disabled"
    assert result.best is None
    assert result.candidates == []
    assert result.alternatives == []
    assert result.filter_counts is None


def test_missing_api_key_returns_empty_result_without_crash(monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "spoonacular")
    monkeypatch.setattr(settings, "spoonacular_api_key", "")

    def fail_fetch(_ingredients, _limit):
        raise AssertionError("provider should not be called")

    monkeypatch.setattr(service, "_fetch_spoonacular_candidates", fail_fetch)

    result = service.search_external_recipes_by_ingredients(["chicken"], limit=10)

    assert result.provider == "spoonacular"
    assert result.provider_status == "missing_api_key"
    assert result.best is None
    assert result.candidates == []
    assert result.alternatives == []
    assert result.filter_counts is None


def test_spoonacular_normalization_maps_provider_fields_without_raw_payload(monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "spoonacular")
    monkeypatch.setattr(settings, "spoonacular_api_key", "test-key")
    monkeypatch.setattr(service, "_fetch_spoonacular_candidates", lambda _ingredients, _limit: _provider_payload())

    result = service.search_external_recipes_by_ingredients([" chicken ", "rice", "chicken"], limit=10)

    candidate = result.best
    assert candidate is not None
    assert candidate.source == "spoonacular"
    assert candidate.source_id == "101"
    assert candidate.title == "Chicken Rice Skillet"
    assert candidate.image_url == "https://example.test/chicken.jpg"
    assert candidate.source_url == "https://example.test/chicken-rice"
    assert candidate.used_ingredients == ["chicken", "rice"]
    assert candidate.missed_ingredients == []
    assert candidate.unused_ingredients == ["onion"]
    assert candidate.ingredients == ["chicken", "rice", "onion"]
    assert candidate.ready_minutes == 35
    assert candidate.servings == 4
    assert candidate.instructions == []
    assert candidate.raw_score_fields["has_instructions"] is False
    assert candidate.raw_score_fields["provider_used_count"] == 2
    assert candidate.raw_score_fields["provider_missed_count"] == 0
    assert candidate.raw_score_fields["provider_unused_count"] == 1
    assert candidate.raw_score_fields["provider_likes"] == 12
    assert candidate.raw_score_fields["scoring_version"] == "pantry_feasibility_v2"
    assert "usedIngredients" not in candidate.raw_score_fields


def test_spoonacular_normalization_adds_display_contract_without_changing_raw_fields(monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "spoonacular")
    monkeypatch.setattr(settings, "spoonacular_api_key", "test-key")
    monkeypatch.setattr(service, "_fetch_spoonacular_candidates", lambda _ingredients, _limit: _display_contract_payload())

    result = service.search_external_recipes_by_ingredients(["garlic", "chicken"], limit=10)

    candidate = result.best
    assert candidate is not None
    assert candidate.title == "Garlic Chicken"
    assert candidate.display_title == "Garlic Chicken"
    assert candidate.used_ingredients == ["bulbs garlic", "chicken weighing 2.3kg", "salt and pepper"]
    assert candidate.missed_ingredients == ["soy sauce"]
    assert candidate.unused_ingredients == ["optional herbs"]
    assert candidate.ingredients == [
        "bulbs garlic",
        "chicken weighing 2.3kg",
        "salt and pepper",
        "soy sauce",
        "optional herbs",
    ]
    assert candidate.display_used_ingredients == ["Garlic", "Chicken", "Salt and pepper"]
    assert candidate.display_missed_ingredients == ["Soy sauce"]
    assert candidate.display_ingredients == [
        "Garlic",
        "Chicken",
        "Salt and pepper",
        "Soy sauce",
        "Optional herbs",
    ]
    assert candidate.source_provenance == {
        "source": "spoonacular",
        "source_id": "303",
        "source_url": "https://example.test/garlic-chicken",
    }
    assert candidate.normalization_notes == [
        "ingredients: 'bulbs garlic' displayed as 'Garlic'",
        "ingredients: 'chicken weighing 2.3kg' displayed as 'Chicken'",
        "ingredients: 'salt and pepper' displayed as 'Salt and pepper'",
        "ingredients: 'soy sauce' displayed as 'Soy sauce'",
        "ingredients: 'optional herbs' displayed as 'Optional herbs'",
        "used_ingredients: 'bulbs garlic' displayed as 'Garlic'",
        "used_ingredients: 'chicken weighing 2.3kg' displayed as 'Chicken'",
        "used_ingredients: 'salt and pepper' displayed as 'Salt and pepper'",
        "missed_ingredients: 'soy sauce' displayed as 'Soy sauce'",
    ]


def test_candidate_inspection_preserves_raw_detail_and_marks_review_readiness():
    candidate = service._with_display_contract(
        service.ExternalRecipeCandidate(
            source="spoonacular",
            source_id="303",
            source_url="https://example.test/garlic-chicken",
            title="Garlic Chicken",
            ingredients=["bulbs garlic", "chicken weighing 2.3kg", "soy sauce"],
            used_ingredients=["bulbs garlic", "chicken weighing 2.3kg"],
            missed_ingredients=["soy sauce"],
            instructions=["Cook it."],
            minor_missing_ingredients=["soy sauce"],
            score=88.0,
            feasibility_bucket="almost_there",
        )
    )

    inspection = service.inspect_external_recipe_candidate(candidate)

    assert inspection.display_title == "Garlic Chicken"
    assert inspection.source == "spoonacular"
    assert inspection.source_id == "303"
    assert inspection.inspection_status == "inspectable"
    assert inspection.import_readiness == "needs_review"
    assert inspection.instructions.has_instructions is True
    assert inspection.ingredients[0].raw == "bulbs garlic"
    assert inspection.ingredients[0].display == "Garlic"
    assert inspection.ingredients[0].group == "used"
    assert inspection.ingredients[2].raw == "soy sauce"
    assert inspection.ingredients[2].display == "Soy sauce"
    assert inspection.ingredients[2].group == "missed"
    assert inspection.ingredients[2].missing_severity == "minor"
    assert inspection.candidate.title == "Garlic Chicken"
    assert inspection.candidate.used_ingredients == ["bulbs garlic", "chicken weighing 2.3kg"]
    assert inspection.provenance["candidate_source"] == "spoonacular"
    assert inspection.provenance["feasibility_bucket"] == "almost_there"


def test_candidate_inspection_requires_review_when_instructions_are_missing():
    candidate = service._with_display_contract(
        service.ExternalRecipeCandidate(
            source="spoonacular",
            source_id="404",
            title="No Step Dinner",
            ingredients=["rice"],
            used_ingredients=["rice"],
            feasibility_bucket="cookable_tonight",
        )
    )

    inspection = service.inspect_external_recipe_candidate(candidate)

    assert inspection.inspection_status == "incomplete"
    assert inspection.import_readiness == "needs_review"
    assert inspection.instructions.has_instructions is False
    assert any("Instructions are unavailable" in warning for warning in inspection.warnings)


def test_scoring_ranking_and_buckets(monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "spoonacular")
    monkeypatch.setattr(settings, "spoonacular_api_key", "test-key")
    monkeypatch.setattr(
        service,
        "_fetch_spoonacular_candidates",
        lambda _ingredients, _limit: [
            {
                "id": 1,
                "title": "Complete Dinner",
                "usedIngredients": [{"name": "chicken"}, {"name": "rice"}, {"name": "onion"}],
                "missedIngredients": [],
                "instructions": ["Cook it."],
                "readyInMinutes": 30,
            },
            {
                "id": 2,
                "title": "Close Dinner",
                "usedIngredients": [{"name": "chicken"}],
                "missedIngredients": [{"name": "soy sauce"}],
                "instructions": ["Cook it."],
            },
            {
                "id": 3,
                "title": "Far Dinner",
                "usedIngredients": [{"name": "chicken"}],
                "missedIngredients": [{"name": "rice"}, {"name": "onion"}, {"name": "pepper"}],
            },
            {
                "id": 4,
                "title": "No Instructions Dinner",
                "usedIngredients": [{"name": "chicken"}, {"name": "rice"}],
                "missedIngredients": [],
            },
            {
                "id": "",
                "title": "",
                "usedIngredients": [{"name": "chicken"}],
                "missedIngredients": [],
            },
        ],
    )

    result = service.search_external_recipes_by_ingredients(["chicken", "rice"], {"max_time_minutes": 45})
    buckets = {candidate.source_id: candidate.feasibility_bucket for candidate in result.candidates}
    scores = {candidate.source_id: candidate.score for candidate in result.candidates}

    assert result.best is not None
    assert result.best.source_id == "1"
    assert buckets["1"] == "cookable_tonight"
    assert buckets["2"] == "almost_there"
    assert buckets["3"] == "inspiration"
    assert buckets[""] == "rejected"
    assert result.filter_counts is not None
    assert result.filter_counts["families"]["feasibility_bucket"] == [
        {"value": "cookable_tonight", "count": 2}
    ]
    assert scores["1"] > scores["2"] > scores["3"]
    assert scores["1"] > scores["4"]
    assert all(candidate.feasibility_bucket != "rejected" for candidate in [result.best, *result.alternatives])


def test_provider_error_returns_controlled_error_result(monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "spoonacular")
    monkeypatch.setattr(settings, "spoonacular_api_key", "test-key")

    def fail_fetch(_ingredients, _limit):
        raise ValueError("malformed provider payload")

    monkeypatch.setattr(service, "_fetch_spoonacular_candidates", fail_fetch)

    result = service.search_external_recipes_by_ingredients(["chicken"], limit=10)

    assert result.provider == "spoonacular"
    assert result.provider_status == "error"
    assert result.best is None
    assert result.alternatives == []
    assert result.candidates == []
    assert result.error_message == "External recipe provider failed"
