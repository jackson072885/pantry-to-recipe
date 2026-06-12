# Dinner Tonight Provider Smoke Path

This is a manual local smoke path for the Dinner Tonight external recipe provider. It must not be used by automated tests, and it must not require committing provider keys.

## Safety Rules

- `EXTERNAL_RECIPE_PROVIDER=disabled` is the safe default.
- Store real keys only in an untracked local `backend/.env` file or a temporary PowerShell session.
- Never paste real keys into docs, tests, commits, screenshots, or issue comments.
- Do not add live external API calls to automated tests.
- Live provider smoke checks may use provider quota or rate limits.

## Start The Backend

From the repository root:

```powershell
Set-Location "V:\dev\projects\pantry-to-recipe\backend"
.\run-backend.ps1
```

The local API is expected at `http://127.0.0.1:8000`. Restart the backend after changing provider environment variables.

## Default Disabled Smoke

In a new PowerShell session, leave the provider disabled:

```powershell
$env:EXTERNAL_RECIPE_PROVIDER = "disabled"
$env:SPOONACULAR_API_KEY = ""
```

Then run the request below. The expected response has `provider_status` set to `disabled`; the app should continue using internal saved-pantry matches.

## Missing-Key Smoke

To confirm missing-key behavior without exposing a secret:

```powershell
$env:EXTERNAL_RECIPE_PROVIDER = "spoonacular"
$env:SPOONACULAR_API_KEY = ""
```

Restart the backend and run the request below. The expected response has `provider_status` set to `missing_api_key`, with no key name or secret value exposed to users.

## Manual Live Provider Smoke

Only for local manual verification:

```powershell
$env:EXTERNAL_RECIPE_PROVIDER = "spoonacular"
$env:SPOONACULAR_API_KEY = "<your-local-key>"
```

Restart the backend, then run the request below. This path may call the live provider and may consume quota.

## Smoke Request

```powershell
$body = @{
  ingredients = @("chicken", "rice", "onion", "egg")
  limit = 5
} | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/dinner-tonight/candidates" `
  -ContentType "application/json" `
  -Body $body

$data = $response.data
[pscustomobject]@{
  provider_status = $data.provider_status
  best_title = $data.best.title
  best_feasibility_bucket = $data.best.feasibility_bucket
  candidates_count = @($data.candidates).Count
  alternatives_count = @($data.alternatives).Count
  error_message = $data.error_message
}
```

Useful smoke fields:

- `provider_status`
- `best.title`, when a best candidate exists
- `best.feasibility_bucket`, when a best candidate exists
- `candidates` count
- `alternatives` count
- `error_message`, when the provider fails safely

## Automated Validation

Automated tests stay deterministic and mocked. From `backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q app\tests\test_dinner_tonight_candidates_route.py app\tests\test_external_recipe_service.py
```
