from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from app.core.db_dep import get_db
from app.models import Recipe

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("/")
def list_recipes(limit: int = 50):
    with get_db() as db:
        rows = db.execute(select(Recipe).limit(limit)).scalars().all()
        return [{"id": r.id, "name": r.name} for r in rows]
