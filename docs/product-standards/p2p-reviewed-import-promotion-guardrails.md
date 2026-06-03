# Reviewed Import Promotion Guardrails

## Purpose

This document defines the guardrails for any future workflow that might promote a reviewed imported recipe into the curated verified recipe layer.

Phase 16 does not implement promotion. It defines the decision boundary so reviewed imports can keep becoming more useful without quietly becoming curated verified recipes.

## Trust Ladder

The trust ladder is:

1. external candidate
2. inspected
3. queued for review
4. approved
5. reviewed import
6. ranked reviewed import
7. imported detail preview
8. reviewed import editing/cleanup
9. possible future promoted verified recipe

Each step must preserve source provenance and make the current trust state visible. A later step cannot imply that an earlier step is verified.

## Current Rule

Reviewed imports are not curated verified recipes.

They may be ranked, previewed, cleaned up, and made more useful as reviewed imports. They must remain structurally and visually separate from curated verified Recipe Browser cards until a future explicit promotion workflow is implemented and completed.

## Promotion Preconditions

A future promotion workflow must require all of the following before a reviewed import can become curated verified:

- explicit user or reviewer action that says the import is being considered for promotion
- source provenance audit, including provider/source identity and source URL when available
- title, ingredient, and instruction cleanup review
- pantry feasibility review against current product standards
- recipe quality review against recipe existence standards
- duplicate and near-duplicate check against curated verified recipes
- safety check for missing title, missing ingredients, missing instructions, vague instructions, missing provenance, and source identity gaps
- deliberate write into the curated verified recipe layer only after every required check passes

Promotion must be a separate action from cleanup. Saving reviewed-import cleanup must never promote a recipe.

## Required Separation

Until promotion is explicitly completed:

- do not route reviewed imports through the curated verified Recipe Detail page
- do not merge reviewed imports into the curated verified Recipe Browser card grid
- do not label reviewed imports as verified, official, fully trusted, or curated
- do not mutate curated recipe data from reviewed-import cleanup
- do not create curated recipe records as a side effect of import, preview, ranking, or cleanup
- do not hide source/provenance labels
- do not remove the reviewed-import trust state from the UI

## Future Promotion Contract

If promotion is implemented later, it should create a new explicit contract instead of reusing cleanup or import endpoints.

The future contract should:

- accept only a reviewed import identifier and promotion-review payload
- reject imports that have not passed the promotion preconditions
- preserve original provenance on the promoted recipe record
- record promotion timestamp and reviewer/audit metadata
- leave the original reviewed import record available for traceability
- fail safely without mutating curated recipe data when validation fails

## Copy Rules

Allowed language before promotion:

- "Reviewed import"
- "Reviewed import cleanup"
- "Source preserved"
- "Separate from curated verified recipes"
- "Cleanup only"
- "Does not promote this recipe"
- "Candidate for future promotion review"

Reserved language after explicit promotion only:

- "Verified recipe"
- "Curated recipe"
- "Promoted to verified"
- "Added to curated verified recipes"

## Implementation Guardrails

Future implementation must keep tests deterministic and must not require real external API calls, provider credentials, or live provider availability.

Promotion tests should prove:

- cleanup does not promote
- preview does not promote
- ranking does not promote
- promotion rejects records that fail provenance or quality checks
- promotion preserves original source/provenance metadata
- promotion writes only through the explicit promotion path
- reviewed imports remain separate until promotion completes
- curated verified Recipe Detail and Recipe Browser surfaces only include promoted records after the explicit workflow succeeds
