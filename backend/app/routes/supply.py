from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.supply import SupplyPlanRequest, SupplyPlanResponse
from app.services.supply_plan_service import build_supply_plan

router = APIRouter(prefix="/supply", tags=["supply"])


@router.post("/plan", response_model=SupplyPlanResponse)
def supply_plan(request: SupplyPlanRequest) -> SupplyPlanResponse:
    try:
        return SupplyPlanResponse(**build_supply_plan(request))
    except Exception:
        raise HTTPException(status_code=500, detail="Supply plan failed")
