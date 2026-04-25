# Autopilot Execution Phases

## Purpose

This document breaks the Pantry to Plate Autopilot vision into safe, buildable phases.

This is not immediate scope creep.

This is a future execution map that keeps the dream organized while the current app continues improving.

## Current Priority Reminder

Before implementing Autopilot features, the current core must keep getting stronger:

- Recipe database quality
- Recipe existence doctrine
- Recommendation honesty
- Recipe Browser filtering
- Dinner surfacing
- Pantry matching
- Recipe Detail clarity
- Cook action trust

Autopilot should be layered on top of a trustworthy core, not used to hide weak foundations.

---

# Phase 0 — Strategy Lock

## Goal

Create written product doctrine for Autopilot before code begins.

## Deliverables

- North Star document
- Execution phases document
- Feature names and product thesis
- Clear build order
- Clear non-goals

## Status

Ready to create as docs-only.

## Files

- docs/product-strategy/pantry-to-plate-autopilot-north-star.md
- docs/execution-plans/autopilot-execution-phases.md

## Change Type

Docs-only.

---

# Phase 1 — Situation Tags Foundation

## Goal

Add the metadata needed for situation-aware recommendations.

This phase does not build a big UI.

It prepares the recipe data and recommendation logic to understand what kind of night a recipe fits.

## Candidate Recipe Metadata

Each recipe may eventually support:

- time_bucket
  - under_10
  - under_15
  - under_30
  - project_meal

- cleanup_level
  - low
  - medium
  - high

- effort_level
  - very_low
  - low
  - medium
  - high

- budget_level
  - cheap
  - moderate
  - expensive

- kid_fit
  - kid_safe
  - kid_possible
  - adult_leaning
  - not_kid_friendly

- comfort_level
  - light
  - normal
  - comfort
  - heavy_comfort

- leftover_value
  - none
  - okay
  - strong
  - planned_leftovers

- emergency_fit
  - true
  - false

- no_thaw_fit
  - true
  - false

- pantry_staple_fit
  - true
  - false

## Deliverables

- Decide metadata names
- Add tests for metadata validity
- Avoid applying to all recipes manually at first
- Start with a small pilot set of trusted recipes

## Risk

Bad tags will create bad trust.

## Rule

Only tag recipes where the metadata is obvious or doctrine-reviewed.

---

# Phase 2 — Autopilot Decision Engine MVP

## Goal

Build a backend decision layer that can choose one dinner recommendation based on situation constraints.

## Inputs

- Pantry contents
- Recipe eligibility
- Cook time
- Missing ingredients
- Situation tags
- User-selected pressure state

Example pressure states:
- exhausted
- broke
- no_dishes
- ten_minutes
- kid_chaos
- forgot_to_thaw
- comfort_needed
- need_leftovers
- pantry_staples_only

## Output

One recommendation object:

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

## Rule

Autopilot should prefer one strong answer over many weak answers.

## Hard Stop

If no strong fit exists, return honest fallback:

"No strong Save Dinner match tonight."

Then suggest:
- remove one constraint
- open Recipe Browser
- try pantry-staple fallback
- search for missing item handoff

---

# Phase 3 — Save Dinner UI MVP

## Goal

Add a user-facing entry point without redesigning the whole app.

## Best First Location

Home page / Tonight page.

## UI Concept

Button:
"Save Dinner"

Subtitle:
"Tell us what kind of night this is. We'll give you the move."

## Flow

1. User taps Save Dinner.
2. User selects up to three pressure chips.
3. App shows one recommendation.
4. App explains why it fits tonight.
5. User can cook, view recipe, or change constraints.

## Pressure Chips

- I'm exhausted
- I'm broke
- I have 10 minutes
- No dishes
- Kids are picky tonight
- Forgot to thaw meat
- Need comfort food
- Need healthy-ish
- Need leftovers tomorrow
- Almost nothing here

## UX Principle

This should not feel like a filter panel.

It should feel like triage.

---

# Phase 4 — Feedback Memory

## Goal

Collect lightweight signals after meals so the app gets smarter.

## Feedback Options

After Cook action:

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

## Why This Matters

This becomes the early Household Taste Graph without needing full user profiles yet.

## Rule

Do not ask for too much feedback.

One-tap feedback first.
Optional detail later.

---

# Phase 5 — Leftover Transformation Engine

## Goal

Let users turn cooked leftovers into new meals.

## UX Concept

Button:
"Rebuild Leftovers"

User selects:
- leftover chicken
- leftover rice
- leftover beef
- leftover pasta
- leftover vegetables
- leftover beans
- leftover taco meat

App returns:
- 3 transformation ideas
- fastest option
- cheapest option
- best kid-safe option
- best next-day lunch option

## Product Phrase

"Don't reheat it. Rebuild it."

## Why This Comes Before Full Family Mode

It is highly practical, easier to build, and directly supports food waste reduction.

---

# Phase 6 — Family Taste Map

## Goal

Start modeling household preferences.

## Simple Version

Profiles:
- Me
- Partner
- Kid 1
- Kid 2
- Guest

Signals:
- likes
- dislikes
- accepts
- rejects
- texture issue
- spice tolerance
- visible vegetable issue
- cleanup sensitivity

## Output

Recipe cards can eventually show:
- 92% family fit
- kid-safe with swap
- adult meal
- split meal
- high conflict risk
- safe fallback

## Rule

Start simple.
Do not build a giant social network.

---

# Phase 7 — Dinner Negotiation Mode

## Goal

Help multiple people agree on dinner.

## Flow

1. Select who's eating.
2. App shows candidates.
3. Each person reacts quickly.
4. App finds the lowest-resistance dinner.

## Reactions

- yes
- no
- not tonight
- too heavy
- too much cleanup
- too spicy
- sounds good
- only with a swap

## Output

- Best compromise
- Lowest resistance meal
- Split meal option
- One-person priority option
- Why this is the best agreement

## Strategic Value

This is the biggest social growth feature.

One user can pull in the household.

---

# Phase 8 — Recovery Mode

## Goal

Recognize when the user's food rhythm is breaking and help stabilize them.

## Detection Signals

- No cooking for several days
- Repeated emergency mode usage
- Frequent abandoned recipes
- Increased waste
- Repeated low-energy selections
- Skipped meal planning
- Pantry decay risk

## Output

3-day reset:
- one emergency dinner
- one cheap comfort meal
- one leftover-building meal
- one pantry rescue action
- one simple restock suggestion

## Tone Rule

No guilt.
No shame.
No "you failed."

The app should say:
"You are not in optimization mode. Let's stabilize."

---

# Phase 9 — Fridge Vision Timeline

## Goal

Use camera scans to understand the physical kitchen.

## Long-Term Capabilities

- Detect visible ingredients
- Track freshness
- Flag likely waste
- Suggest use-soon meals
- Identify repeated waste patterns

## Risk

High technical difficulty.
High trust risk.
Misidentification can damage confidence.

## Rule

Do not build early.

---

# Final Build Order Recommendation

1. Finish current recipe quality and recommendation trust.
2. Add situation metadata foundation.
3. Build Save Dinner backend MVP.
4. Add Save Dinner UI.
5. Add lightweight feedback memory.
6. Add leftover transformation.
7. Add family taste profiles.
8. Add dinner negotiation.
9. Add recovery mode.
10. Explore fridge vision only after trust and usage are strong.
