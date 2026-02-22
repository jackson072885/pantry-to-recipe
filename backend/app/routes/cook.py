from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/cook", tags=["cook"])

@router.get("/")
def cook_root():
    return {"ok": True, "message": "Cook router is live (stub)."}
