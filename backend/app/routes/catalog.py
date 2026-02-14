from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Ingredient, IngredientAlias
from app.cook_service import normalize_item

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/ingredients/search")
def search_ingredients(q: str, limit: int = 20, db: Session = Depends(get_db)):
    qn = normalize_item(q)
    if not qn:
        return {"results": []}

    # canonical OR alias match
    rows = db.execute(
        select(Ingredient)
        .outerjoin(IngredientAlias, IngredientAlias.ingredient_id == Ingredient.id)
        .where(
            or_(
                Ingredient.canonical_name.ilike(f"%{qn}%"),
                IngredientAlias.normalized_alias.ilike(f"%{qn}%"),
            )
        )
        .limit(limit)
    ).scalars().all()

    # de-dupe by id
    seen = set()
    out = []
    for r in rows:
        if r.id in seen:
            continue
        seen.add(r.id)
        out.append({"id": r.id, "name": r.canonical_name, "category": r.category})

    return {"results": out}
