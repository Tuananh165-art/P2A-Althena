param(
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

Write-Host '🚀 [dev-up] Starting Resilience Copilot stack...' -ForegroundColor Green

# 1) Infrastructure
Write-Host '1/5 Starting Orion + Mongo (docker compose)...' -ForegroundColor Cyan
docker compose up -d | Out-Host

# 2) Optional install
if (-not $NoInstall) {
  Write-Host '2/5 Installing dependencies (if needed)...' -ForegroundColor Cyan
  Push-Location (Join-Path $root 'matter-emulators')
  npm install | Out-Host
  Pop-Location

  Push-Location (Join-Path $root 'fimat-agent')
  npm install | Out-Host
  Pop-Location

  Push-Location (Join-Path $root 'monitor-dashboard')
  try { npm install | Out-Host } catch { Write-Host 'monitor-dashboard has no npm deps or install skipped.' -ForegroundColor Yellow }
  Pop-Location
}

# 3) Kill occupied ports
Write-Host '3/5 Cleaning occupied ports (3000,3001,8080)...' -ForegroundColor Cyan
$ports = @(3000,3001,8080)
foreach ($p in $ports) {
  $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    try {
      Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
      Write-Host "  - killed PID $($conn.OwningProcess) on port $p" -ForegroundColor Yellow
    } catch {}
  }
}

# 4) Start app services
Write-Host '4/5 Starting app services...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; node proxy-server.js"
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\matter-emulators'; npm start"
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\fimat-agent'; npm start"
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\monitor-dashboard'; npx http-server -p 8080"

# 5) Quick checks
Write-Host '5/5 Running quick checks...' -ForegroundColor Cyan
Start-Sleep -Seconds 5

function Test-Endpoint($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) {
      Write-Host "  ✅ $url" -ForegroundColor Green
      return $true
    }
  } catch {}
  Write-Host "  ❌ $url" -ForegroundColor Red
  return $false
}

$ok1 = Test-Endpoint 'http://localhost:1026/version'
$ok2 = Test-Endpoint 'http://localhost:3001/version'
$ok3 = Test-Endpoint 'http://localhost:3000/health'
$ok4 = Test-Endpoint 'http://localhost:8080'

Write-Host ''
if ($ok1 -and $ok2 -and $ok3 -and $ok4) {
  Write-Host '🎉 Stack is up. Open dashboard: http://localhost:8080' -ForegroundColor Green
} else {
  Write-Host '⚠️ Some services are not ready yet. Re-run scripts/smoke-test.ps1 after ~10s.' -ForegroundColor Yellow
}
