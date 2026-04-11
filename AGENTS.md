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

## Change Classification (MANDATORY)
Before making edits, classify the requested work as one of the following:

- UI-only: layout, styling, copy, hierarchy, rendering states
- Refactor: code cleanup or extraction with no intended behavior change
- Behavior change: affects data flow, lifecycle, fetch timing, persistence, state orchestration, or user flow

Rules:
- Do NOT mix categories unless explicitly instructed
- If the task crosses categories → STOP and report before making changes

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
- requested work crosses change classification boundaries

When stopping, report:
1. why the task cannot be completed within scope
2. which file(s) or system area would need to change
3. whether the issue is:
   - missing files
   - wrong branch
   - conflicting instructions
   - scope mismatch
4. the smallest safe next step to proceed

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

If modification is required:
- explain why a page-local change was insufficient
- minimize the change surface
- explicitly call out regression risk

---

## Home / Recommendation Product Guidance (IMPORTANT)
When working on Home:

Optimize for:
- immediate value on load
- automatic use of saved pantry
- strong single “best option” visibility
- reduced friction

Rules:
- Preserve existing automatic saved-pantry behavior unless explicitly instructed to change it
- Show best dinner option FIRST
- Keep grouped recommendations secondary
- Avoid setup-first UX patterns

---

## Existing System Awareness
- Search page already auto-loads recommendations correctly
- Backend already provides ranking and best_tonight
- Do NOT recreate logic that already exists

---

## UI-Only Task Guardrails
For tasks explicitly scoped to UI polish, visual hierarchy, microcopy, CTA clarity, or presentation improvements:

- Do NOT change data-loading flow
- Do NOT introduce new useEffect control flow, refs, callbacks, or persistence behavior
- Do NOT change fetch timing, retry logic, onboarding triggers, or saved pantry boot behavior
- Do NOT refactor lifecycle logic
- Keep changes focused on layout, styling, copy, hierarchy, and rendering states only

Critical rule:
- Any change affecting data flow, loading sequence, or state orchestration is a **behavior change**, not a UI-only change

If a behavior change appears necessary:
- STOP
- report it
- do NOT implement it silently

---

## Testing and Validation
After making code changes:
- Run the smallest relevant validation first
- Expand to broader validation only if needed
- Use existing repo commands

Must report:
- exact commands run
- pass/fail results

Rules:
- Do NOT claim validation without running it
- If manual/browser verification was NOT performed, explicitly state that

---

## Git Hygiene
- Keep commits scoped and readable
- Do NOT mix unrelated changes
- Do NOT rewrite history
- Leave worktree understandable

Staging rules:
- Stage ONLY files directly related to the task
- Do NOT stage:
  - local tooling files
  - temp files
  - unrelated repo cleanup

Commit guidance:
- Recommend a commit message that reflects:
  - change type (feat/refactor/chore)
  - scope (e.g., home)
  - intent of change

---

## Output Expectations
When finishing a task, always report:

1. branch confirmation
2. change classification (UI-only / refactor / behavior change)
3. files changed
4. exact user-visible behavior changes
5. validation performed (commands + results)
6. risks / follow-ups / untouched areas

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

---

## Windows ripgrep rule for Codex App Local

On Windows in the Codex app for this repo, do not use plain `rg`.

Reason:
Plain `rg` may resolve to the bundled Codex app executable under:
`C:\Program Files\WindowsApps\OpenAI.Codex_...\app\resources\rg.exe`
That copy can fail with `Access is denied`.

Do not use the bundled Codex app `rg.exe` under `C:\Program Files\WindowsApps\OpenAI.Codex_...\app\resources\rg.exe`.

Use this exact ripgrep executable instead for all repo searches:
`C:\Users\user\AppData\Local\Microsoft\WinGet\Links\rg.exe`

Examples:

```powershell
& "C:\Users\user\AppData\Local\Microsoft\WinGet\Links\rg.exe" --version
& "C:\Users\user\AppData\Local\Microsoft\WinGet\Links\rg.exe" -n "selectBestDinnerOption" .
```
