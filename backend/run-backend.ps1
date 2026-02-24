# Run the backend from THIS folder (no hardcoded paths).
# Usage:
#   1) python -m venv .venv
#   2) .\.venv\Scripts\Activate.ps1
#   3) pip install -r requirements.txt
#   4) python -m app.ingest.seed_db   (one time)
#   5) .\run-backend.ps1

$ErrorActionPreference = "Stop"

# Ensure we're in the backend folder
Set-Location $PSScriptRoot

Write-Host "Starting backend server (FastAPI)..." -ForegroundColor Cyan
python -m uvicorn app.main:app --reload
