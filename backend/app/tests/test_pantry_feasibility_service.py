from __future__ import annotations

from app.schemas.external_recipe import ExternalRecipeCandidate
from app.services.pantry_feasibility_service import score_candidate_feasibility, score_candidates_feasibility


def _candidate(title: str, used: list[str], missed: list[str], source_id: str = "1") -> ExternalRecipeCandidate:
    return ExternalRecipeCandidate(
        source="test",
        source_id=source_id,
        title=title,
        ingredients=[*used, *missed],
        used_ingredients=used,
        missed_ingredients=missed,
        instructions=["Cook it."],
    )


def test_minor_garnish_miss_can_still_be_cookable_tonight():
    candidate = score_candidate_feasibility(
        _candidate("Chicken Rice Bowl", ["chicken", "rice"], ["parsley"]),
        ["chicken", "rice"],
    )

    assert candidate.feasibility_bucket == "cookable_tonight"
    assert candidate.minor_missing_ingredients == ["parsley"]
    assert candidate.critical_missing_ingredients == []
    assert candidate.feasibility_reasons


def test_title_and_dish_family_main_misses_are_not_cookable():
    chicken_rice = score_candidate_feasibility(
        _candidate("Chicken Fried Rice", ["rice"], ["chicken"]),
        ["rice"],
    )
    churrasco = score_candidate_feasibility(
        _candidate("Churrasco with Chimichurri", ["parsley"], ["skirt steak"]),
        ["parsley"],
    )

    assert chicken_rice.feasibility_bucket == "rejected"
    assert chicken_rice.critical_missing_ingredients == ["chicken"]
    assert churrasco.feasibility_bucket == "rejected"
    assert churrasco.critical_missing_ingredients == ["skirt steak"]


def test_fried_rice_missing_rice_is_not_cookable_tonight():
    candidate = score_candidate_feasibility(
        _candidate("Vegetable Fried Rice", ["egg"], ["rice"]),
        ["egg"],
    )

    assert candidate.feasibility_bucket == "rejected"
    assert candidate.critical_missing_ingredients == ["rice"]


def test_moderate_misses_are_almost_there_unless_title_dependent():
    soy_sauce = score_candidate_feasibility(
        _candidate("Chicken Stir Fry", ["chicken"], ["soy sauce"]),
        ["chicken"],
    )
    broth = score_candidate_feasibility(
        _candidate("Chicken Noodle Dinner", ["chicken", "noodles"], ["broth"]),
        ["chicken", "noodles"],
    )
    cream_title = score_candidate_feasibility(
        _candidate("Cream Sauce Pasta", ["pasta"], ["cream"]),
        ["pasta"],
    )

    assert soy_sauce.feasibility_bucket == "almost_there"
    assert soy_sauce.moderate_missing_ingredients == ["soy sauce"]
    assert broth.feasibility_bucket == "almost_there"
    assert broth.moderate_missing_ingredients == ["broth"]
    assert cream_title.feasibility_bucket == "rejected"
    assert cream_title.critical_missing_ingredients == ["cream"]


def test_ranking_prefers_minor_misses_over_moderate_and_fatal_misses():
    candidates = score_candidates_feasibility(
        [
            _candidate("Chicken Rice Bowl", ["chicken", "rice"], ["parsley"], "minor"),
            _candidate("Chicken Rice Bowl", ["chicken", "rice"], ["soy sauce"], "moderate"),
            _candidate("Chicken Fried Rice", ["rice"], ["chicken"], "fatal"),
        ],
        ["chicken", "rice"],
    )
    by_id = {candidate.source_id: candidate for candidate in candidates}

    assert by_id["minor"].score > by_id["moderate"].score > by_id["fatal"].score
    assert by_id["minor"].feasibility_bucket == "cookable_tonight"
    assert by_id["moderate"].feasibility_bucket == "almost_there"
    assert by_id["fatal"].feasibility_bucket == "rejected"


def test_explanation_metadata_is_available_in_fields_and_raw_score_fields():
    candidate = score_candidate_feasibility(
        _candidate("Chicken Stir Fry", ["chicken"], ["soy sauce", "sesame seeds"]),
        ["chicken"],
    )

    assert candidate.moderate_missing_ingredients == ["soy sauce"]
    assert candidate.minor_missing_ingredients == ["sesame seeds"]
    assert candidate.feasibility_reasons
    assert candidate.raw_score_fields["scoring_version"] == "pantry_feasibility_v2"
    assert candidate.raw_score_fields["moderate_missing_ingredients"] == ["soy sauce"]
    assert candidate.raw_score_fields["minor_missing_ingredients"] == ["sesame seeds"]
