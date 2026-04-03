from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.responses import BAD_REQUEST, route_response, error_response
from app.db import get_db
from app.services import pantry_service

router = APIRouter(prefix="/pantry", tags=["pantry"])


def _parse_payload(payload: dict) -> tuple[str, float, str | None]:
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object")

    name = str(payload.get("name", "")).strip()
    if not name:
        raise ValueError("Name is required")

    amount_raw = payload.get("amount")
    try:
        amount = float(amount_raw)
    except (TypeError, ValueError) as exc:
        raise ValueError("Amount must be a number") from exc

    if amount < 1:
        raise ValueError("Amount must be at least 1")

    unit = payload.get("unit")
    return name, amount, unit


@router.get("")
def list_pantry(db: Session = Depends(get_db)):
    return route_response(
        lambda: {"items": pantry_service.list_pantry(db)},
        db=db,
        default_error="Pantry list failed",
    )


@router.post("/add")
async def add_item(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        return error_response(BAD_REQUEST, "Invalid JSON payload", 400)

    return route_response(
        lambda: _add_and_list(db, payload),
        db=db,
        default_error="Pantry add failed",
    )


@router.post("/remove")
async def remove_item(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        return error_response(BAD_REQUEST, "Invalid JSON payload", 400)

    return route_response(
        lambda: _remove_and_list(db, payload),
        db=db,
        default_error="Pantry remove failed",
    )


@router.post("/clear")
def clear_pantry(db: Session = Depends(get_db)):
    return route_response(
        lambda: {"cleared_count": pantry_service.clear_pantry(db)},
        db=db,
        default_error="Pantry clear failed",
    )


def _add_and_list(db: Session, payload: dict) -> dict:
    name, amount, unit = _parse_payload(payload)
    pantry_service.add_item(db, name, amount, unit)
    return {"items": pantry_service.list_pantry(db)}


def _remove_and_list(db: Session, payload: dict) -> dict:
    name, amount, unit = _parse_payload(payload)
    pantry_service.remove_item(db, name, amount, unit)
    return {"items": pantry_service.list_pantry(db)}
