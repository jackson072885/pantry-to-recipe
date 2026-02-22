from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.pantry import PantryListResponse
from app.services import pantry_service

router = APIRouter(prefix="/pantry", tags=["pantry"])


def _error(message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message})


def _parse_payload(payload: dict) -> tuple[str, int] | JSONResponse:
    if not isinstance(payload, dict):
        return _error("Payload must be a JSON object", 400)

    name = str(payload.get("name", "")).strip()
    if not name:
        return _error("Name is required", 400)

    amount_raw = payload.get("amount", None)
    try:
        amount = int(amount_raw)
    except (TypeError, ValueError):
        return _error("Amount must be an integer", 400)

    if amount < 1:
        return _error("Amount must be at least 1", 400)

    return name, amount


@router.get("", response_model=PantryListResponse)
def list_pantry(db: Session = Depends(get_db)) -> PantryListResponse:
    try:
        items = pantry_service.list_pantry(db)
        return PantryListResponse(items=items)
    except Exception:
        return _error("Pantry list failed", 500)


@router.post("/add", response_model=PantryListResponse)
async def add_item(request: Request, db: Session = Depends(get_db)) -> PantryListResponse:
    try:
        payload = await request.json()
    except Exception:
        return _error("Invalid JSON payload", 400)

    parsed = _parse_payload(payload)
    if isinstance(parsed, JSONResponse):
        return parsed

    name, amount = parsed

    try:
        pantry_service.add_item(db, name, amount)
        items = pantry_service.list_pantry(db)
        return PantryListResponse(items=items)
    except ValueError as e:
        db.rollback()
        return _error(str(e), 400)
    except Exception:
        db.rollback()
        return _error("Pantry add failed", 500)


@router.post("/remove", response_model=PantryListResponse)
async def remove_item(request: Request, db: Session = Depends(get_db)) -> PantryListResponse:
    try:
        payload = await request.json()
    except Exception:
        return _error("Invalid JSON payload", 400)

    parsed = _parse_payload(payload)
    if isinstance(parsed, JSONResponse):
        return parsed

    name, amount = parsed

    try:
        pantry_service.remove_item(db, name, amount)
        items = pantry_service.list_pantry(db)
        return PantryListResponse(items=items)
    except ValueError as e:
        db.rollback()
        return _error(str(e), 400)
    except Exception:
        db.rollback()
        return _error("Pantry remove failed", 500)
