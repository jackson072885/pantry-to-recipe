from fastapi import APIRouter
from app.routes.pantry import router as pantry_router
from app.routes.match import router as match_router
from app.routes.density import router as density_router
from app.routes.recipe import router as recipe_router
from app.routes.cook import router as cook_router
from app.routes.insights import router as insights_router
from app.routes.plan import router as plan_router
from app.routes.unlock import router as unlock_router
from app.routes.onboarding import router as onboarding_router
from app.routes.ai_recipe import router as ai_recipe_router
from app.routes.supply import router as supply_router
from app.routes.health import router as health_router
from app.routes.recommendations import router as recommendations_router
from app.routes.events import router as events_router

api_router = APIRouter()
api_router.include_router(pantry_router)
api_router.include_router(match_router)
api_router.include_router(density_router)
api_router.include_router(recipe_router)
api_router.include_router(cook_router)
api_router.include_router(insights_router)
api_router.include_router(plan_router)
api_router.include_router(unlock_router)
api_router.include_router(onboarding_router)
api_router.include_router(ai_recipe_router)
api_router.include_router(supply_router)
api_router.include_router(health_router)
api_router.include_router(recommendations_router)
api_router.include_router(events_router)
