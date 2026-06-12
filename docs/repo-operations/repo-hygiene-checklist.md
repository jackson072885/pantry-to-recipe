# Repo Hygiene Checklist

Use this as a simple repeatable checklist before, during, and after repo work.

## Before changes
- Check current branch.
- Confirm the task scope.
- Run `git status --short`.
- Verify that no unrelated tracked changes will be touched accidentally.

## During changes
- Edit only files relevant to the task.
- Avoid mixing local cleanup with feature work unless explicitly requested.
- Keep generated outputs and local runtime artifacts out of tracked scope.

## After changes
- Run targeted validation only.
- Review `git status --short`.
- Make sure no unrelated files were changed.
- Confirm that generated artifacts are still ignored.

## Local-only artifact reminders
These should generally remain local-only:
- `.venv`
- `node_modules`
- `dist`
- `playwright-report`
- `test-results`
- `.runtime`
- `__pycache__`
- debug/test/temp `.db` files

## Cleanup reminders
- Clean loose temp/debug DBs regularly.
- Do not casually wipe active runtime DBs.
- Do not confuse repo size with source code size; environment folders distort the picture.

## Core checklist rule
Safe branch. Clean scope. Focused edits. Clean status.
