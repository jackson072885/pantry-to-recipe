$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$runtimeDir = Join-Path $PSScriptRoot ".runtime"
$databasePath = Join-Path $runtimeDir "pantry.db"

if (Test-Path $databasePath) {
    Remove-Item -LiteralPath $databasePath -Force
}

if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}

Write-Host "Rebuilding local runtime database at $databasePath" -ForegroundColor Cyan
python -c "import json; from app.services.runtime_bootstrap_service import bootstrap_runtime_state; summary = bootstrap_runtime_state(); compact = {'database_path': summary['database_path'], 'canonical_recipe_source': summary['canonical_recipe_source'], 'legacy_database_exists': summary['legacy_database_exists'], 'seed': {'created': summary['seed']['seed']['created'], 'updated': summary['seed']['seed']['updated'], 'total_source': summary['seed']['seed']['total_source'], 'archived_legacy_count': summary['seed']['seed']['archived_legacy_count']}, 'quality_counts': summary['seed']['quality']['counts'], 'archived_flagged_count': summary['seed']['archive']['archived_count']}; print(json.dumps(compact, indent=2, sort_keys=True))"
