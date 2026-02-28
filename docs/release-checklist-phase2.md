# Phase 2 Release Checklist

## Go/No-Go Metrics
- [ ] First Win Rate (`<=75s`) is `>= 70%` on first-time local cohort sessions.
- [ ] TTFR p90 is `<= 90s`.
- [ ] Typing fallback usage is `<= 20%` before first result.
- [ ] Best Tonight explainability renders on `100%` of top result cards.

## Backend Validation
- [ ] `cd backend && .venv/Scripts/python.exe -m pytest -q app/tests` passes.
- [ ] New endpoints return `200` with valid payloads:
  - [ ] `POST /ai/recipe/optimize`
  - [ ] `POST /supply/plan`
  - [ ] `POST /insights/provider-summary`
  - [ ] `POST /insights/damage`
  - [ ] `POST /insights/forecast/micro`
  - [ ] `POST /plan/scarcity/simulate`
  - [ ] `GET /plan/archetypes`
  - [ ] `POST /unlock/minimal`
  - [ ] `POST /insights/telemetry/event`
  - [ ] `POST /insights/telemetry/session/close`

## Frontend Validation
- [ ] `cd frontend && npm run lint` passes.
- [ ] `cd frontend && npm run build` passes.
- [ ] Provider tab renders without runtime errors.
- [ ] Supply Plan section can call `/supply/plan` and display top recommendations.
- [ ] Search emits `first_result_rendered` once per onboarding session.

## Regression Safety
- [ ] Existing MVP flows remain intact:
  - [ ] Pantry add/remove/list
  - [ ] Search filters and result groups
  - [ ] Recipe detail and cook action
  - [ ] Match route responses

## Release Artifacts
- [ ] Endpoint contract docs updated.
- [ ] QA smoke report stored.
- [ ] Rollback strategy recorded for newly added routes.
