param (
  [string]$Version = "v1"
)

$EnvDir = $PSScriptRoot

Write-Host "==> [Docker Environment] Deploying version: $Version"

# Build image
Write-Host "==> Building Docker image carf-sample-app:$Version..."
docker build `
  --build-arg "VERSION=$Version" `
  -t "carf-sample-app:$Version" `
  -f "$EnvDir\Dockerfile" `
  "$EnvDir"

# Launch / recreate container
Write-Host "==> Running docker compose up for version: $Version..."
$env:APP_VERSION = $Version
docker compose -f "$EnvDir\compose.yml" up -d --force-recreate sample-app

Write-Host "==> Deployment of $Version completed."
