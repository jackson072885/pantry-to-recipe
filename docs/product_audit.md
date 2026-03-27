# Product Audit Notes

Historical audit document kept for reference during repo cleanup.

## Current Status

This file does not describe the current shipped product narrative.

The repo is no longer centered on a generic tag-search or recipe-discovery story. The current product is a recommendation-centered dinner decision engine:

1. pantry
2. recommendations
3. best option
4. `Cook This Tonight`
5. action
6. tracking
7. improved future ranking

## Why This File Still Exists

It preserves earlier thinking about:

- metadata quality
- search and filtering concerns
- recipe density
- scoring risk

Those notes can still be useful for internal reasoning, but they are not the best starting point for understanding the repo today.

## Current Source Of Truth

For a new developer or reviewer:

- start with the root `README.md`
- use `BACKEND.md` for route and envelope behavior
- use `frontend/README.md` for mounted pages and CTA/tracking behavior
