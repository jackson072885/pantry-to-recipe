from __future__ import annotations

from fastapi import APIRouter

from app.api.responses import success_response

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return success_response({"status": "ok"})
