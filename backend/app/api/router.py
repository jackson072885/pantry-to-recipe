from fastapi import APIRouter
from app.routes.match import router as match_router
from app.routes.pantry import router as pantry_router

api_router = APIRouter()
api_router.include_router(match_router)
api_router.include_router(pantry_router)
