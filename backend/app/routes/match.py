from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.match import MatchRequest, MatchResponse, MatchV2Request, MatchV2Response
from app.services.match_service import match_recipes
from app.services.match_v2_service import build_v2_response

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


@router.post("/v2", response_model=MatchV2Response)
def match_v2(request: MatchV2Request, db: Session = Depends(get_db)) -> MatchV2Response:
    try:
        base_response = match_recipes(db, request.ingredients)
        return build_v2_response(base_response)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Match v2 failed")
