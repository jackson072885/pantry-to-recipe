Backend for Pantry-to-Recipe.

## What This Backend Serves
- Pantry inventory APIs
- Recommendation generation
- Recipe detail retrieval
- Cook action inventory deduction
- Event tracking for behavior-aware ranking
- Secondary provider-oriented routes kept outside the primary product flow

## Setup
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run
```powershell
.\run-backend.ps1
```

## Test
```powershell
python -m pytest -q app/tests
```

## Database Notes
- The default database path is user-writable.
- The app ensures schema on startup.
- Seed logic runs on startup when available.
