from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.responses import BAD_REQUEST, route_response, error_response
from app.db import get_db
from app.schemas.pantry import PantryImportPayload, PantryMutationPayload, PantryUseSoonPayload
from app.services import pantry_import_service, pantry_service

router = APIRouter(prefix="/pantry", tags=["pantry"])


def _parse_payload(payload: dict) -> tuple[str, float, str | None]:
    try:
        request = PantryMutationPayload.model_validate(payload)
    except ValidationError as exc:
        message = str(exc.errors()[0]["msg"])
        if message.startswith("Value error, "):
            message = message.removeprefix("Value error, ")
        raise ValueError(message) from exc

    return request.name, request.amount, request.unit


def _parse_use_soon_payload(payload: dict) -> tuple[str, bool]:
    try:
        request = PantryUseSoonPayload.model_validate(payload)
    except ValidationError as exc:
        message = str(exc.errors()[0]["msg"])
        if message.startswith("Value error, "):
            message = message.removeprefix("Value error, ")
        raise ValueError(message) from exc

    return request.name, request.use_soon


def _parse_import_payload(payload: dict) -> list[str]:
    try:
        request = PantryImportPayload.model_validate(payload)
    except ValidationError as exc:
        message = str(exc.errors()[0]["msg"])
        if message.startswith("Value error, "):
            message = message.removeprefix("Value error, ")
        raise ValueError(message) from exc

    return request.lines


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


@router.post("/import/preview")
async def preview_import(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        return error_response(BAD_REQUEST, "Invalid JSON payload", 400)

    return route_response(
        lambda: _preview_import(db, payload),
        db=db,
        default_error="Pantry import preview failed",
    )


@router.post("/import/commit")
async def commit_import(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        return error_response(BAD_REQUEST, "Invalid JSON payload", 400)

    return route_response(
        lambda: _commit_import(db, payload),
        db=db,
        default_error="Pantry import commit failed",
    )


@router.post("/use-soon")
async def set_use_soon(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        return error_response(BAD_REQUEST, "Invalid JSON payload", 400)

    return route_response(
        lambda: _set_use_soon_and_list(db, payload),
        db=db,
        default_error="Pantry update failed",
    )


def _add_and_list(db: Session, payload: dict) -> dict:
    name, amount, unit = _parse_payload(payload)
    pantry_service.add_item(db, name, amount, unit)
    return {"items": pantry_service.list_pantry(db)}


def _remove_and_list(db: Session, payload: dict) -> dict:
    name, amount, unit = _parse_payload(payload)
    pantry_service.remove_item(db, name, amount, unit)
    return {"items": pantry_service.list_pantry(db)}


def _set_use_soon_and_list(db: Session, payload: dict) -> dict:
    name, use_soon = _parse_use_soon_payload(payload)
    pantry_service.set_use_soon(db, name, use_soon)
    return {"items": pantry_service.list_pantry(db)}


def _preview_import(db: Session, payload: dict) -> dict:
    lines = _parse_import_payload(payload)
    preview = pantry_import_service.preview_lines(db, lines)
    return {
        "results": [row.to_schema() for row in preview.results],
        "summary": {
            "line_count": len(preview.results),
            "accepted_count": preview.accepted_count,
            "review_count": preview.review_count,
            "rejected_count": preview.rejected_count,
        },
    }


def _commit_import(db: Session, payload: dict) -> dict:
    lines = _parse_import_payload(payload)
    return pantry_import_service.commit_lines(db, lines)
