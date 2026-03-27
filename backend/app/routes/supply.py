from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.db import get_db
from app.schemas.supply import SupplyPlanRequest
from app.schemas.supply_simulate import SupplySimulateRequest
from app.services.supply_plan_service import build_supply_plan, build_supply_simulation

router = APIRouter(prefix="/supply", tags=["supply"])


@router.post("/plan")
def supply_plan(request: SupplyPlanRequest):
    return route_response(
        lambda: build_supply_plan(request),
        default_error="Supply plan failed",
    )


@router.post("/simulate")
def supply_simulate(request: SupplySimulateRequest, db: Session = Depends(get_db)):
    return route_response(
        lambda: build_supply_simulation(db, request),
        db=db,
        default_error="Supply simulation failed",
    )
