from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.cook import CookResponse
from app.services.cook_service import cook_recipe

router = APIRouter(prefix="/cook", tags=["cook"])

@router.post("/{recipe_id}", response_model=CookResponse)
def cook(recipe_id: int, db: Session = Depends(get_db)) -> CookResponse:
    try:
        data = cook_recipe(db, recipe_id)
        return CookResponse(**data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Cook failed")
