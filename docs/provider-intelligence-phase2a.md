# Provider Intelligence Phase 2A Validation

## Preconditions
1. From repo root, set up backend env once:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
2. Start API (terminal A):
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
.\run-backend.ps1
```
3. Keep API running at `http://127.0.0.1:8000`.

## Endpoint Smoke Commands
Run from a separate terminal (terminal B).

1. Match v2:
```powershell
curl -s -X POST "http://127.0.0.1:8000/match/v2" -H "Content-Type: application/json" -d '{"ingredients":["chicken","rice","salt"]}'
```
Expect keys: `cookable`, `almost`, `not_recommended`, `meta.version`=`"v2"`.

2. Search tags:
```powershell
curl -s "http://127.0.0.1:8000/search/tags"
```
Expect top-level key: `groups` (array).

3. Search filters:
```powershell
curl -s "http://127.0.0.1:8000/search/filters"
```
Expect keys: `cuisine`, `meal_type`, `method`, `ingredients`, `style`.

4. Search (filter-mode):
```powershell
curl -s -X POST "http://127.0.0.1:8000/search" -H "Content-Type: application/json" -d '{"filters":{"meal_type":["Dinner"],"method":["Skillet"],"ingredients":["chicken"]},"mode":{"meal_type":"any","method":"any","ingredients":"all"},"include":{},"exclude":{}}'
```
Expect keys: `cook_now`, `almost_there`, `not_practical`, `meta.total`.

5. Search density:
```powershell
curl -s "http://127.0.0.1:8000/search/density"
```
Expect keys: `total_recipes`, `tags`, `weak_tags`, `balanced_tags`, `overloaded_tags`, `cross_tag_sparsity`, `coverage_percent`.

## Regression Commands
From `backend` directory:

1. Minimal route regression:
```powershell
.\.venv\Scripts\Activate.ps1
pytest -q app/tests/test_routes_minimal.py
```

2. Match route-focused regression:
```powershell
.\.venv\Scripts\Activate.ps1
pytest -q app/tests/test_routes_match.py
```

## Validation Checklist
- [ ] `POST /match/v2` returns `200` and `meta.version == "v2"`.
- [ ] `GET /search/tags` returns `200` and non-error `groups` array.
- [ ] `GET /search/filters` returns `200` and all five filter arrays.
- [ ] `POST /search` returns `200` and all three result buckets.
- [ ] `GET /search/density` returns `200` and numeric `coverage_percent`.
- [ ] `pytest -q app/tests/test_routes_minimal.py` passes.
- [ ] `pytest -q app/tests/test_routes_match.py` passes.
