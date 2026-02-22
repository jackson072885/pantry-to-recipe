from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.pantry import PantryItemPayload, PantryListResponse, PantryMutationResponse
from app.services import pantry_service

router = APIRouter(prefix="/pantry", tags=["pantry"])


@router.get("", response_model=PantryListResponse)
def list_pantry(db: Session = Depends(get_db)) -> PantryListResponse:
    items = pantry_service.list_pantry(db)
    return PantryListResponse(items=items)


@router.post("/add", response_model=PantryMutationResponse)
def add_item(request: PantryItemPayload, db: Session = Depends(get_db)) -> PantryMutationResponse:
    try:
        result = pantry_service.add_item(db, request.name, request.amount)
        return PantryMutationResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/remove", response_model=PantryMutationResponse)
def remove_item(request: PantryItemPayload, db: Session = Depends(get_db)) -> PantryMutationResponse:
    try:
        result = pantry_service.remove_item(db, request.name, request.amount)
        return PantryMutationResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
