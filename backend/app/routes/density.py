from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.density_service import compute_density

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/density")
def density(db: Session = Depends(get_db)) -> dict:
    try:
        return compute_density(db)
    except Exception:
        raise HTTPException(status_code=500, detail="Density report failed")
