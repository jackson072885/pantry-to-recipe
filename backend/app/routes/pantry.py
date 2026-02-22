from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/pantry", tags=["pantry"])

@router.get("/")
def pantry_root():
    return {"ok": True, "message": "Pantry router is live (stub)."}
