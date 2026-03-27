# Provider Intelligence PRD

Historical provider-surface notes kept for reference during cleanup.

## Current Status
- The provider stack still exists in code and is covered by backend tests.
- Its backend routes are real: `/insights`, `/plan`, `/supply`, `/unlock`, and `/ai/recipe`.
- Its frontend pages exist, but they are not part of the primary app shell in `frontend/src/App.tsx`.

## Important Boundary
Do not treat this document as the current core product narrative.

The current core narrative is:
1. pantry
2. recommendations
3. recipe detail
4. cook action
5. tracking-backed ranking and monetization path

## What This Document Is For
- understanding provider-oriented experiments and supporting endpoints
- reviewing the secondary product surface without confusing it with the shipped MVP flow
- preserving context for future branch work if the provider stack is reactivated

## What This Document Is Not For
- onboarding a reviewer to the primary product flow
- describing the canonical demo path
- describing the latest recommendation-centered UX

For the current source of truth, start from the repo root `README.md`.
