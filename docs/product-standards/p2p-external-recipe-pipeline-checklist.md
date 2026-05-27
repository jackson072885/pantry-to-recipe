# Pantry to Plate External Recipe Pipeline Checklist

Use this checklist for the next implementation wave after the Dinner Tonight product doctrine is locked.

Do not remove the existing internal recipe logic while adding external candidates. The first version should add an external candidate pipeline behind Dinner Tonight, normalize candidates into a common shape, and preserve fallback behavior when no provider is configured.

## Provider Config

- [x] Add provider configuration without committing API keys.
- [x] Keep provider-not-configured behavior explicit and non-fatal.
- [x] Make local development work with the internal recipe bank only.
- [x] Document required environment variable names where the implementation introduces them.

Phase 1 introduced disabled-by-default external candidate configuration:
`EXTERNAL_RECIPE_PROVIDER=disabled`, optional `SPOONACULAR_API_KEY`, and reserved
`EDAMAM_APP_ID` / `EDAMAM_APP_KEY` settings. No real API keys should be committed.

## External Recipe Service

- [x] Add a small service boundary for fetching external recipe candidates.
- [x] Keep provider response handling isolated from scoring and UI contracts.
- [x] Preserve source traceability for every candidate.
- [x] Treat provider data as untrusted until normalized.

## Normalized Candidate Schema

- [x] Normalize candidates into the doctrine shape before ranking or rendering.
- [x] Include source, source id, source URL, title, optional image, optional ready minutes, optional servings, ingredients, used ingredients, missed ingredients, instructions, tags, and raw provider metadata.
- [x] Keep raw metadata available for debugging without making the UI depend on provider-specific fields.

## Provider-Not-Configured Behavior

- [ ] Fall back to the internal recipe bank.
- [x] Do not show provider errors as user-facing failure if the app can still produce internal candidates.
- [x] Log or expose enough diagnostic detail for development.
- [x] Keep tests deterministic without real network calls.

Phase 1 endpoint returns external candidates only and does not merge internal
recipe candidates yet. Internal fallback remains a future Dinner Tonight
integration step.

## Mocked Backend Tests

- [x] Mock provider responses.
- [x] Cover provider unavailable, provider not configured, malformed provider payload, and successful normalization.
- [ ] Verify the internal recipe bank still works as fallback and control source.
- [x] Avoid tests that require API keys or live provider calls.

## Scoring V1

- [ ] Implement weighted pantry feasibility rather than ingredient-count matching.
- [ ] Treat missing core proteins and dish-defining ingredients as high severity.
- [ ] Treat garnish and low-importance items as low severity.
- [ ] Allow moderate or substitutable gaps when context supports it.
- [x] Produce stable groups: Cookable Tonight, Almost There, Inspiration, and Rejected.

Phase 1 uses isolated deterministic count-based scoring only. Weighted pantry
feasibility remains the Phase 2 upgrade.

## Dinner Tonight Integration

- Wire external normalized candidates behind Dinner Tonight without removing existing internal recipe logic.
- Preserve current saved-pantry behavior.
- Keep the best dinner option first.
- Make fallback behavior visible in logs or diagnostics, not in distracting user copy.

## Living Filter Counts

- Compute filter counts from the current candidate result set.
- Hide, fade, or demote dead filters.
- Keep counts tied to current pantry, selected filters, current mode, and current candidate universe.
- Do not expose a giant static taxonomy dump.

## Risks and Guardrails

- Do not add API keys to the repo.
- Do not modify recipe data as part of provider integration.
- Do not replace internal recipes with untrusted external payloads.
- Do not broaden into a full Recipe Browser redesign during the provider pipeline step.
- Do not let provider metadata define Pantry to Plate product truth directly.
- Keep validation focused and mocked before any live-provider smoke test.
