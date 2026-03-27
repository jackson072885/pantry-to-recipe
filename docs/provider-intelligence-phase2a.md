# Provider Intelligence Phase 2A Validation

Historical validation notes for the provider-oriented route set.

## Status In The Current Repo
- These routes still exist and are still exercised by tests.
- They are not the main product story anymore.
- Use this document only when specifically validating the provider stack.

Relevant backend tests now live in:
- `backend/app/tests/test_routes_provider_phase2a.py`
- `backend/app/tests/test_routes_sequence.py`
- `backend/app/tests/test_routes_supply_simulate.py`
- `backend/app/tests/test_routes_ai_supply.py`

For current repo-wide validation, prefer:
```powershell
cd backend
python -m pytest -q app/tests
```

And for the primary frontend path:
```powershell
cd frontend
npm test -- --run
npm run build
```
