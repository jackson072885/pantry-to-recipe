from __future__ import annotations

from app.services.recommendation_service import _group_for_recipe


def test_zero_coverage_single_missing_recipe_is_not_almost_there():
    assert _group_for_recipe(0, 1, 0) == "not_worth_it"


def test_single_missing_recipe_with_real_coverage_stays_almost_there():
    assert _group_for_recipe(67, 1, 2) == "almost_there"
