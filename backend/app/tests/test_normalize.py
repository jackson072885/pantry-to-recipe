from __future__ import annotations

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.services.normalize_service import normalize_item


def _ensure_ingredient(db, canonical_name: str) -> Ingredient:
    ingredient = db.query(Ingredient).filter(Ingredient.canonical_name == canonical_name).first()
    if ingredient is not None:
        return ingredient

    ingredient = Ingredient(canonical_name=canonical_name)
    db.add(ingredient)
    db.flush()
    return ingredient


def test_normalize_item_maps_common_household_aliases_to_shared_canonical_truth(client):
    with SessionLocal() as db:
        for canonical_name in ["green onion", "ground beef", "bell pepper", "chickpeas", "black bean"]:
            _ensure_ingredient(db, canonical_name)

        assert normalize_item("Scallions", db) == "green onion"
        assert normalize_item(" spring onion ", db) == "green onion"
        assert normalize_item("spring onions", db) == "green onion"
        assert normalize_item("hamburger meat", db) == "ground beef"
        assert normalize_item("beef mince", db) == "ground beef"
        assert normalize_item("ground chuck", db) == "ground beef"
        assert normalize_item("red bell pepper", db) == "bell pepper"
        assert normalize_item("garbanzo beans", db) == "chickpeas"
        assert normalize_item("black beans", db) == "black bean"


def test_normalize_item_matches_frontend_cleanup_for_safe_name_variants(client):
    with SessionLocal() as db:
        _ensure_ingredient(db, "onion")
        _ensure_ingredient(db, "chicken")

        assert normalize_item("Onion (yellow)", db) == "onion"
        assert normalize_item("2 lbs chicken", db) == "chicken"
        assert normalize_item("n/a", db) == ""


def test_normalize_item_keeps_distinct_ingredients_distinct_when_alias_is_not_safe(client):
    with SessionLocal() as db:
        _ensure_ingredient(db, "olive oil")
        _ensure_ingredient(db, "oil")
        _ensure_ingredient(db, "chicken")
        _ensure_ingredient(db, "chicken breast")

        assert normalize_item("olive oil", db) == "olive oil"
        assert normalize_item("oil", db) == "oil"
        assert normalize_item("chicken breast", db) == "chicken breast"
        assert normalize_item("chicken", db) == "chicken"
