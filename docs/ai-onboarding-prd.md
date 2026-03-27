# AI-Driven Onboarding PRD

Historical planning document kept for reference.

## Important Status Note

This file is not the current implementation spec for the shipped product.

The current product is:

- pantry-driven dinner recommendations
- best-option highlight
- `Cook This Tonight`
- recipe-detail or outbound-shopping next action
- `/events` tracking
- behavior-aware re-ranking

Start with the root `README.md` for the current source of truth.

## What In This Document Is Historical

The original draft assumed older or proposed onboarding contracts and telemetry flows that are not the live core product API in this repository.

## Current Relevant Implemented Endpoints

If onboarding-related work resumes, anchor it to the current backend surfaces that actually exist:

- `GET /recommendations`
- `POST /events`
- `POST /onboarding/profile/preview`
- `POST /onboarding/recipes/first`

## Practical Reading Guidance

Use this document only for:

- historical onboarding ideas
- possible future UX directions
- understanding old intent behind activation and first-session flows

Do not use it for:

- describing the current shipped product
- onboarding a new developer to the live route surface
- documenting the main recommendation loop
