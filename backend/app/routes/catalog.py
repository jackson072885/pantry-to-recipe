from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from app.core.db_dep import get_db
from app.models import Ingredient

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/ingredients/search")
def ingredient_search(q: str = ""):
    q = (q or "").strip().lower()
    with get_db() as db:
        if not q:
            rows = db.execute(select(Ingredient).limit(50)).scalars().all()
        else:
            rows = db.execute(
                select(Ingredient).where(Ingredient.canonical_name.contains(q)).limit(50)
            ).scalars().all()
        return [{"id": r.id, "canonical_name": r.canonical_name, "category": r.category, "is_staple": r.is_staple} for r in rows]
