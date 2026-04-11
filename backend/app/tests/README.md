Automated tests for Pantry-to-Recipe.

Current backend coverage includes:
- pantry inventory routes
- recommendation and recipe routes
- cook flow behavior
- event tracking and behavior-signal persistence
- route inventory checks for the mounted API surface
- parked-route checks that confirm intentionally disconnected modules stay out of the live router

Primary safety goals:
- inventory never goes negative
- cook operations stay atomic
- tracking writes succeed without breaking the user flow
- recommendation contracts remain stable during cleanup
- the default backend test run stays aligned with the shipped API surface

Default backend command:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q app/tests
```

That command excludes `parked` tests on purpose, so the default engineering signal reflects only mounted routes and current backend behavior.

Optional parked-route verification:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q app/tests -m parked
```

Parked routes currently include `/match`, `/search/density`, `/insights`, `/plan`, `/unlock`, `/onboarding`, `/ai/recipe`, and `/supply`. Those route modules remain in the repository for evaluation, but they are intentionally not mounted in `app/api/router.py`.

These parked tests are quarantine checks, not the main engineering health signal. They exist to make sure old surfaces stay clearly disconnected while the shipped product remains centered on pantry -> recommendations -> recipe -> cook.
