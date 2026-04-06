from fastapi import APIRouter
from app.routes.pantry import router as pantry_router
from app.routes.recipe import router as recipe_router
from app.routes.cook import router as cook_router
from app.routes.health import router as health_router
from app.routes.recommendations import router as recommendations_router
from app.routes.events import router as events_router

api_router = APIRouter()
api_router.include_router(pantry_router)
api_router.include_router(recipe_router)
api_router.include_router(cook_router)
api_router.include_router(health_router)
api_router.include_router(recommendations_router)
api_router.include_router(events_router)

# Support both bare backend routes and `/api/*` paths.
# Vite rewrites `/api` in local dev, but non-dev environments may hit FastAPI
# directly with the prefixed path from the frontend client.
api_router.include_router(pantry_router, prefix="/api")
api_router.include_router(recipe_router, prefix="/api")
api_router.include_router(cook_router, prefix="/api")
api_router.include_router(health_router, prefix="/api")
api_router.include_router(recommendations_router, prefix="/api")
api_router.include_router(events_router, prefix="/api")

# Parked non-core surfaces remain on disk but are intentionally not imported or
# registered here:
# /match, /search/density, /insights, /plan, /unlock, /onboarding, /ai/recipe,
# /supply
# These routes remain in the repo for future evaluation, but they are intentionally
# excluded from the main API surface so the product stays focused on the pantry ->
# recommendation -> recipe -> cook loop.
