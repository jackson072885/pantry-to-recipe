from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.provider import ArchetypesResponse, PlanArchetypeOut, ScarcitySimulateRequest, ScarcitySimulateResponse
from app.services.provider_plan_service import get_archetypes, simulate_scarcity

router = APIRouter(prefix="/plan", tags=["plan"])


@router.post("/scarcity/simulate", response_model=ScarcitySimulateResponse)
def scarcity_simulate(
    request: ScarcitySimulateRequest,
    db: Session = Depends(get_db),
) -> ScarcitySimulateResponse:
    try:
        return ScarcitySimulateResponse(**simulate_scarcity(db, request))
    except Exception:
        raise HTTPException(status_code=500, detail="Scarcity simulation failed")


@router.get("/archetypes", response_model=ArchetypesResponse)
def archetypes() -> ArchetypesResponse:
    try:
        items = [PlanArchetypeOut(**item) for item in get_archetypes()]
        return ArchetypesResponse(archetypes=items)
    except Exception:
        raise HTTPException(status_code=500, detail="Archetype list failed")
