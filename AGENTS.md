# Pantry-to-Recipe Agent Rules

## Scope
These instructions apply to the entire repository unless a deeper AGENTS.md overrides them.

## Repository Context
- Root: V:\dev\projects\pantry-to-recipe
- Primary stack:
  - FastAPI backend
  - React + Vite + TypeScript frontend
- Core product: Pantry → Recommendation → Decision flow

Agents must always operate relative to this repository root.

---

## Mission
Modify this repository with a product-engineering mindset:
- prioritize **first user value**
- preserve working flows
- avoid unnecessary churn
- improve clarity, not complexity

---

## Branch Safety (MANDATORY)
- Before making ANY edits:
  1. Check the current git branch
  2. Report it explicitly
- If an expected branch is provided and does NOT match:
  - STOP
  - report mismatch
  - do NOT modify files
- Never assume the branch is correct

---

## Stop Conditions (CRITICAL)
Immediately STOP and report if:
- the task would require backend changes but backend is not allowed
- required files are missing or unclear
- changes would impact unrelated parts of the system
- instructions conflict with existing repo behavior
- branch is incorrect

Do not guess. Do not continue blindly.

---

## Scope Control
- Keep changes minimal, scoped, and easy to review
- Do not refactor unrelated files
- Do not redesign unrelated pages
- Do not widen scope without explicit reason
- Prefer surgical improvements over broad rewrites

---

## File and Logic Discipline
- Do NOT create duplicate helper files if one already exists
- Do NOT create duplicate logic paths
- Prefer editing existing code over adding abstraction layers
- Reuse current data contracts and response structures

---

## Frontend / Backend Boundaries
- Prefer frontend-only changes for:
  - Home UX
  - recommendation display
  - CTA clarity
  - first-value optimization

- Do NOT modify backend unless explicitly required

- Always reuse backend-provided fields:
  - best_tonight
  - alternatives
  - grouped buckets
  - explanation fields
  - pantry provenance

---

## Shared Component Caution
- Treat shared components carefully
- Avoid modifying shared UI unless necessary
- If modified:
  - keep changes minimal
  - call out regression risk

---

## Home / Recommendation Product Guidance (IMPORTANT)
When working on Home:

- Optimize for:
  - immediate value on load
  - automatic use of saved pantry
  - strong single “best option” visibility
  - reduced friction

- Rules:
  - If pantry exists → do NOT require manual trigger
  - Show best dinner option FIRST
  - Keep grouped recommendations secondary
  - Avoid setup-first UX patterns

---

## Existing System Awareness
- Search page already auto-loads recommendations correctly
- Backend already provides ranking and best_tonight
- Do NOT recreate logic that already exists

---

## Testing and Validation
After making code changes:
- run relevant commands (build, lint, tests)
- report exactly what was run
- report pass/fail clearly
- do NOT claim validation without running it

---

## Git Hygiene
- Keep commits scoped and readable
- Do NOT mix unrelated changes
- Do NOT rewrite history
- Leave worktree understandable
- Report untracked/unrelated files instead of modifying them

---

## Output Expectations
When finishing a task, always report:

1. branch confirmation
2. files changed
3. exact behavior changes
4. validation performed
5. risks / follow-ups / untouched areas

---

## Do Not Touch By Default
Unless explicitly required:

- backend recommendation ranking logic
- backend routes
- Pantry page internals
- RecipeDetail page
- provider / unrelated product surfaces
- analytics transport layer

---

## Practical Rule
Do the smallest clean thing that solves the actual problem.