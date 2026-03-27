from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.db import get_db
from app.schemas.provider import ScarcitySimulateRequest
from app.schemas.sequence import SequenceRequest
from app.services.provider_plan_service import get_archetypes, simulate_scarcity
from app.services.provider_sequence_service import build_meal_sequence

router = APIRouter(prefix="/plan", tags=["plan"])


@router.post("/scarcity/simulate")
def scarcity_simulate(request: ScarcitySimulateRequest, db: Session = Depends(get_db)):
    return route_response(
        lambda: simulate_scarcity(db, request),
        db=db,
        default_error="Scarcity simulation failed",
    )


@router.get("/archetypes")
def archetypes():
    return route_response(
        lambda: {"archetypes": get_archetypes()},
        default_error="Archetype list failed",
    )


@router.post("/sequence")
def sequence_plan(request: SequenceRequest, db: Session = Depends(get_db)):
    return route_response(
        lambda: build_meal_sequence(db, request),
        db=db,
        default_error="Sequence planning failed",
    )
