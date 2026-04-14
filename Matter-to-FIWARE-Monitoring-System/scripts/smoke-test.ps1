$ErrorActionPreference = 'Continue'

Write-Host '🧪 [smoke-test] Checking core endpoints...' -ForegroundColor Cyan

$checks = @(
  @{ Name = 'Orion version'; Url = 'http://localhost:1026/version' },
  @{ Name = 'Proxy version'; Url = 'http://localhost:3001/version' },
  @{ Name = 'FIMAT health'; Url = 'http://localhost:3000/health' },
  @{ Name = 'Proxy entities'; Url = 'http://localhost:3001/v2/entities' },
  @{ Name = 'Dashboard'; Url = 'http://localhost:8080' }
)

$fail = 0
foreach ($c in $checks) {
  try {
    $resp = Invoke-WebRequest -Uri $c.Url -UseBasicParsing -TimeoutSec 8
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
      Write-Host "✅ $($c.Name): $($resp.StatusCode)" -ForegroundColor Green
    } else {
      $fail++
      Write-Host "❌ $($c.Name): $($resp.StatusCode)" -ForegroundColor Red
    }
  } catch {
    $fail++
    Write-Host "❌ $($c.Name): FAILED ($($_.Exception.Message))" -ForegroundColor Red
  }
}

Write-Host ''
Write-Host '📦 Entity snapshot:' -ForegroundColor Cyan
try {
  $entities = Invoke-RestMethod 'http://localhost:3001/v2/entities'
  $count = @($entities).Count
  Write-Host "- Total entities: $count" -ForegroundColor Yellow
  foreach ($e in $entities) {
    Write-Host "  - $($e.id) [$($e.type)]" -ForegroundColor Yellow
  }
} catch {
  Write-Host '- Cannot fetch entities' -ForegroundColor Red
}

if ($fail -eq 0) {
  Write-Host ''
  Write-Host '✅ SMOKE TEST PASS' -ForegroundColor Green
  exit 0
} else {
  Write-Host ''
  Write-Host "❌ SMOKE TEST FAIL ($fail checks failed)" -ForegroundColor Red
  exit 1
}
