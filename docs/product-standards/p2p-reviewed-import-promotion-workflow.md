# Reviewed Import Promotion Workflow

## Purpose

This document defines the future workflow shape for promoting a reviewed imported recipe into the curated verified recipe layer.

Phase 17 does not implement promotion. It turns the Phase 16 guardrails into a concrete workflow design and audit checklist so implementation can happen later without weakening the trust ladder.

## Current State

Reviewed imports can currently be:

- queued for review
- approved for import
- imported into the separate reviewed-import layer
- ranked in their own reviewed-import lane
- previewed locally in Recipe Browser
- cleaned up for title, ingredients, and instructions

They are still not curated verified recipes.

## Promotion Workflow Shape

A future promotion workflow should have four explicit stages.

### Stage 1: Select For Promotion Review

The reviewer chooses a reviewed import as a candidate for promotion review.

This action should not create or mutate a curated verified recipe. It should only open the promotion review path and preserve the reviewed-import status until every required check passes.

Required user-facing copy:

- "Candidate for promotion review"
- "Still a reviewed import"
- "Source preserved"
- "Not added to curated verified recipes yet"

### Stage 2: Run Promotion Audit

The reviewer must complete the promotion audit checklist before any write to the curated verified layer is allowed.

The audit should verify:

- source provenance is present and credible
- provider/source identity is preserved
- source URL is preserved when available
- title is clear, specific, and not misleading
- ingredients are complete enough to cook
- instructions are complete, ordered, and specific
- pantry feasibility is understandable
- recipe quality passes the recipe existence doctrine
- duplicate and near-duplicate checks are complete
- safety flags are resolved or explicitly rejected

### Stage 3: Confirm Curated Verified Write

Only after the audit passes should the reviewer see a separate final confirmation.

This confirmation should say exactly what will change:

- a curated verified recipe record will be created or updated
- original reviewed-import provenance will be retained
- the reviewed import remains traceable
- the promotion action is separate from cleanup

### Stage 4: Preserve Traceability After Promotion

After promotion, the system should retain enough metadata to reconstruct the chain:

- original import id
- original review id
- provider/source identity
- source URL when available
- promotion timestamp
- promotion reviewer or audit metadata when available
- original reviewed-import provenance payload

The promoted recipe may appear in curated verified surfaces only after promotion succeeds.

## Promotion Audit Checklist

Use this checklist before promotion:

- [ ] Reviewed import record exists.
- [ ] Record has `origin = external_import`.
- [ ] Record has `verification_status = imported_reviewed`.
- [ ] Record has `imported_from_external = true`.
- [ ] Source/provider identity is preserved.
- [ ] Source URL is preserved when available.
- [ ] Provenance includes original source details.
- [ ] Title has been cleaned up and reviewed.
- [ ] Ingredients have been cleaned up and reviewed.
- [ ] Instructions have been cleaned up and reviewed.
- [ ] Recipe passes recipe existence standards.
- [ ] Pantry feasibility can be explained honestly.
- [ ] Duplicate check against curated verified recipes is complete.
- [ ] Near-duplicate check against curated verified recipes is complete.
- [ ] Missing title, ingredients, instructions, provenance, and source identity risks are resolved.
- [ ] Promotion reviewer explicitly confirms the curated verified write.

If any item fails, do not promote.

## Future API Shape

A future backend route should be explicit and separate from import or cleanup routes.

Possible shape:

`POST /dinner-tonight/imported-recipes/{import_id}/promotion-review`

Allowed request fields should describe the promotion audit, not silently overwrite trust fields.

Possible request fields:

- `reviewer_notes`
- `quality_review_status`
- `provenance_review_status`
- `duplicate_review_status`
- `safety_review_status`
- `promotion_decision`

The route should reject:

- missing imported records
- records that are not `external_import`
- records that are not `imported_reviewed`
- records with unresolved fatal audit failures
- attempts to edit provenance or trust fields directly
- attempts to promote through cleanup, preview, import, or ranking paths

## Future UI Shape

The future UI should keep promotion review separate from reviewed-import cleanup.

Recommended placement:

- start from the reviewed-import detail preview
- open a promotion-review panel or stepper
- show trust/provenance labels throughout
- show checklist progress
- require final confirmation before writing to curated verified recipes

The UI must not make promotion feel like the default next button after cleanup.

## Copy Rules

Before final promotion:

- "Candidate for promotion review"
- "Still a reviewed import"
- "Source preserved"
- "Not added to curated verified recipes yet"
- "Promotion review"

At final confirmation:

- "Promote to curated verified recipe"
- "This will add a curated verified recipe record"
- "Original source provenance will be preserved"

After successful promotion only:

- "Promoted to verified"
- "Curated verified recipe"

## Required Tests For Future Implementation

Future implementation should prove:

- cleanup cannot promote
- preview cannot promote
- ranking cannot promote
- import cannot promote
- promotion review requires explicit final confirmation
- promotion rejects records with missing provenance
- promotion rejects records with unresolved duplicate risk
- promotion preserves original import provenance
- promotion keeps the original reviewed import traceable
- curated verified cards do not include reviewed imports before promotion
- curated verified Recipe Detail does not load reviewed imports before promotion
- promoted recipes appear in curated verified surfaces only after the explicit workflow succeeds

## Non-Goals

Phase 17 does not:

- add a promotion endpoint
- add a promotion button
- add a promotion UI
- mutate curated recipe data
- route reviewed imports through curated Recipe Detail
- change Recipe Browser card rendering
- change Dinner Tonight ranking
- change provider behavior
