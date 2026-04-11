# Route Inventory

`backend/app/routes` contains both the mounted product routes and intentionally parked route modules.

Live product routes are the ones registered in `backend/app/api/router.py`:

- `/`
- `/health`
- `/pantry`
- `/recommendations`
- `/recipes`
- `/cook`
- `/events`

Parked route modules remain in this folder for reference and evaluation, but they are intentionally disconnected from the shipped API surface:

- `/match`
- `/search/density`
- `/insights`
- `/plan`
- `/unlock`
- `/onboarding`
- `/ai/recipe`
- `/supply`

If you are trying to understand the current product, start with the mounted router, not the full contents of this directory.
