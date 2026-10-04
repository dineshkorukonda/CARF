param (
  [int]$Port = 8080
)

$ContainerName = "carf-sample-docker-app"
$HealthUrl = "http://localhost:$Port/health"

Write-Host "==> Inspecting Docker container state:"
$inspect = docker inspect --format='{{.State.Status}}' $ContainerName 2>$null
if (-not $inspect -or $LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] Container $ContainerName not found or docker inspect failed"
  exit 1
}

Write-Host "Container Status: $inspect"
if ($inspect.Trim() -ne "running") {
  Write-Host "[FAIL] Container is not running: $inspect"
  exit 1
}

Write-Host "==> HTTP Probe: $HealthUrl"
$passed = $false
try {
  $res = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 3
  if ($res.status -eq "ok") {
    Write-Host "[OK] Health check passed (HTTP 200, status=ok, version=$($res.version))"
    $passed = $true
  } else {
    Write-Host "[FAIL] Health check returned unhealthy status"
  }
} catch {
  Write-Host "[FAIL] Health check request failed: $($_.Exception.Message)"
}

if ($passed) {
  exit 0
} else {
  exit 1
}
