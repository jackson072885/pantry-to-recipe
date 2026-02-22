from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.match import MatchRequest, MatchResponse  # ✅ new response type
from app.services.match_service import match_recipes

router = APIRouter(prefix="/match", tags=["match"])


@router.post("/", response_model=MatchResponse)
def match(request: MatchRequest, db: Session = Depends(get_db)) -> MatchResponse:
    try:
        return match_recipes(db, request.pantry)
    except ValueError as e:
        # clean 4xx for expected input problems
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        # clean 500 boundary (no raw traceback to client)
        raise HTTPException(status_code=500, detail="Match failed")