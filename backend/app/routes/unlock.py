from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.db import get_db
from app.schemas.provider import UnlockMinimalRequest
from app.services.provider_unlock_service import evaluate_minimal_unlock

router = APIRouter(prefix="/unlock", tags=["unlock"])


@router.post("/minimal")
def unlock_minimal(request: UnlockMinimalRequest, db: Session = Depends(get_db)):
    return route_response(
        lambda: evaluate_minimal_unlock(db, request),
        db=db,
        default_error="Minimal unlock failed",
    )
