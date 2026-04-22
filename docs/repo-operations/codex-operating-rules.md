# Codex Operating Rules

These rules are meant to preserve safety, reduce wasted credits, and keep execution disciplined.

## Branch safety
- Check the current git branch before making any changes.
- If the current branch does not match the expected branch, stop immediately and report the mismatch.
- If the branch matches, proceed silently.
- Do not spend output on successful branch confirmation beyond noting it in the final summary.
- Do not switch branches automatically unless explicitly instructed.

## Scope control
- Work only within the requested scope.
- Do not make unrelated cleanup changes unless explicitly instructed.
- Do not expand the task just because adjacent issues are visible.

## Stop conditions
- Stop immediately if branch mismatch is detected.
- Stop if the requested action would violate an explicit repo rule.
- Stop if a required file, dependency, or environment assumption is missing and blocks safe completion.
- Report the exact blocker clearly.

## Output discipline
- Do not spend output on obvious passes or routine confirmations.
- Prefer short operational reporting over narration.
- Reserve detail for meaningful decisions, blockers, risks, or final summaries.

## Change discipline
- Inspect relevant existing files before editing.
- Preserve frontend/backend contracts unless the task explicitly changes them.
- Keep edits focused and minimal.
- Do not rewrite working code without reason.

## Git discipline
- Do not auto-commit unless explicitly instructed.
- Do not auto-push unless explicitly instructed.
- Do not switch branches automatically.
- Include file lists and change summaries in the final report when changes are made.

## Testing discipline
- Run only the most relevant validation for the requested change.
- Do not run broad expensive validation when a narrower check is sufficient.
- Report what was run and what was not run.

## Repo principle
Protect safety. Reduce ceremony. Spend credits on decisions, not rituals.
