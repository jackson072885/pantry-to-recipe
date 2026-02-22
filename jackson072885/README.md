# Pantry-to-Recipe

A FastAPI backend that matches pantry ingredients to cookable recipes.

## Features
- Ingredient normalization
- Canonical + alias matching
- Confidence scoring
- Cookable / Almost / Missing grouping
- Deterministic match endpoint

## Tech Stack
- FastAPI
- SQLAlchemy ORM
- Alembic
- Python 3.12
- PowerShell 7

## Run Locally

Activate venv:

.venv\Scripts\Activate.ps1

Start server:

python -m uvicorn app.main:app --reload

## Endpoint

POST /match
