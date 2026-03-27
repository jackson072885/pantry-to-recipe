from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.db import get_db
from app.services.density_service import compute_density

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/density")
def density(db: Session = Depends(get_db)):
    return route_response(
        lambda: compute_density(db),
        db=db,
        default_error="Density report failed",
    )
