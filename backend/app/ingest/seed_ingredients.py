from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal, init_db
from app.models import Ingredient, IngredientAlias

DATA_PATH = Path(__file__).resolve().parent / "data" / "ingredient_catalog_v1.json"


def _normalize(s: str) -> str:
    return " ".join(str(s).strip().lower().split())


def _get_or_create_ingredient(db: Session, canonical_name: str) -> Ingredient:
    canonical = _normalize(canonical_name)
    existing = db.execute(
        select(Ingredient).where(Ingredient.canonical_name == canonical)
    ).scalar_one_or_none()
    if existing:
        return existing

    ing = Ingredient(canonical_name=canonical)
    db.add(ing)
    db.flush()  # ensures ing.id is assigned NOW
    return ing


def _ensure_alias(db: Session, ingredient_id: int, alias: str) -> None:
    norm = _normalize(alias)
    if not norm:
        return

    existing = db.execute(
        select(IngredientAlias).where(IngredientAlias.normalized_alias == norm)
    ).scalar_one_or_none()
    if existing:
        return

    db.add(
        IngredientAlias(
            ingredient_id=ingredient_id,
            alias=alias,
            normalized_alias=norm,
        )
    )


def seed_ingredients(db: Optional[Session] = None) -> int:
    """
    Seed ingredients + aliases from ingredient_catalog_v1.json.

    Returns count of ingredients processed.
    """
    init_db()

    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    assert db is not None

    try:
        if not DATA_PATH.exists():
            raise FileNotFoundError(f"Ingredient catalog not found: {DATA_PATH}")

        catalog: List[Dict[str, Any]] = json.loads(DATA_PATH.read_text(encoding="utf-8"))

        processed = 0

        for row in catalog:
            canonical = row.get("canonical_name") or row.get("name") or row.get("canonical") or ""
            canonical = str(canonical).strip()
            if not canonical:
                continue

            ing = _get_or_create_ingredient(db, canonical)

            # self-alias (helps matching)
            _ensure_alias(db, ing.id, canonical)

            aliases = row.get("aliases") or []
            if isinstance(aliases, str):
                aliases = [aliases]

            for a in aliases:
                a = str(a).strip()
                if a:
                    _ensure_alias(db, ing.id, a)

            processed += 1

        db.commit()
        return processed

    finally:
        if owns_session:
            db.close()
