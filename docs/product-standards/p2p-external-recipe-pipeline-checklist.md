# Pantry to Plate External Recipe Pipeline Checklist

Use this checklist for the next implementation wave after the Dinner Tonight product doctrine is locked.

Do not remove the existing internal recipe logic while adding external candidates. The first version should add an external candidate pipeline behind Dinner Tonight, normalize candidates into a common shape, and preserve fallback behavior when no provider is configured.

## Provider Config

- [x] Add provider configuration without committing API keys.
- [x] Keep provider-not-configured behavior explicit and non-fatal.
- [x] Make local development work with the internal recipe bank only.
- [x] Document required environment variable names where the implementation introduces them.
- [x] Document a manual live-provider smoke path without committing secrets.

Phase 1 introduced disabled-by-default external candidate configuration:
`EXTERNAL_RECIPE_PROVIDER=disabled`, optional `SPOONACULAR_API_KEY`, and reserved
`EDAMAM_APP_ID` / `EDAMAM_APP_KEY` settings. No real API keys should be committed.

Phase 5 adds a manual provider smoke path in
`docs/repo-operations/dinner-tonight-provider-smoke.md` plus a safe
`backend/.env.example`. The path verifies disabled mode, missing-key behavior,
and optional live Spoonacular configuration through the local Dinner Tonight
endpoint without adding live provider calls to automated tests.

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

- [x] Fall back to the internal recipe bank.
- [x] Do not show provider errors as user-facing failure if the app can still produce internal candidates.
- [x] Log or expose enough diagnostic detail for development.
- [x] Keep tests deterministic without real network calls.

The external-candidate endpoint keeps provider status honest and returns
internal recipe-bank candidates as controlled fallback when providers are
disabled, missing-key, or errored. Product surfaces still preserve that split:
Dinner Tonight can keep saved-pantry matches available when a provider does not
return a useful best candidate, and Recipe Browser keeps internal recipe cards as
the stable browsing backbone while live provider data supplies availability
intelligence.

## Mocked Backend Tests

- [x] Mock provider responses.
- [x] Cover provider unavailable, provider not configured, malformed provider payload, and successful normalization.
- [x] Verify the internal recipe bank still works as fallback and control source.
- [x] Avoid tests that require API keys or live provider calls.

## Scoring V1 / V2 Foundation

- [x] Implement weighted pantry feasibility rather than ingredient-count matching.
- [x] Treat missing core proteins and dish-defining ingredients as high severity.
- [x] Treat garnish and low-importance items as low severity.
- [x] Allow moderate or substitutable gaps when context supports it.
- [x] Produce stable groups: Cookable Tonight, Almost There, Inspiration, and Rejected.
- [x] Add critical, moderate, and minor missing-ingredient metadata for future UI explanation.

Phase 2 adds an isolated deterministic `pantry_feasibility_v2` foundation for
external candidates. It uses request ingredients as the pantry source for this
phase and keeps the rules intentionally small and replaceable.

## Dinner Tonight Integration

- [x] Wire external normalized candidates behind Dinner Tonight without removing existing internal recipe logic.
- [x] Preserve current saved-pantry behavior.
- [x] Keep the best dinner option first.
- [x] Make fallback behavior visible in logs or diagnostics, not in distracting user copy.

Phase 3 adds a frontend-safe Home integration for `POST /dinner-tonight/candidates`.
It reuses the saved/session pantry ingredient names that already drive Home,
shows a controlled external candidate panel when the provider returns a best
candidate, and soft-fails provider disabled, missing key, and error states while
leaving the internal recommendation flow available.

Phase 4 unifies the Home decision hierarchy in the frontend: useful configured
live candidates can lead as a "Live recipe match", while disabled, missing-key,
error, no-best, or rejected live states fall back to the existing internal
saved-pantry match without treating provider availability as a user-facing
failure.

## Living Filter Counts

- [x] Compute filter counts from the current candidate result set.
- [x] Hide, fade, or demote dead filters.
- [x] Keep counts tied to current pantry, selected filters, current mode, and current candidate universe.
- [x] Do not expose a giant static taxonomy dump.
- [x] Add selected-filter narrowing foundation for backend candidates.
- [x] Add optional `selected_filters` and `filter_mode` request metadata to `POST /dinner-tonight/candidates`.
- [x] Add additive `filter_counts` response metadata to `POST /dinner-tonight/candidates`.

Phase 2 exposes living filter count metadata for cuisine, dish type, flavor,
sauce, method, ingredients, used ingredients, missed ingredients, ready-time
buckets, and feasibility buckets. The Recipe Browser now consumes that metadata
as live facet chips, hides zero-count facet values, keeps selected live facets
removable even when narrowed counts stop returning the selected value, and
separates live candidate availability from live facet availability in user copy.
The full unified Recipe Browser control board remains Phase 8 work.

## Risks and Guardrails

- Do not add API keys to the repo.
- Do not modify recipe data as part of provider integration.
- Do not replace internal recipes with untrusted external payloads.
- Do not broaden into a full Recipe Browser redesign during the provider pipeline step.
- Do not let provider metadata define Pantry to Plate product truth directly.
- Keep validation focused and mocked before any live-provider smoke test.

## Import Review Foundation

- [x] Add a backend import-review contract for external candidates.
- [x] Preserve source/provider identity, source URL, candidate provenance, normalized display fields, readiness bucket/score, used and missed ingredients.
- [x] Add deterministic safety flags for missing title, ingredients, instructions, provenance, source identity, and vague instructions.
- [x] Keep the foundation review-only: no verified internal recipe is created and no recipe data file is mutated.
- [x] Persist the review queue with create, read, list, and status update behavior.
- [x] Preserve reviewer notes, optional edited display fields, original provenance, timestamps, and safety flags.
- [x] Block approval while fatal safety flags remain unresolved.
- [x] Add review UI.
- [x] Add a controlled backend approved-import path into a separate imported recipe layer.
- [x] Mark imported records as `origin = external_import`, `verification_status = imported_reviewed`, and `imported_from_external = true`.
- [x] Block duplicate imports by review and source identity.
- [x] Surface reviewed imported recipes with explicit trust badges.
- [x] Keep surfaced imports separate from curated verified Recipe Browser cards.
- [x] Rank reviewed imports in a separate pantry-fit lane without merging them into curated verified cards.

Phase 11A creates the foundation, Phase 11B persists the queue, Phase 11C adds the review UI, and Phase 11D adds a controlled backend import path. Phase 12 exposes the reviewed imported layer in Recipe Browser with trust labels. Phase 13 lets reviewed imports participate in pantry-aware ranking in their own lane while preserving source/provenance labels. Imported records remain separate from the curated verified recipe bank until a future promotion process exists.
