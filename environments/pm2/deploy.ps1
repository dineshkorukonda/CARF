param (
  [string]$Version = "v1"
)

$EnvDir = $PSScriptRoot
$AppDir = Join-Path $EnvDir "app\$Version"
$CurrentDir = Join-Path $EnvDir "current"

if (-not (Test-Path $AppDir)) {
  Write-Error "Error: Version directory $AppDir does not exist! Available: v1, v2, broken"
  exit 1
}

Write-Host "==> Deploying PM2 sample app version: $Version"

# Update current pointer
if (Test-Path $CurrentDir) {
  Remove-Item -Recurse -Force $CurrentDir
}
Copy-Item -Recurse -Force $AppDir $CurrentDir

# Check PM2 process
$jlist = pm2 jlist 2>$null | Out-String
if ($jlist -match '"name":"sample-pm2-app"') {
  Write-Host "==> Reloading sample-pm2-app in PM2..."
  pm2 reload sample-pm2-app --update-env
} else {
  Write-Host "==> Starting sample-pm2-app in PM2..."
  Push-Location $EnvDir
  try {
    pm2 start ecosystem.config.cjs
  } finally {
    Pop-Location
  }
}

Write-Host "==> Deployment of $Version completed."
