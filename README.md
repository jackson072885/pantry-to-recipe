# Pantry-to-Recipe

Inventory-aware cooking app with a FastAPI backend and a Vite/React frontend.

Core ideas:
- Track pantry inventory
- Filter recipes by cuisine, ingredients, and attributes
- Only show recipes that are cookable (or almost cookable)
- Cooking a recipe automatically deducts ingredients

## Current Status (MVP)
- Backend API with `/match`, `/pantry`, and `/search` routes
- Basic seed data for ingredients and recipes
- Frontend with Pantry, Search, and Match testing UI

## Run Backend
```ps1
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.ingest.seed_db
.\run-backend.ps1
```

## Run Frontend
```ps1
cd frontend
npm install
npm run dev
```
