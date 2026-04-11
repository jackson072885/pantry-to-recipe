from __future__ import annotations

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias
from app.services.pantry_import_service import preview_lines


def _ensure_ingredient(db, canonical_name: str, aliases: list[str] | None = None) -> None:
    ingredient = db.query(Ingredient).filter(Ingredient.canonical_name == canonical_name).first()
    if ingredient is None:
        ingredient = Ingredient(canonical_name=canonical_name)
        db.add(ingredient)
        db.flush()

    for alias_name in aliases or []:
        alias = (
            db.query(IngredientAlias)
            .filter(
                IngredientAlias.ingredient_id == ingredient.id,
                IngredientAlias.alias == alias_name,
            )
            .first()
        )
        if alias is None:
            db.add(IngredientAlias(ingredient_id=ingredient.id, alias=alias_name))

    db.commit()


def test_preview_accepts_safe_quantity_unit_and_ingredient_lines(client):
    with SessionLocal() as db:
        _ensure_ingredient(db, "chicken")
        _ensure_ingredient(db, "rice")
        _ensure_ingredient(db, "onion")
        _ensure_ingredient(db, "black bean", aliases=["black beans"])

        preview = preview_lines(
            db,
            ["1 lb chicken", "2 cups rice", "1/2 onion", "black beans"],
        )

    assert [row.status for row in preview.results] == ["accepted", "accepted", "accepted", "accepted"]
    assert preview.results[0].parsed_quantity == 1.0
    assert preview.results[0].parsed_unit == "lb"
    assert preview.results[0].canonical_unit == "g"
    assert preview.results[0].canonical_ingredient == "chicken"
    assert preview.results[1].canonical_ingredient == "rice"
    assert preview.results[2].parsed_quantity == 0.5
    assert preview.results[2].parsed_unit is None
    assert preview.results[3].parsed_quantity is None
    assert preview.results[3].parsed_unit is None
    assert preview.results[3].canonical_ingredient == "black bean"


def test_preview_rejects_or_reviews_unsafe_lines(client):
    with SessionLocal() as db:
        _ensure_ingredient(db, "rice")

        preview = preview_lines(
            db,
            [
                "some cheese",
                "two cups rice",
                "1-2 onions",
                "1 bag rice",
                "rice, beans, chicken",
                "buy eggs",
                "mystery ingredient",
            ],
        )

    assert [row.status for row in preview.results] == [
        "rejected",
        "rejected",
        "rejected",
        "rejected",
        "rejected",
        "rejected",
        "review",
    ]
    assert preview.results[-1].reason_code == "ingredient_not_found"


def test_preview_uses_alias_resolution_only_when_it_maps_to_one_safe_ingredient(client):
    with SessionLocal() as db:
        _ensure_ingredient(db, "green onion", aliases=["scallions"])

        preview = preview_lines(db, ["1 scallions"])

    result = preview.results[0]
    assert result.status == "accepted"
    assert result.canonical_ingredient == "green onion"


def test_preview_rejects_unit_conflicts_against_existing_pantry_state(client):
    client.post("/pantry/clear")
    client.post("/pantry/add", json={"name": "rice", "amount": 1, "unit": "cup"})

    with SessionLocal() as db:
        preview = preview_lines(db, ["rice"])

    result = preview.results[0]
    assert result.status == "rejected"
    assert result.reason_code == "unit_conflict"
