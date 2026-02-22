from fastapi import APIRouter
from app.routes.match import router as match_router

api_router = APIRouter()
api_router.include_router(match_router)