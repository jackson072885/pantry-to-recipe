# Truth Alignment Execution Map

## Goal

Align recommendation truth, pantry-readiness semantics, cross-surface consistency, pantry ingestion behavior, visibility rules, personalization safety, instruction confidence, and trust-facing UI copy so the product more honestly fulfills its core promise:

**Help the user decide what they can cook tonight using what they already have.**

## Core product truth

Pantry-to-Recipe is a pantry-aware recipe discovery and dinner decision engine. It should become a Logic Pro-style recipe browser for dinner without becoming a generic recipe catalog. Product direction is locked in `docs/product-standards/p2p-dinner-tonight-product-doctrine.md`.

The product should optimize for:
- trust over cleverness
- semantic honesty over impressive-looking behavior
- consistent pantry truth across recommendation, detail, and cook flows
- clear separation between ready now, almost there, and fallback states

## Master problem statement

The product thesis is ahead of the product truth layer.

That means the app has the right direction, but several important truths are still misaligned:
- recommendation semantics are not fully honest
- weak fallback options can still be presented too strongly
- recommendation, detail, and cook surfaces may drift
- visibility/readiness rules may differ across surfaces
- pantry ingestion can lose or blur truth
- behavior-based ranking may overstate intelligence or personalization
- instruction quality/confidence can appear stronger than source truth supports
- UI language can promise more certainty than the system truly has

## Success criteria

By the end of this implementation plan:

- “Cook tonight” means pantry-ready now
- weak fallbacks do not masquerade as strong winners
- recommendation, detail, and cook flows agree on pantry truth
- visibility and readiness semantics are consistent
- pantry input flows preserve truth
- personalization does not fake user-specific intelligence
- instruction quality is improved or safely constrained
- UI copy is honest and trust-building
- tests lock the behavior in

## Phase summary

| Phase | Name | Type | Goal | Depends On |
|---|---|---|---|---|
| 0 | Repo Truth + Execution Map | Analysis | Confirm branch, inspect files, map dependencies | None |
| 1 | Recommendation Truth Alignment | Behavior change | Fix best-tonight and no-strong-match semantics | 0 |
| 2 | Cross-Surface Truth Consistency | Behavior change | Align recommendation, detail, and cook behavior | 1 |
| 3 | Visibility + Readiness Rule Unification | Behavior change | Make eligibility/readiness rules consistent | 1 |
| 4 | Pantry Input Truth + Bulk Import Fix | Behavior change | Preserve pantry truth during ingestion | 0 |
| 5 | Personalization Safety + Hero Fatigue Control | Behavior change | Reduce unsafe/global behavior weighting and repetition | 1 |
| 6 | Instruction Quality + Confidence Honesty | Behavior change | Improve recipe guidance without inflating confidence | 0 |
| 7 | UX Language + Trust Copy Alignment | UI/Behavior | Make wording match actual runtime truth | 1, 2, 3 |
| 8 | Docs, Test Lock-In, and Final Hardening | Refactor/Hardening | Update docs and lock final behavior with tests | 1–7 |

## Expected file ownership

### Phase 0 — Repo Truth + Execution Map
- AGENTS.md
- current branch / repo status
- all impacted files identified below

### Phase 1 — Recommendation Truth Alignment
Expected focus:
- `backend/app/services/recommendation_service.py`
- recommendation route files
- `frontend/src/lib/homeRecommendations.ts`
- `frontend/src/pages/Home.tsx`
- `frontend/src/components/RecommendationGroups.tsx`
- recommendation-related backend/frontend tests

Primary concerns:
- strong-match qualification
- best_tonight gating
- no_strong_match semantics
- fallback promotion behavior

### Phase 2 — Cross-Surface Truth Consistency
Expected focus:
- recommendation/detail/cook shared logic
- recipe detail contract tests
- cook-related handlers and tests
- any pantry coverage helper used across surfaces

Primary concerns:
- recommendation/detail agreement
- cook action truth
- duplicated pantry-readiness logic

### Phase 3 — Visibility + Readiness Rule Unification
Expected focus:
- list/recommendation/detail eligibility logic
- visibility helpers/services
- recommendation filtering logic
- visibility/readiness tests

Primary concerns:
- production vs active vs visible mismatch
- recipe eligibility consistency
- low-confidence/incomplete recipe contamination

### Phase 4 — Pantry Input Truth + Bulk Import Fix
Expected focus:
- Pantry page ingestion flow
- bulk import logic
- preview/commit backend flow if present
- quantity/unit parsing and normalization logic
- pantry flow tests

Primary concerns:
- silent truth degradation
- quantity/unit loss
- weak UI-side ingestion shortcuts bypassing backend truth

### Phase 5 — Personalization Safety + Hero Fatigue Control
Expected focus:
- `backend/app/models/user_action.py`
- user action service files
- behavior weighting in recommendation ranking
- hero repetition logic
- ranking tests

Primary concerns:
- pooled/global behavior signals
- fake personalization
- repeated hero fatigue
- weak fallback over-promotion from behavior points

### Phase 6 — Instruction Quality + Confidence Honesty
Expected focus:
- `backend/app/services/recipe_enrichment_service.py`
- `backend/app/services/recipe_quality_service.py`
- recipe enrichment/quality tests

Primary concerns:
- overconfident generated instructions
- low-confidence content inflation
- filler phrasing
- weak-source cleanup behavior

### Phase 7 — UX Language + Trust Copy Alignment
Expected focus:
- Home hero copy
- recommendation CTA/status copy
- no-strong-match state messaging
- shopping-required language
- best-option explanation text
- UI tests where relevant

Primary concerns:
- copy implying stronger certainty than runtime truth supports
- poor distinction between ready now / almost there / fallback

### Phase 8 — Docs, Test Lock-In, and Final Hardening
Expected focus:
- README
- docs affected by runtime changes
- route/docs mismatches
- stale comments
- final regression test coverage

Primary concerns:
- docs drifting from runtime truth
- missing regression protection
- stale assumptions from older product direction

## Agent assignments

### Agent 0 — Repo Commander
Mission:
- Read AGENTS.md
- confirm branch
- inspect repo
- identify dependencies and file ownership
- produce execution map before code changes

Output:
- concise dependency map
- phase classifications
- file overlap warnings

### Agent 1 — Recommendation Truth Agent
Mission:
- make recommendation outputs truthful
- tighten strong-match and best-tonight semantics
- stop weak fallback results from behaving like strong winners

### Agent 2 — Surface Consistency Agent
Mission:
- make recommendation, detail, and cook flows agree on pantry truth
- reduce duplicated or drifting readiness logic

### Agent 3 — Visibility Rule Agent
Mission:
- unify recipe visibility/readiness standards across major surfaces

### Agent 4 — Pantry Truth Agent
Mission:
- preserve pantry truth during ingestion
- improve bulk import honesty and backend alignment

### Agent 5 — Personalization Agent
Mission:
- make ranking behavior safer and less repetitive
- constrain fake or pooled personalization effects

### Agent 6 — Content Quality Agent
Mission:
- improve recipe instruction quality without overstating confidence

### Agent 7 — UX Trust Agent
Mission:
- align wording with true system behavior
- make recommendation states easy and honest to understand

### Agent 8 — Hardening Agent
Mission:
- update docs
- lock in behavior with tests
- remove stale semantics and mismatched references

## Parallelization rules

Must happen first:
- Phase 0

Can begin after Phase 0:
- Phase 1
- Phase 4
- Phase 6

Should begin after Phase 1 direction is clear:
- Phase 2
- Phase 3
- Phase 5
- Phase 7

Must happen last:
- Phase 8

If two phases need the same core file:
- higher-dependency truth phase gets ownership first
- pause conflicting parallel work until ownership is clear

## Done criteria by phase

### Phase 1 is done when:
- weak fallback candidates no longer present as true best-tonight winners
- no_strong_match states are reflected honestly in UI selection
- recommendation tests pass

### Phase 2 is done when:
- recommendation/detail/cook flows agree on readiness semantics
- cook behavior no longer contradicts detail or recommendation truth
- consistency tests pass

### Phase 3 is done when:
- visibility/readiness rules are consistent across key surfaces
- ineligible recipes do not silently leak into dinner-critical surfaces
- visibility tests pass

### Phase 4 is done when:
- bulk import does not silently degrade pantry truth
- quantity/unit handling is honest
- backend-supported truth flow is used where appropriate
- pantry ingestion tests pass

### Phase 5 is done when:
- behavior weighting no longer creates fake personalization
- hero repetition is reduced
- weak fallback recipes do not stay artificially elevated
- ranking tests pass

### Phase 6 is done when:
- recipe instructions are safer and clearer
- low-confidence content is not overstated
- enrichment/quality tests pass

### Phase 7 is done when:
- UI copy matches actual recommendation/readiness truth
- shopping-required and fallback states are clearly labeled
- copy-related tests or smoke checks pass

### Phase 8 is done when:
- docs match runtime behavior
- stale assumptions are removed
- final relevant backend/frontend tests pass

## Commit policy

- Commit and push after each completed, test-passing phase
- Avoid mixed-purpose commits
- Prefer one stable vertical slice per commit
- Do not wait until the very end for one giant commit
- Do not commit half-broken phase work unless creating a rollback checkpoint

## Suggested commit rhythm

- Phase 1 → commit + push
- Phase 2 and 3 together if tightly coupled, otherwise separate
- Phase 4 → commit + push
- Phase 5 → commit + push
- Phase 6 → commit + push
- Phase 7 → commit + push
- Phase 8 → final hardening commit + push

## Risks / watchouts

- recommendation and detail may still drift if pantry coverage logic remains duplicated
- pantry import changes may affect expectations around units and normalization
- behavior hardening may make ranking feel less “smart,” which is acceptable
- copy should not be updated ahead of backend semantics
- visibility tightening should not unnecessarily shrink useful inventory
- instruction quality changes should not break existing contracts

## Final implementation bias

When forced to choose between:
- more impressive behavior
- more honest behavior

Choose more honest behavior.

When forced to choose between:
- clever ranking
- trustworthy recommendation semantics

Choose trustworthy recommendation semantics.

When forced to choose between:
- polished ambiguity
- explicit truth

Choose explicit truth.
