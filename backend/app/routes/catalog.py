from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Ingredient

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/ingredients/search")
def ingredient_search(q: str = "", db: Session = Depends(get_db)):
    q = (q or "").strip().lower()
    if not q:
        rows = db.execute(select(Ingredient).limit(50)).scalars().all()
    else:
        rows = db.execute(
            select(Ingredient).where(Ingredient.canonical_name.contains(q)).limit(50)
        ).scalars().all()
    return [{"id": r.id, "canonical_name": r.canonical_name, "category": r.category, "is_staple": r.is_staple} for r in rows]
