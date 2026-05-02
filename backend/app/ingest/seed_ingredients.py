from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal, init_db
from app.models import Ingredient, IngredientAlias
from app.models.ingredient_alias import normalize_alias_text

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "ingredient_catalog_v1.json"


def _normalize(s: str) -> str:
    return " ".join(str(s).strip().lower().split())


def _get_or_create_ingredient(db: Session, canonical_name: str, category: str | None = None) -> Ingredient:
    canonical = _normalize(canonical_name)
    existing = db.execute(
        select(Ingredient).where(Ingredient.canonical_name == canonical)
    ).scalar_one_or_none()
    if existing:
        if category and not existing.category:
            existing.category = category
        return existing

    ing = Ingredient(canonical_name=canonical, category=category)
    db.add(ing)
    db.flush()  # ensures ing.id is assigned NOW
    return ing


def _ensure_alias(db: Session, ingredient_id: int, alias: str) -> bool:
    norm = normalize_alias_text(alias)
    if not norm:
        return False

    existing_aliases = db.execute(
        select(IngredientAlias).where(IngredientAlias.normalized_alias == norm)
    ).scalars().all()
    if existing_aliases:
        return any(existing.ingredient_id == ingredient_id for existing in existing_aliases)

    db.add(
        IngredientAlias(
            ingredient_id=ingredient_id,
            alias=_normalize(alias),
            normalized_alias=norm,
        )
    )
    return True


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

        catalog_payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        if isinstance(catalog_payload, dict):
            catalog: List[Dict[str, Any]] = list(catalog_payload.get("items") or [])
        else:
            catalog = catalog_payload

        processed = 0

        for row in catalog:
            canonical = row.get("canonical_name") or row.get("canonicalName") or row.get("name") or row.get("canonical") or ""
            canonical = str(canonical).strip()
            if not canonical:
                continue

            category = str(row.get("family") or "").strip() or None
            ing = _get_or_create_ingredient(db, canonical, category)

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
