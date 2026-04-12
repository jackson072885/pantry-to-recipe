# Recipe Browser Execution Map

## Goal

Keep one authoritative execution map for the existing **Recipe Browser** product surface so future implementation phases operate from current repo reality instead of stale MVP assumptions.

Recipe Browser remains an exploration surface inside the pantry-first product:

**Show the user recipes that match what they want, then rank those eligible results by what they can realistically cook from their current pantry.**

This plan should guide reconciliation and next expansion work without turning the browser into a generic recipe catalog.

---

## Current implementation status

Recipe Browser is already implemented in meaningful MVP form. The current repo includes:
- shared Recipe Browser MVP contract/config
- dedicated Recipe Browser route and page shell
- nav entry for `Recipe Browser`
- tabbed filter-family UI
- bubble/chip selection state
- Active Filters row with single-remove and clear-all behavior
- eligibility filtering against the current Browser-safe metadata model
- pantry-aware ranking reuse from live `GET /recommendations` truth
- result count, sort explanation, low-result messaging, and honest empty states
- pantry-fit badges mapped from recommendation states:
  - `cook_now` -> `Cook Now`
  - `almost_there` -> `Almost There`
  - `not_worth_it` -> `Pantry Stretch`
- tests covering contract/config, eligibility logic, ranking reuse, and page behavior

This document should no longer read as if those pieces are still hypothetical.

---

## Legacy MVP vs revised target model

The current implementation reflects an earlier, smaller MVP model:
- flat filter families
- `Protein` as a first-class family
- limited supported values
- simpler OR-within-family behavior
- Browser-safe metadata normalization that fails closed outside the MVP contract
- catalog list + detail hydration for browser loading

The revised target model is broader and more precise:
- hierarchical faceted browsing
- `Ingredients` replacing `Protein` conceptually
- parent / child taxonomy filtering
- broader filter depth
- strict intersection behavior across families
- honest empty results when no recipe satisfies all selected filters and pantry constraints

Important planning truth:
- the current codebase and the revised target model are **not** the same thing yet
- future work must reconcile the current MVP implementation with the revised target model before expanding the browser much further

---

## Core product truth

Pantry-to-Recipe is a **pantry-first dinner decision engine**.

Recipe Browser is an exploration surface, but it must remain aligned with the shipped product truth:
- pantry still matters
- recommendation truth still matters
- browser results must stay grounded in realistic tonight fit
- empty results must stay honest
- trust matters more than breadth

Recipe Browser is still the same product surface, but its direction has expanded:
- from a smaller flat-filter MVP
- toward a hierarchical, faceted, pantry-aware browser
- without abandoning pantry-first qualification and ranking truth

### Product relationship
- **Home / Recommendations** = decision-first
- **Recipe Browser** = exploration-first
- **Both must agree on pantry truth**

---

## Feature definition / UX model

Recipe Browser should evolve toward a faceted browsing system with:
- broad filter-family tabs as top-level organizers
- grouped filter collections within those families
- parent / child / subchild taxonomy support where appropriate
- ingredient-level filtering, not just primary protein filtering
- persistent visibility into what filters are shaping results
- strict intersection behavior across families
- honest zero-results handling when no recipe qualifies

Tabs remain useful, but they are broad family containers, not the full information architecture.

### Current UI reality
The shipped browser already has:
- a dedicated page header and shell
- tabbed family navigation
- chip-based selection
- Active Filters visibility
- result count and sort explanation
- empty-state and low-result messaging
- pantry-fit result badges

### Revised target direction
Future phases should move the browser toward:
- hierarchical family presentation where needed
- ingredient-first filtering
- clearer distinction between taxonomy filters and ingredient filters
- broader filter depth without creating option chaos

---

## Current implementation boundaries

The current implementation is already anchored to an MVP contract with:
- family ids for `protein`, `cuisine`, `time`, `difficulty`, and `method`
- limited supported values per family
- fail-closed normalization for unsupported metadata
- pantry-aware ranking applied only after eligibility filtering
- a browser catalog fetch path that currently depends on list + per-detail hydration

That MVP contract is useful, but it is also the main place where revised browser direction now diverges from current implementation.

---

## Not in scope for immediate expansion

Do **not** let follow-up work silently widen into all-at-once browser redesign:
- free-text search
- saved filter presets
- advanced sort menus
- deep personalization changes
- recommendation-engine redesign
- backend route redesign unless explicitly required
- exhaustive taxonomy expansion before the contract is reconciled
- giant metadata cleanup before minimum taxonomy/ingredient rules are locked
- unrelated page redesigns
- visual tint/group-color systems beyond later UX enhancement
- pantry-builder or onboarding redesign

---

## Filter model

### Current implemented family model
Current code is built around these MVP families:
- Protein
- Cuisine
- Time
- Difficulty
- Method

That model is implemented and tested today.

### Revised target family model
The planning target should now assume these broad families:
- Ingredients
- Cuisine
- Time
- Difficulty
- Method

`Ingredients` replaces the older `Protein` framing conceptually. Protein can still exist as recipe metadata, but the browser should evolve toward ingredient-level filtering rather than treating protein as the dominant family.

### Taxonomy direction
Taxonomy-style families such as Cuisine should be able to support:
- parent categories
- child categories
- subtree matching behavior

Broad family tabs still remain useful even if the taxonomy inside a family becomes hierarchical.

### Ingredients direction
Ingredients is likely the deepest filter family and the one most likely to need:
- explicit token normalization
- coverage rules
- strict matching semantics
- active scope control to prevent option explosion

---

## Matching rules

### Rule 1: Filters determine eligibility
Filters decide which recipes are eligible for the browser result set.

### Rule 2: Across families = AND
Selections across different families combine with **AND** logic.

Example:
- Cuisine: Cuban
- Ingredient: green beans
- Time: 30 min

Means:

**Cuban AND green beans AND 30 min**

### Rule 3: Taxonomy-family multi-select = OR
Within taxonomy-style families such as Cuisine, same-family multi-select combines with **OR** logic.

Example:
- Cuisine: Cuban
- Cuisine: Mexican

Means:

**Cuban OR Mexican**

### Rule 4: Ingredient multi-select = AND by default
Within Ingredients, same-family multi-select should use **AND** logic by default unless explicitly deferred later.

Example:
- Ingredient: green beans
- Ingredient: cumin

Means:

**green beans AND cumin**

### Rule 5: Parent taxonomy selections include descendants
Selecting a parent taxonomy value should include recipes tagged to descendant branches.

Example:
- `Latin` should include recipes tagged as `Cuban`

### Rule 6: Child taxonomy selections narrow to the selected branch
Selecting a child taxonomy value should include only that branch or subtree.

Example:
- `Cuban` should not imply all `Latin`

### Rule 7: Empty results remain empty
If no recipe satisfies all selected filters and pantry constraints, the browser should show an honest empty state instead of loosening the query silently.

### Rule 8: Pantry truth still governs qualification and ranking
Recipe Browser must not become a generic recipe catalog. Browser results still need to stay inside pantry-aware product truth.

### Rule 9: Pantry-aware ranking happens within the eligible set
Eligible recipes should then be ordered by pantry realism using existing recommendation truth where possible.

Default order:
1. Cook Now
2. Almost There
3. Pantry Stretch

### Rule 10: Active filters remain visible
Users should always be able to see what is shaping the result set.

### Rule 11: Tab switching preserves selections
Switching filter families must not clear already-selected filters.

---

## Ranking model

### Current implementation reality
The current browser already reuses live recommendation truth for pantry-aware ranking:
- it reads from `GET /recommendations`
- it maps recommendation groups into browser badge states
- it reorders only the already-eligible set
- it keeps original eligible order when ranking data is unavailable instead of guessing

### Planning rule
Do not create a second conflicting browser ranking system if existing recommendation truth can be reused or lightly extended.

### Visible result states
Prefer exposing:
- Cook Now
- Almost There
- Pantry Stretch

Avoid over-highlighting weak-fit results.

---

## Data / contract reality

### Current implementation reality
The current browser depends on:
- the shared MVP filter contract/config
- Browser-safe metadata normalization
- recipe list fetches followed by detail hydration

That loading path works today, but it carries browser-contract and N+1 follow-up risk as the browser expands.

### Revised planning direction
Future expansion should be based on explicit contract and metadata support for:
- taxonomy structure where needed
- ingredient tokens or equivalent normalized ingredient mapping
- supported filter coverage rules
- browser-safe data retrieval that does not become increasingly expensive or fragile

### Metadata rule
Patch only what the current phase requires. Do not let metadata and taxonomy cleanup become a giant side quest before rules are locked.

---

## Phase status and next plan

| Phase | Name | Status | Type | Purpose |
|---|---|---|---|---|
| 0 | Discovery + Execution Map | `complete` | Analysis | Baseline browser planning artifact exists and has now been updated to current reality |
| 1 | Shared MVP Contract + Browser Shell | `complete` | UI/Contract | Shared filter config, route/page shell, and nav entry are already in place |
| 2 | Tabs, Chips, and Active Filters | `complete` | UI/Behavior | Tabbed family UI, chip selection, selection persistence, Active Filters, single remove, and clear-all are already implemented |
| 3 | Eligibility Filtering | `complete` | Behavior change | Current MVP eligibility logic is implemented and tested using Browser-safe metadata |
| 4 | Pantry-Aware Ranking + Results UX | `complete` | Behavior/UI | Browser ranking already reuses live recommendation truth and ships count, sort explanation, badges, low-result messaging, and honest empty states |
| 5 | MVP Hardening Tests | `complete` | Tests | Contract, eligibility, ranking, and page behavior tests already exist |
| 6 | Revised Contract Reconciliation | `pending` | Analysis/Behavior | Reconcile current MVP `protein` contract and flat family assumptions with the revised ingredient-first, hierarchical target model |
| 7 | Taxonomy + Ingredient Model Expansion | `pending` | Behavior/Data | Add explicit parent/child taxonomy support and define ingredient filtering model without widening into a catalog |
| 8 | Metadata Coverage + Browser Fetch Path Cleanup | `pending` | Behavior/Data | Patch only required metadata/taxonomy coverage and reduce browser-contract / N+1 loading risk |
| 9 | Final Browser Hardening | `pending` | Refactor/Hardening | Lock revised browser behavior with tests, docs, and cleanup once reconciliation lands |

### Important phase truth
- Completed phases were implemented under the earlier MVP model.
- Upcoming phases should not pretend the revised target model is already present.
- Reconciliation should happen before major filter-family expansion.

---

## Next real phases

### Phase 6 - Revised Contract Reconciliation
Expected focus:
- align planning and code around MVP reality vs revised target
- replace `Protein`-centric planning with `Ingredients` as the target family direction
- define which current helpers/configs stay, which need renaming, and which need structural change
- lock parent/child taxonomy semantics before UI expansion

### Phase 7 - Taxonomy + Ingredient Model Expansion
Expected focus:
- define hierarchical taxonomy support
- define ingredient token / ingredient match contract
- decide how taxonomy OR logic and ingredient AND logic coexist cleanly
- keep tabs as broad family organizers rather than the full hierarchy

### Phase 8 - Metadata Coverage + Browser Fetch Path Cleanup
Expected focus:
- patch only the metadata/taxonomy gaps required by the revised contract
- reduce stale MVP assumptions in eligibility helpers
- address browser list + detail hydration risk before deeper browser expansion

### Phase 9 - Final Browser Hardening
Expected focus:
- regression coverage for revised semantics
- docs and stale assumption cleanup
- performance and trust hardening

Recommended sequencing:
1. reconcile contract and semantics first
2. expand taxonomy / ingredient support second
3. patch metadata and fetch-path gaps third
4. harden last

---

## Done criteria for remaining phases

### Phase 6 is done when:
- current MVP behavior and revised target behavior are clearly separated
- the target family model is locked
- taxonomy semantics are explicit
- ingredient matching semantics are explicit
- stale `Protein`-first planning assumptions are removed

### Phase 7 is done when:
- parent taxonomy selections include descendants
- child taxonomy selections narrow correctly
- taxonomy-family multi-select uses OR logic
- ingredient multi-select uses AND logic by default
- the UI/data model can support hierarchy without collapsing into chaos

### Phase 8 is done when:
- required taxonomy and ingredient metadata gaps are patched
- browser data loading is stable enough for the revised model
- silent query loosening has not been introduced
- metadata expansion remains scoped

### Phase 9 is done when:
- revised browser logic is protected by tests
- docs match implementation reality
- stale MVP assumptions have been removed

---

## Risks / watchouts

- plan / implementation drift
- stale MVP assumptions surviving in later code and docs
- turning the browser into a generic catalog experience
- taxonomy sprawl across parent / child / subchild branches
- ingredient explosion that creates brittle matching or noisy UI
- inconsistent metadata causing false matches or missed matches
- browser list + detail hydration becoming an N+1 bottleneck
- silent query loosening to avoid honest empty states
- UI chaos from too many options presented at once
- recommendation-truth drift between browser ranking and core product ranking

---

## Final implementation bias

When forced to choose between:
- broader browsing
- pantry-aware realism

Choose pantry-aware realism.

When forced to choose between:
- more filters
- clearer filters

Choose clearer filters.

When forced to choose between:
- fuzzy matching that "helps"
- strict matching the user can trust

Choose strict matching the user can trust.

When forced to choose between:
- broad expansion
- reconciliation first

Choose reconciliation first.

When forced to choose between:
- clever abstractions
- explicit and testable logic

Choose explicit and testable logic.

When forced to choose between:
- generic browser breadth
- pantry-aware recommendation truth

Choose pantry-aware recommendation truth.

When forced to choose between:
- multiple planning sources
- one current source of truth

Choose one current source of truth.

When forced to choose between:
- visually richer grouping
- stable filter behavior and trustworthy empty states

Choose stable filter behavior first. Visual grouping or tinting can follow later if still useful.
