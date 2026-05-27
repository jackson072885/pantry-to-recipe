# Pantry to Plate External Recipe Pipeline Checklist

Use this checklist for the next implementation wave after the Dinner Tonight product doctrine is locked.

Do not remove the existing internal recipe logic while adding external candidates. The first version should add an external candidate pipeline behind Dinner Tonight, normalize candidates into a common shape, and preserve fallback behavior when no provider is configured.

## Provider Config

- Add provider configuration without committing API keys.
- Keep provider-not-configured behavior explicit and non-fatal.
- Make local development work with the internal recipe bank only.
- Document required environment variable names where the implementation introduces them.

## External Recipe Service

- Add a small service boundary for fetching external recipe candidates.
- Keep provider response handling isolated from scoring and UI contracts.
- Preserve source traceability for every candidate.
- Treat provider data as untrusted until normalized.

## Normalized Candidate Schema

- Normalize candidates into the doctrine shape before ranking or rendering.
- Include source, source id, source URL, title, optional image, optional ready minutes, optional servings, ingredients, used ingredients, missed ingredients, instructions, tags, and raw provider metadata.
- Keep raw metadata available for debugging without making the UI depend on provider-specific fields.

## Provider-Not-Configured Behavior

- Fall back to the internal recipe bank.
- Do not show provider errors as user-facing failure if the app can still produce internal candidates.
- Log or expose enough diagnostic detail for development.
- Keep tests deterministic without real network calls.

## Mocked Backend Tests

- Mock provider responses.
- Cover provider unavailable, provider not configured, malformed provider payload, and successful normalization.
- Verify the internal recipe bank still works as fallback and control source.
- Avoid tests that require API keys or live provider calls.

## Scoring V1

- Implement weighted pantry feasibility rather than ingredient-count matching.
- Treat missing core proteins and dish-defining ingredients as high severity.
- Treat garnish and low-importance items as low severity.
- Allow moderate or substitutable gaps when context supports it.
- Produce stable groups: Cookable Tonight, Almost There, Inspiration, and Rejected.

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
