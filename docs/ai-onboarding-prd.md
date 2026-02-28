# AI-Driven Onboarding PRD (Cookbook App)

## Product Goal
- Time-to-first-value under 2 minutes.
- First-session activation target: user saves at least one recipe generated from pantry items.
- Keep onboarding to 6 screens max with optional skips.

## Core User Promise
- "Tell us what you have and how you eat. We will generate practical recipes you can cook now."

## Primary Success Metrics
- `activation_rate`: % of new users who save a recipe in first session.
- `ttfr_seconds`: median time-to-first-recipe.
- `onboarding_completion_rate`: % users reaching onboarding complete.
- `week1_retention`: % users active again within 7 days.

## Onboarding Flow (Screen-by-Screen)

### 1) Welcome + Intent
- Inputs:
- Goal chips: `cook_now`, `meal_prep`, `budget`, `healthy`.
- CTA: `Start`.
- AI behavior:
- None (fast entry step).
- Exit event:
- `onboarding_started`.

### 2) Preferences Capture
- Inputs:
- Dietary profile (`omnivore`, `vegetarian`, `vegan`, `pescatarian`).
- Allergy/intolerance tags.
- Cooking time preference (`<=15`, `<=30`, `<=45`, `any`).
- Skill level (`beginner`, `intermediate`, `advanced`).
- AI behavior:
- Validate constraints.
- Flag conflicts (for example, selected ingredient conflicts with allergy).
- Exit event:
- `preferences_completed`.

### 3) Pantry Fast Add
- Inputs:
- Text add with autocomplete.
- Optional OCR/photo capture (phase 2).
- Suggested starter chips if pantry is sparse.
- AI behavior:
- Normalize ingredient aliases (`chick peas` -> `chickpeas`).
- Deduplicate and map to canonical pantry tokens.
- Estimate pantry quality score.
- Exit event:
- `pantry_seeded`.

### 4) AI Profile Summary
- UI output:
- One-line profile summary: "Quick high-protein weeknight meals."
- Editable constraints list.
- AI behavior:
- Build lightweight user embedding from selected preferences + pantry signals.
- Confidence gating: if confidence < threshold, ask one clarifying question.
- Exit event:
- `profile_confirmed`.

### 5) First Recipe Generation
- UI output:
- 3 ranked recipes with reason labels:
- `uses_what_you_have`
- `fits_time_limit`
- `matches_diet`
- AI behavior:
- Hard filter: allergies and diet.
- Soft ranking: pantry coverage, time fit, novelty, simplicity.
- Backoff strategy:
- If pantry has < 5 useful items, blend pantry + 1-2 low-cost missing items.
- Exit event:
- `first_recipe_generated`.

### 6) Commit Action (Activation)
- Inputs:
- Save one recipe.
- Optional schedule to meal plan.
- Optional shopping add for missing ingredients.
- AI behavior:
- Generate "next best action" prompt from user behavior.
- Exit event:
- `onboarding_completed`.

## AI Decision Rules
- If user skips preferences, apply safe defaults:
- Time: `<=30`.
- Style: balanced and simple.
- If user rejects recipe suggestion, ask one-tap reason:
- `too_hard`, `too_long`, `dont_like_ingredients`, `not_enough_on_hand`.
- Regenerate with rejection reason weighted as negative signal.
- Ask follow-up questions only when uncertainty is high to limit friction.

## API Contract Proposal (Incremental, Implementation-Friendly)

### Existing APIs to Reuse Now
- `POST /match/v2` for pantry-to-recipe candidate generation.
- `POST /insights/telemetry/event` for onboarding events.
- `POST /insights/telemetry/session/close` for onboarding session close.

### New API Endpoints (Phase 1)
- `POST /onboarding/profile/preview`
- Request:
```json
{
  "diet": "omnivore",
  "allergies": ["peanut"],
  "time_pref": "<=30",
  "skill_level": "beginner",
  "pantry_items": ["eggs", "rice", "onion"]
}
```
- Response:
```json
{
  "summary": "Quick, budget-aware weeknight meals.",
  "confidence": 0.81,
  "clarifying_question": null
}
```

- `POST /onboarding/recipes/first`
- Request:
```json
{
  "session_id": "onb-123",
  "pantry_items": ["eggs", "rice", "onion"],
  "constraints": {
    "diet": "omnivore",
    "allergies": ["peanut"],
    "max_minutes": 30
  }
}
```
- Response:
```json
{
  "recommendations": [
    {
      "recipe_id": 101,
      "recipe_name": "Egg Fried Rice",
      "reasons": ["uses_what_you_have", "fits_time_limit"],
      "missing_ingredients": ["soy sauce"]
    }
  ]
}
```

## Telemetry Event Spec
- `onboarding_started`
- props: `entry_point`, `session_id`.
- `preferences_completed`
- props: `diet`, `allergy_count`, `time_pref`, `skill_level`.
- `pantry_seeded`
- props: `raw_count`, `normalized_count`, `source` (`text|ocr|chips`).
- `profile_confirmed`
- props: `confidence`, `clarification_needed`.
- `first_recipe_generated`
- props: `candidate_count`, `top_recipe_id`, `top_match_score`.
- `recipe_saved`
- props: `recipe_id`, `from_onboarding` (`true`).
- `onboarding_completed`
- props: `duration_seconds`, `steps_completed`.

## Frontend Integration Notes
- Replace current localStorage-only onboarding flags with telemetry-backed progression.
- Keep existing keys for backward compatibility:
- `onboarding_search_visited`
- `onboarding_cooked_recipe`
- Add onboarding session id utility (same style as provider session id generation).
- Progressively enhance: if onboarding endpoints are unavailable, fallback to current search flow.

## Rollout Plan
1. Phase 1 (1 sprint): onboarding flow UI + event tracking + reuse `match/v2`.
2. Phase 2 (1 sprint): pantry OCR and profile preview endpoint.
3. Phase 3 (ongoing): ranking improvements from rejection feedback loop.

## Acceptance Criteria
- New user can complete onboarding and save first recipe in under 2 minutes median.
- At least 95% of onboarding sessions emit start and close telemetry events.
- First recipe generation returns within 1.5s p95 for normal pantry payloads.
- No allergy-violating recipe appears in recommended top 3 when allergies are provided.
