param (
  [string]$Version = "v1"
)

$EnvDir = $PSScriptRoot

Write-Host "==> [Docker Environment] Rolling back container to previous image version: $Version"

$env:APP_VERSION = $Version
docker compose -f "$EnvDir\compose.yml" up -d --force-recreate sample-app

Write-Host "==> Rollback to $Version completed."
