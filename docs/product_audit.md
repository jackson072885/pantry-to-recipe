# Pantry-to-Recipe: MVP Architecture Critique and Tightened Execution Plan

Date: 2026-02-23

## Executive Summary
The core risk is not algorithmic correctness; it is sparse tag coverage and metadata drift. If users select multiple bubbles and get few results, trust collapses. The MVP must prioritize metadata integrity and tag density before advanced scoring.

## Section 1: Codex Completion Audit Checklist (Tightened)

### A. Architecture Integrity
- Filter logic exists only in the backend; frontend is UI state only.
- Tag groups are data-driven (DB), not hardcoded.
- AND across groups, OR within group; exclude overrides include.
- Adding a new group requires only seed data changes.
- No JSON blob filtering; relational joins only.
- No duplicated filter logic between backend and frontend.

### B. Tag and Metadata Integrity
- Every recipe has all required metadata fields populated.
- Tag assignment is derived from metadata or validated against it.
- Tag list changes are migration-safe (rename, deprecate).
- No orphan tags; no untagged recipes.
- Slugs normalized and unique.

### C. Search Behavior Validation
- Include 1 tag works.
- Include 2 tags in same group uses OR.
- Include across 2 groups uses AND.
- Exclude removes results correctly.
- Include + Exclude same tag results in exclude.
- Overfilter returns 0 safely.
- Bubble toggle triggers live update without reload.
- No tags selected returns all recipes.

### D. Scoring Engine Validation (Post-MVP)
- Scoring comes after density stabilizes.
- Confidence must align with pantry coverage and time match.
- Tiers are deterministic and explainable.

### E. Database Health
- Target: minimum 10 recipes per primary tag.
- Enforce max 2 recipes per exact (Method + Protein + Time) combo.
- Cross-tag diversity exists across method/protein/time/cuisine.

### F. Performance
- Search response < 300ms local.
- Query count <= 3 per search.
- Indexes exist for tags, tag groups, recipe_tag join.
- Pagination supported for large result sets.

### G. Edge Cases
- Empty pantry.
- Single ingredient.
- All tags excluded.
- Rapid toggle stress.
- Simultaneous include/exclude across 4+ groups.

## Section 2: MVP-Driven Roadmap (Simplified)

### Phase 1 — Structural Core (Current)
- Bubble UI complete.
- Deterministic filtering.
- Tag DB seeded.
- Tag density target met.
- Simple tiering only (Cook Now / Almost / Not Practical).

### Phase 2 — Trust Layer
- Scoring weights.
- Substitution modeling.
- Explain-why UI.
- Filter relaxation suggestions.

### Phase 3 — Behavior Layer
- Local history and preference weighting (no login dependency).

Later phases (monetization, platform expansion) are deferred from MVP scope.

## Section 3: Future Enhancements (Deferred)
These remain optional and should not block Phase 1.

High-level ideas section: None added.

## Critical Missing Pieces (Risk)
- Metadata governance (how tags are enforced).
- Migration policy for tag changes.
- Validation pipeline to prevent mismatched tags and metadata.
- Density reporting as a control panel (now implemented).

## Execution Gate
Do not proceed to advanced scoring until:
- All primary tags have >= 10 recipes.
- Cross-tag sparsity is materially reduced.
- Metadata completeness is 100% for all recipes.
