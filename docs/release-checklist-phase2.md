# Release Checklist

This checklist has been repointed at the current recommendation-centered product.

## Core Product Validation
- [ ] Pantry add/remove/list works.
- [ ] `/recommendations` returns grouped results from pantry input.
- [ ] The best dinner option is surfaced clearly.
- [ ] "Cook This Tonight" resolves correctly to recipe detail or an outbound shopping link.
- [ ] `/events` accepts tracking events used by the frontend.
- [ ] `/cook/{id}` deducts inventory correctly and blocks insufficient pantry states.
- [ ] Behavior-aware ranking still affects recommendation order.

## Repo Validation
- [ ] `cd backend && python -m pytest -q app/tests` passes.
- [ ] `cd frontend && npm test -- --run` passes.
- [ ] `cd frontend && npm run build` passes.

## Secondary Surface Validation
- [ ] Provider routes remain test-covered and non-destructive.
- [ ] Provider pages stay out of the primary app shell unless intentionally reintroduced.

## Release Artifacts
- [ ] Top-level docs match the current product flow.
- [ ] Non-core surfaces are called out as secondary.
- [ ] Checkpoint branch and commit commands are recorded before pushing.
