param (
  [string]$Version = "v1"
)

$ErrorActionPreference = "Stop"
$EnvDir = $PSScriptRoot

Write-Host "==> Rolling back sample-pm2-app to: $Version"
& "$EnvDir\deploy.ps1" -Version $Version
Write-Host "==> Rollback to $Version completed."
