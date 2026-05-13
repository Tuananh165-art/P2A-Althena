# Start FIWARE Resilience Monitor - All Services
Write-Host 'Starting all services...' -ForegroundColor Green

$basePath = $PSScriptRoot
$proxyFile = Join-Path $basePath 'proxy-server.js'
$emulatorsDir = Join-Path $basePath 'matter-emulators'
$dashboardDir = Join-Path $basePath 'monitor-dashboard'

if (-not (Test-Path $proxyFile)) {
    Write-Host "Missing file: $proxyFile" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $emulatorsDir)) {
    Write-Host "Missing folder: $emulatorsDir" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $dashboardDir)) {
    Write-Host "Missing folder: $dashboardDir" -ForegroundColor Red
    exit 1
}

# Kill existing node processes
Write-Host 'Stopping old Node processes...' -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start Orion + Mongo via Docker Compose
Write-Host 'Starting Orion + Mongo via docker compose...' -ForegroundColor Yellow
Push-Location $basePath
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

# Start Proxy Server in background
Write-Host 'Starting Proxy Server (port 3001)...' -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "Set-Location '$basePath'; node '$proxyFile'" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Matter Emulators in background
Write-Host 'Starting Matter Emulators...' -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "Set-Location '$emulatorsDir'; npm start" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Dashboard HTTP Server in background
Write-Host 'Starting Dashboard (port 8000)...' -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "Set-Location '$dashboardDir'; npx http-server -p 8000" -WindowStyle Normal

Write-Host "`nAll services started.`n" -ForegroundColor Green
Write-Host 'Dashboard: http://localhost:8000' -ForegroundColor Cyan
Write-Host 'Proxy: http://localhost:3001' -ForegroundColor Cyan
Write-Host 'Orion: http://localhost:1026' -ForegroundColor Cyan
Write-Host "`nWaiting 10 seconds for services to warm up..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test services
Write-Host "`nChecking connectivity..." -ForegroundColor Yellow

$proxyTest = $false
$orionTest = $false

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

if ($proxyTest -and $orionTest) {
    Write-Host "`nAll services are running. Open: http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "`nSome services failed. Check the opened console windows." -ForegroundColor Yellow
}

Read-Host -Prompt 'Press Enter to close'