# First-User Test Script

## Purpose

Find out whether a real person can understand Pantry to Plate without the builder explaining it.

If the tester needs an explanation, log that as a product failure.

## Setup

- Use a fresh browser session when possible.
- Add the hosted private-demo URL before sending the script:
  - `Hosted app URL: <paste private demo URL here>`
- Ask the tester to think out loud.
- Do not coach them through the flow.
- Do not explain what the app is supposed to do until the end.

## Task

1. Open the app.
2. Add 3 to 5 things that are actually in your kitchen right now.
3. Try to figure out what you could cook for dinner tonight.
4. Open one recipe that looks most useful.
5. Decide whether you trust the recommendation.
6. Say where you got stuck, hesitated, or stopped trusting it.

## Questions

- Did it help you decide what to cook?
- Where did you get stuck?
- Did you trust the recommendation?
- What did you think this app was for?
- Did you know what to do first?
- Did you trust the top match?
- Was anything confusing?
- Would you use it again?
- What would have made it easier?

## If It Breaks

Ask the tester to send:

- Device and browser.
- Pantry items they entered.
- Screenshot of the problem.
- Time of failure.
- What they expected to happen next.

## Feedback Buckets

Tag each note into one bucket:

- `blocker`
- `recommendation trust`
- `recipe detail`
- `UX friction`
- `feature request`
- `out-of-scope`

## Friction Log

| Field | Notes |
| --- | --- |
| User type |  |
| Pantry items entered |  |
| Time to first useful recipe |  |
| Where they hesitated |  |
| Trust issue |  |
| Bug, UX, or data issue |  |
| Severity |  |
| Follow-up action |  |

## Severity Guide

- `P0`: Blocks the user from getting any dinner answer.
- `P1`: Produces a misleading or untrusted dinner answer.
- `P2`: Causes hesitation but the user can continue.
- `P3`: Polish issue that does not affect the core decision.

## Observer Notes

- Watch whether Dinner Tonight, Your Pantry, Tonight's Matches, Recipe Browser, and Recipe Detail feel connected.
- Watch whether the tester understands unknown quantities as "check this" instead of "the app ignored me."
- Watch whether the tester believes the top match is actually cookable.
- Watch whether the tester can tell what happens when they press cook.
