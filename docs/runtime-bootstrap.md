# Runtime Bootstrap

## Canonical Truth

- Recipe source of truth: `backend/app/data/recipes_real_v1.json`
- Runtime database: `backend/.runtime/pantry.db`
- Legacy snapshot: `backend/pantry.db` is blocked by default and only usable with an explicit `ALLOW_LEGACY_DATABASE_PATH=true` override

## Actual Startup Flow

On backend startup, the app now does the following in order:

1. creates or migrates the SQLite schema for the configured `DATABASE_URL`
2. validates the canonical JSON dataset before mutating the runtime DB
3. detects drift between the runtime DB and the canonical dataset
4. converges dataset-managed recipes to canonical truth by inserting missing rows, updating changed rows, and pruning stale managed rows
5. backfills recipe quality metadata
6. archives recipes that fail the quality gate

That means the runtime DB is a generated cache of committed source data, not a hidden source of truth.

If dataset validation fails or unresolved drift remains after sync, backend startup now fails loudly instead of continuing with ambiguous state.

## Safe Reset

To rebuild the default local runtime DB from committed data:

```powershell
cd backend
.\reset-local-db.ps1
```

This deletes `backend/.runtime/pantry.db`, recreates the schema, and reseeds from the canonical JSON dataset.

## Drift Guardrails

- use `DATABASE_URL` only when you intentionally want a non-default database
- do not rely on `backend/pantry.db` for normal local startup; it is rejected unless explicitly allowed
- runtime bootstrap records the canonical dataset hash and managed recipe count in `runtime_bootstrap_state`
- dataset-managed recipes carry source identity and payload hashes so repeated startup can detect and repair drift deterministically
- invalid canonical rows fail bootstrap before any recipe writes are committed
