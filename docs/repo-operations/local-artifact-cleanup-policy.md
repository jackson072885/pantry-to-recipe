# Local Artifact Cleanup Policy

This document defines what should stay local-only, what is usually safe to delete, and what should not be deleted casually.

## Purpose
The repo folder contains both real project assets and local development artifacts. These should not be treated the same way.

## Keep in repo scope
These belong to the actual project:
- source code
- docs
- configs
- scripts
- intentional canonical seed or dataset files
- standards documents

## Local-only artifacts
These are normal locally but should not be treated as durable repo assets:
- `.venv`
- `node_modules`
- `dist`
- `playwright-report`
- `test-results`
- `.runtime`
- `__pycache__`
- temporary/debug/test database files

## Usually safe to delete
When not actively needed, these are strong cleanup candidates:
- loose debug/test/temp `.db` files
- generated Playwright output
- build output folders
- one-off analysis folders
- temporary logs or transient verification artifacts

## Do not delete casually
These require extra caution:
- tracked source files
- active runtime databases
- current working datasets
- intentional seed/canonical data
- anything currently being used by an active prompt run

## Cleanup decision rule
- If it is generated, local-only, and reproducible, it is usually safe to delete.
- If it is tracked, canonical, or currently active, leave it alone unless the task explicitly calls for cleanup.

## Repo principle
Keep source truth clean. Keep local clutter controlled. Do not confuse the two.
