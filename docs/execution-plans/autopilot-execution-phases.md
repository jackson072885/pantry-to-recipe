# Autopilot Execution Phases

## Purpose

This document converts the Autopilot strategy into a safe future build sequence.

This is not immediate scope creep.

This roadmap exists so the idea can be advanced later without wrecking the current product.

---

# Current Rule

Do not build Autopilot features until the current core is trustworthy.

Current core still comes first:

- recipe existence doctrine
- recipe database quality
- recommendation honesty
- pantry matching
- dinner surfacing
- Recipe Browser
- Recipe Detail
- Cook action trust

---

# Branch Rule

Autopilot work belongs on:

> feature/home-first-value

Recipe doctrine work belongs on:

> feature/recipe-doctrine-upgrade

Do not mix these unless the change is intentionally cross-cutting and reviewed first.

---

# Phase 0 — Strategy Lock

Status:

> Started.

Existing docs:

- docs/product-strategy/pantry-to-plate-autopilot-north-star.md
- docs/execution-plans/autopilot-execution-phases.md

Goal:

Lock the product thesis before code.

Key sentence:

> Context in. Best move out.

---

# Phase 1 — Situation Tags Planning

Change type:

> Docs-only.

Goal:

Plan recipe metadata needed for situation-aware recommendations.

Candidate fields:

- time_bucket
- cleanup_level
- effort_level
- budget_level
- kid_fit
- comfort_level
- leftover_value
- emergency_fit
- no_thaw_fit
- pantry_staple_fit

Rules:

- do not tag the entire database at once
- start with a small pilot set
- only tag doctrine-reviewed or obvious recipes
- bad tags create bad trust

Suggested output:

- docs/execution-plans/autopilot-phase-1-situation-tags-plan.md

---

# Phase 2 — Situation Metadata Pilot

Change type:

> Backend data + tests only.

Goal:

Add situation metadata to a small trusted recipe pilot set.

Allowed scope:

- recipe data
- metadata validation tests
- no UI
- no recommendation behavior change unless explicitly planned

Hard rule:

If metadata is uncertain, leave it blank.

---

# Phase 3 — Energy-Aware Ranking MVP

Change type:

> Backend behavior change.

Goal:

Use situation metadata to avoid recommending meals that are technically possible but wrong for tonight.

Core shift:

> Can make

to:

> Should make tonight

Inputs:

- cook time
- effort level
- cleanup level
- pantry fit
- missing ingredients
- confidence
- pressure state, later

Output:

- safer ranking
- clearer explanation
- honest downgrade for high-effort meals

---

# Phase 4 — Save Dinner Backend MVP

Change type:

> Backend feature.

Goal:

Create a decision endpoint/service that accepts pressure states and returns one best move.

Possible pressure states:

- exhausted
- broke
- ten_minutes
- no_dishes
- kid_chaos
- forgot_to_thaw
- comfort_needed
- need_leftovers
- pantry_staples_only

Output object:

- recipe_id
- title
- confidence
- why_this_works_tonight
- pressure_matches
- tradeoffs
- missing_items
- estimated_time
- cleanup_level
- effort_level
- CTA

Rule:

One strong answer beats many weak answers.

Honesty fallback:

> No strong Save Dinner match tonight.

---

# Phase 5 — Save Dinner UI MVP

Change type:

> Frontend feature.

Goal:

Add a simple Save Dinner entry point.

Best location:

- Home / Tonight page

UI copy:

> Save Dinner

Subtitle:

> Tell us what kind of night this is. We'll give you the move.

Flow:

1. User taps Save Dinner.
2. User selects up to three pressure chips.
3. App shows one recommendation.
4. App explains why it fits tonight.
5. User can cook, view recipe, or change constraints.

UX rule:

This is not a filter panel.

It should feel like triage.

---

# Phase 6 — Feedback Memory MVP

Change type:

> Backend + frontend light behavior.

Goal:

Collect one-tap feedback after cooking.

Feedback options:

- Worked tonight
- Too much work
- Not worth it
- Kid liked it
- Kid rejected it
- Good emergency meal
- Good cheap meal
- Good comfort meal
- Good leftovers
- Would cook again

Purpose:

This becomes the early Household Memory layer.

Rule:

Do not ask for too much.

One tap first. Optional detail later.

---

# Phase 7 — Leftover Transformation Engine

Change type:

> New utility feature.

Goal:

Let users rebuild cooked leftovers into new meals.

Product phrase:

> Do not reheat it. Rebuild it.

Inputs:

- leftover chicken
- leftover rice
- leftover beef
- leftover pasta
- leftover vegetables
- leftover beans
- leftover taco meat

Output:

- fastest option
- cheapest option
- best kid-safe option
- best next-day lunch option

Why this phase matters:

It saves money, reduces waste, and makes the app useful beyond the first dinner.

---

# Phase 8 — Household Memory Expansion

Change type:

> Personalization layer.

Goal:

Turn feedback and cooking history into smarter household recommendations.

Memory should power:

- Save Dinner
- Energy-Aware Ranking
- Leftover Transformation
- Dinner Negotiation
- Recovery Mode

Rule:

Household Memory is not just a feature.

It is the brain.

---

# Phase 9 — Dinner Negotiation / Family Consensus

Change type:

> Multiplayer/household feature.

Goal:

Help multiple people agree on dinner.

Flow:

1. Select who is eating.
2. Show candidate meals.
3. Each person reacts quickly.
4. App finds the lowest-resistance option.

Reactions:

- yes
- no
- not tonight
- too heavy
- too much cleanup
- too spicy
- only with a swap

Output:

- best compromise
- lowest-resistance dinner
- split meal option
- one-person priority option
- why this is the best agreement

Strategic value:

This is the best network-effect moat.

---

# Phase 10 — Recovery Mode

Change type:

> Advanced behavior layer.

Goal:

Recognize when the user's food rhythm is breaking and help stabilize them.

Signals:

- no cooking for days
- repeated emergency mode usage
- abandoned recipes
- increased waste
- repeated low-energy selections
- skipped meal planning
- pantry decay risk

Output:

- three-day reset
- emergency dinner
- cheap comfort meal
- leftover-building meal
- pantry rescue action
- simple restock suggestion

Tone rule:

No guilt.

No shame.

No "you failed."

The app should say:

> You are not in optimization mode. Let's stabilize.

---

# Phase 11 — Fridge Vision Exploration

Change type:

> Research only at first.

Goal:

Explore camera-assisted fridge understanding.

Do not build early.

Risk:

- high technical difficulty
- high trust risk
- misidentification damages confidence
- freshness prediction is hard

Rule:

Only consider after the app has strong trust and usage.

---

# Phase 12 — Explicit Non-Goals

Do not prioritize:

- local kitchen economy
- marketplace behavior
- neighbor food trading
- paid meal prep seller network
- social media recipe feed
- full smart-fridge dependency
- generic AI recipe generator
- giant meal planner before Save Dinner works

---

# Future Codex Kickoff Template

Use this before any Autopilot implementation wave:

Set-Location "V:\dev\projects\pantry-to-recipe"
git switch feature/home-first-value
git status --short
git branch --show-current

Required Codex guardrails:

- Confirm branch is feature/home-first-value.
- Confirm worktree is clean.
- Stop if dirty.
- Do not touch recipe doctrine branch.
- Do not edit unrelated files.
- Classify the change.
- List inspected files.
- List changed files.
- Provide exact commands run.
- Provide exact tests run.
- Keep the wave small.
- Prefer docs-only planning before behavior changes.

---

# Recommended Build Sequence

1. Finish current recipe quality and recommendation trust.
2. Lock situation tag plan.
3. Add pilot situation metadata.
4. Add Energy-Aware Ranking.
5. Add Save Dinner backend.
6. Add Save Dinner UI.
7. Add Feedback Memory.
8. Add Leftover Transformation.
9. Expand Household Memory.
10. Add Dinner Negotiation.
11. Add Recovery Mode.
12. Research Fridge Vision.