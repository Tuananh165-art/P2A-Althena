param(
    [string]$SeedScenario = 'small-batch',
    [ValidateSet('simulator', 'live')]
    [string]$DeviceControlMode = 'simulator',
    [switch]$SkipSeed
)

# Start FIWARE Resilience Monitor - All Services
Write-Host 'Starting all services...' -ForegroundColor Green

$basePath = $PSScriptRoot
$repoRoot = Split-Path $basePath -Parent
$proxyFile = Join-Path $basePath 'proxy-server.js'
$dashboardDir = Join-Path $basePath 'monitor-dashboard'
$mcpAgentDir = Join-Path $basePath 'mcp-agent'
$zigbeeBridgeDir = Join-Path $basePath 'zigbee-bridge'
$openClawDir = Join-Path $basePath 'openclaw-gateway'
$openClawSkillsDir = Join-Path $repoRoot 'openclaw-skills'
$seedImporter = Join-Path $repoRoot 'scripts\import-sim-seed.ps1'
$dashboardPort = 8001
$dashboardUrl = "http://localhost:$dashboardPort"

if (-not (Test-Path $proxyFile)) {
    Write-Host "Missing file: $proxyFile" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $dashboardDir)) {
    Write-Host "Missing folder: $dashboardDir" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $mcpAgentDir)) {
    Write-Host "Missing folder: $mcpAgentDir" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $zigbeeBridgeDir)) {
    Write-Host "Missing folder: $zigbeeBridgeDir" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $openClawDir)) {
    Write-Host "Missing folder: $openClawDir" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $openClawSkillsDir)) {
    Write-Host "Missing folder: $openClawSkillsDir" -ForegroundColor Red
    exit 1
}
if (-not $SkipSeed -and -not (Test-Path $seedImporter)) {
    Write-Host "Missing seed importer: $seedImporter" -ForegroundColor Red
    exit 1
}

# Existing processes are left intact. Each service owns its configured port.

# Start Orion + Mongo via Docker Compose
Write-Host 'Starting Orion + Mongo via docker compose...' -ForegroundColor Yellow
Push-Location $basePath
docker compose rm -sf orion
docker compose up -d
Pop-Location

Write-Host 'Waiting for Orion health on port 1026...' -ForegroundColor Yellow
$orionReady = $false
for ($i = 0; $i -lt 12; $i++) {
    try {
        $health = Invoke-WebRequest -Uri 'http://localhost:1026/version' -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($health.StatusCode -eq 200) {
            $orionReady = $true
            break
        }
    } catch { }
    Start-Sleep -Seconds 3
}
if (-not $orionReady) {
    Write-Host 'Orion did not become ready in time.' -ForegroundColor Red
    exit 1
}

if (-not $SkipSeed) {
    Write-Host "Importing sim seed data ($SeedScenario) into Orion/OpenClaw context..." -ForegroundColor Yellow
    & $seedImporter -Scenario $SeedScenario -OrionUrl 'http://localhost:1026'
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Seed import failed.' -ForegroundColor Red
        exit $LASTEXITCODE
    }
} else {
    Write-Host 'Skipping sim seed import.' -ForegroundColor Yellow
}

# Start Proxy Server in background
Write-Host 'Starting Proxy Server (port 3001)...' -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "Set-Location '$basePath'; node '$proxyFile'" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start FIMAT Agent in background
Write-Host 'Starting FIMAT Agent (port 3000)...' -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "`$env:ENABLE_LEGACY_MATTER_EMULATORS='false'; Set-Location '$basePath\fimat-agent'; npm.cmd start" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Zigbee Bridge in background
Write-Host 'Starting Zigbee Bridge (port 3003)...' -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList '-Command', "Set-Location '$zigbeeBridgeDir'; npm.cmd start" -WindowStyle Hidden

Start-Sleep -Seconds 2

# Start MCP Agent in background
Write-Host "Starting MCP Agent in $DeviceControlMode device mode (port 3002)..." -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList '-Command', "`$env:DEVICE_CONTROL_MODE='$DeviceControlMode'; Set-Location '$mcpAgentDir'; npm.cmd start" -WindowStyle Hidden

Start-Sleep -Seconds 2

# Start OpenClaw Gateway in background
Write-Host 'Starting OpenClaw Gateway (port 3004)...' -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "`$env:OPENCLAW_SKILLS_DIR='$openClawSkillsDir'; Set-Location '$openClawDir'; npm.cmd start" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Dashboard HTTP Server in background
Write-Host "Starting Dashboard (port $dashboardPort)..." -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "Set-Location '$dashboardDir'; npx.cmd -y http-server -a localhost -p $dashboardPort -c-1" -WindowStyle Normal

Write-Host "`nAll services started.`n" -ForegroundColor Green
Write-Host "Dashboard: $dashboardUrl" -ForegroundColor Cyan
Write-Host 'Proxy: http://localhost:3001' -ForegroundColor Cyan
Write-Host 'FIMAT Agent:    http://localhost:3000/health' -ForegroundColor Cyan
Write-Host 'MCP Agent:      http://localhost:3002/health' -ForegroundColor Cyan
Write-Host 'Zigbee Bridge:  http://localhost:3003/health' -ForegroundColor Cyan
Write-Host 'OpenClaw Gateway: http://localhost:3004/health' -ForegroundColor Cyan
Write-Host "`nWaiting 10 seconds for services to warm up..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test services
Write-Host "`nChecking connectivity..." -ForegroundColor Yellow

$proxyTest = $false
$orionTest = $false
$fimatTest = $false
$mcpTest = $false
$zigbeeTest = $false
$openClawTest = $false

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3001/version' -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host 'Proxy Server: OK' -ForegroundColor Green
        $proxyTest = $true
    }
} catch {
    Write-Host 'Proxy Server: FAILED' -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:1026/version' -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host 'Orion: OK' -ForegroundColor Green
        $orionTest = $true
    }
} catch {
    Write-Host 'Orion: FAILED' -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3000/health' -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host 'FIMAT Agent: OK' -ForegroundColor Green
        $fimatTest = $true
    }
} catch {
    Write-Host 'FIMAT Agent: FAILED' -ForegroundColor Red
}

try {
    $zigbeeHealth = Invoke-RestMethod -Uri 'http://localhost:3003/health' -TimeoutSec 3 -ErrorAction Stop
    if ($zigbeeHealth.status -eq 'ok' -and $zigbeeHealth.mqttConnected) {
        Write-Host 'Zigbee Bridge: OK (MQTT connected)' -ForegroundColor Green
        $zigbeeTest = $true
    } else {
        Write-Host 'Zigbee Bridge: RUNNING, MQTT NOT CONNECTED' -ForegroundColor Yellow
    }
} catch {
    Write-Host 'Zigbee Bridge: FAILED' -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3002/health' -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host 'MCP Agent: OK' -ForegroundColor Green
        $mcpTest = $true
    }
} catch {
    Write-Host 'MCP Agent: FAILED' -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3004/health' -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host 'OpenClaw Gateway: OK' -ForegroundColor Green
        $openClawTest = $true
    }
} catch {
    Write-Host 'OpenClaw Gateway: FAILED' -ForegroundColor Red
}

if ($proxyTest -and $orionTest -and $fimatTest -and $zigbeeTest -and $mcpTest -and $openClawTest) {
    Write-Host "`nAll services are running. Open: $dashboardUrl" -ForegroundColor Green
} else {
    Write-Host "`nSome services failed. Check the opened console windows." -ForegroundColor Yellow
}

Write-Host "Keeping services alive. Press Ctrl+C to stop."
while ($true) {
    Start-Sleep -Seconds 1
}
