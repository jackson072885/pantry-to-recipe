from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.provider import UnlockMinimalRequest, UnlockMinimalResponse
from app.services.provider_unlock_service import evaluate_minimal_unlock

router = APIRouter(prefix="/unlock", tags=["unlock"])


@router.post("/minimal", response_model=UnlockMinimalResponse)
def unlock_minimal(
    request: UnlockMinimalRequest,
    db: Session = Depends(get_db),
) -> UnlockMinimalResponse:
    try:
        return UnlockMinimalResponse(**evaluate_minimal_unlock(db, request))
    except Exception:
        raise HTTPException(status_code=500, detail="Minimal unlock failed")
