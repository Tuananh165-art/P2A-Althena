# dev-up.ps1 - Start entire Resilience Copilot stack
$ErrorActionPreference = "Continue"
$base = Split-Path -Parent $PSScriptRoot
$project = Join-Path $base "Matter-to-FIWARE-Monitoring-System"

Write-Host "`n=== Resilience Copilot - Starting Stack ===" -ForegroundColor Cyan

# 1. Kill existing node processes
Write-Host "`n[1/7] Stopping existing Node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Start Docker (Orion + Mongo)
Write-Host "[2/7] Starting Orion + MongoDB (docker compose)..." -ForegroundColor Yellow
Push-Location $project
docker compose up -d
Pop-Location
Start-Sleep -Seconds 5

# Wait for Orion health
$orionReady = $false
for ($i = 0; $i -lt 12; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:1026/version" -TimeoutSec 3 -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            $orionReady = $true
            break
        }
    } catch { }
    Write-Host "  Waiting for Orion..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 3
}
if ($orionReady) {
    Write-Host "  Orion is UP" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Orion not responding on :1026" -ForegroundColor Red
}

# 3. Start Proxy Server
Write-Host "[3/7] Starting Proxy Server (port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$project'; node proxy-server.js" -WindowStyle Minimized
Start-Sleep -Seconds 2

# 4. Start FIMAT Agent
Write-Host "[4/7] Starting FIMAT Agent (port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$project\fimat-agent'; npm start" -WindowStyle Minimized
Start-Sleep -Seconds 2

# 5. Start MCP Agent
Write-Host "[5/7] Starting MCP Agent (port 3002)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$project\mcp-agent'; npm start" -WindowStyle Minimized
Start-Sleep -Seconds 2

# 6. Start Zigbee Bridge (optional - requires MQTT/zigbee2mqtt)
Write-Host "[6/7] Starting Zigbee Bridge (port 3003)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$project\zigbee-bridge'; npm start" -WindowStyle Minimized
Start-Sleep -Seconds 2

# 7. Start Dashboard
Write-Host "[7/7] Starting Dashboard (port 8080)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$project\monitor-dashboard'; npx http-server -p 8080 -c-1" -WindowStyle Minimized

Write-Host "`n=== Stack Starting ===" -ForegroundColor Cyan
Write-Host "  Dashboard:      http://localhost:8080" -ForegroundColor White
Write-Host "  Proxy:          http://localhost:3001" -ForegroundColor White
Write-Host "  FIMAT Agent:    http://localhost:3000" -ForegroundColor White
Write-Host "  MCP Agent:      http://localhost:3002" -ForegroundColor White
Write-Host "  Zigbee Bridge:  http://localhost:3003" -ForegroundColor White
Write-Host "  Orion:          http://localhost:1026" -ForegroundColor White
Write-Host "`nRun scripts\smoke-test.ps1 to verify all services.`n" -ForegroundColor Green
