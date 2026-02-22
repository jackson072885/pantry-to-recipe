from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.db import engine, Base  # ✅ single source of truth
from app.db_migrations import ensure_recipe_metadata_columns

# seed will be wired after we repair seed_service
try:
    from app.services.seed_service import run_seed
except Exception:
    run_seed = None


def create_app() -> FastAPI:
    app = FastAPI(title="Pantry-to-Recipe API", version="0.1")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    @app.on_event("startup")
    def startup_event():
        Base.metadata.create_all(bind=engine)
        ensure_recipe_metadata_columns(engine)

        if run_seed:
            try:
                run_seed()
                print("Seed completed")
            except Exception as e:
                print("Seed skipped:", e)

    @app.get("/")
    def root():
        return {"status": "running"}

    return app


app = create_app()
