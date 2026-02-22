from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List

from sqlalchemy.orm import Session

from app.db import get_db
from app.services.pantry_service import add_item, remove_item, list_pantry

router = APIRouter()


class PantryChange(BaseModel):
    name: str
    amount: int = 1


@router.get("/pantry", response_model=List[dict])
def get_pantry(db: Session = Depends(get_db)):
    return list_pantry(db)


@router.post("/pantry/add")
def pantry_add(payload: PantryChange, db: Session = Depends(get_db)):
    return add_item(db, payload.name, payload.amount)


@router.post("/pantry/remove")
def pantry_remove(payload: PantryChange, db: Session = Depends(get_db)):
    return remove_item(db, payload.name, payload.amount)