from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.ingest import seed_ingredients as seed_module
from app.ingest.seed_ingredients import seed_ingredients
from app.models import Ingredient, IngredientAlias
from app.models.base import Base
from app.models.ingredient_alias import normalize_alias_text


def _session(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'ingredients.db').as_posix()}")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    return session, engine


def test_seed_ingredients_reads_catalog_creates_rows_and_aliases(tmp_path) -> None:
    db, engine = _session(tmp_path)
    try:
        processed = seed_ingredients(db)

        assert processed >= 300
        assert db.query(Ingredient).filter_by(canonical_name="ground beef").one().category == "proteins"

        alias = (
            db.query(IngredientAlias)
            .filter_by(normalized_alias=normalize_alias_text("hamburger meat"))
            .one()
        )
        assert alias.ingredient.canonical_name == "ground beef"

        assert (
            db.query(IngredientAlias)
            .filter_by(normalized_alias=normalize_alias_text("garbanzo beans"))
            .one()
            .ingredient.canonical_name
            == "chickpeas"
        )
        assert (
            db.query(IngredientAlias)
            .filter_by(normalized_alias=normalize_alias_text("plant_protein"))
            .count()
            == 0
        )
    finally:
        db.close()
        engine.dispose()


def test_seed_ingredients_is_idempotent(tmp_path) -> None:
    db, engine = _session(tmp_path)
    try:
        first_processed = seed_ingredients(db)
        first_ingredient_count = db.query(Ingredient).count()
        first_alias_count = db.query(IngredientAlias).count()

        second_processed = seed_ingredients(db)

        assert second_processed == first_processed
        assert db.query(Ingredient).count() == first_ingredient_count
        assert db.query(IngredientAlias).count() == first_alias_count
    finally:
        db.close()
        engine.dispose()


def test_seed_ingredients_skips_ambiguous_normalized_alias_collisions(tmp_path, monkeypatch) -> None:
    db, engine = _session(tmp_path)
    monkeypatch.setattr(
        seed_module,
        "DATA_PATH",
        tmp_path / "collision_catalog.json",
    )
    seed_module.DATA_PATH.write_text(
        """
{
  "items": [
    {"canonicalName": "green onion", "family": "vegetables", "aliases": ["scallions"]},
    {"canonicalName": "shallot", "family": "vegetables", "aliases": ["scallions"]}
  ]
}
""".strip(),
        encoding="utf-8",
    )

    try:
        assert seed_ingredients(db) == 2

        aliases = (
            db.query(IngredientAlias)
            .filter_by(normalized_alias=normalize_alias_text("scallions"))
            .all()
        )
        assert len(aliases) == 1
        assert aliases[0].ingredient.canonical_name == "green onion"
    finally:
        db.close()
        engine.dispose()
