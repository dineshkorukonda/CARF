param (
  [int]$Port = 3301
)

$HealthUrl = "http://127.0.0.1:$Port/health"

Write-Host "==> PM2 Process Check:"
$jlist = pm2 jlist 2>$null | Out-String
if ($jlist -match '"name":"sample-pm2-app"') {
  Write-Host "[OK] Process found in PM2"
} else {
  Write-Host "[FAIL] Process 'sample-pm2-app' not found in PM2"
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
