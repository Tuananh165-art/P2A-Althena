# smoke-test.ps1 - Verify all services are running
$base = Split-Path -Parent $PSScriptRoot
$project = Join-Path $base "Matter-to-FIWARE-Monitoring-System"

$pass = 0
$fail = 0

function Test-Endpoint {
    param([string]$Name, [string]$Url, [int]$ExpectedStatus = 200)
    try {
        $r = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -ErrorAction Stop -UseBasicParsing
        if ($r.StatusCode -eq $ExpectedStatus) {
            Write-Host "  PASS  $Name ($Url)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  FAIL  $Name - Status $($r.StatusCode)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  FAIL  $Name - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Write-Host "`n=== Smoke Test ===" -ForegroundColor Cyan

# Orion
if (Test-Endpoint "Orion /version" "http://localhost:1026/version") { $pass++ } else { $fail++ }

# Proxy
if (Test-Endpoint "Proxy /version" "http://localhost:3001/version") { $pass++ } else { $fail++ }
if (Test-Endpoint "Proxy /v2/entities" "http://localhost:3001/v2/entities") { $pass++ } else { $fail++ }

# FIMAT Agent
if (Test-Endpoint "FIMAT /health" "http://localhost:3000/health") { $pass++ } else { $fail++ }

# MCP Agent
if (Test-Endpoint "MCP /health" "http://localhost:3002/health") { $pass++ } else { $fail++ }
if (Test-Endpoint "MCP /risk" "http://localhost:3002/risk") { $pass++ } else { $fail++ }

# Dashboard
if (Test-Endpoint "Dashboard" "http://localhost:8080") { $pass++ } else { $fail++ }

# Entity checks
Write-Host "`n--- Entity Checks ---" -ForegroundColor Cyan
try {
    $entities = Invoke-RestMethod -Uri "http://localhost:1026/v2/entities" -TimeoutSec 5 -ErrorAction Stop
    $hasHumidity = $entities | Where-Object { $_.type -eq "HumiditySensor" }
    $hasPlug = $entities | Where-Object { $_.type -eq "SmartPlug" }

    if ($hasHumidity) {
        Write-Host "  PASS  HumiditySensor entity exists" -ForegroundColor Green; $pass++
    } else {
        Write-Host "  FAIL  No HumiditySensor entity" -ForegroundColor Red; $fail++
    }
    if ($hasPlug) {
        Write-Host "  PASS  SmartPlug entity exists" -ForegroundColor Green; $pass++
        $plug = $hasPlug | Select-Object -First 1
        if ($plug.onOff -and $plug.activePower) {
            Write-Host "  PASS  SmartPlug has onOff + activePower" -ForegroundColor Green; $pass++
        } else {
            Write-Host "  FAIL  SmartPlug missing attributes" -ForegroundColor Red; $fail++
        }
    } else {
        Write-Host "  FAIL  No SmartPlug entity" -ForegroundColor Red; $fail++
    }
} catch {
    Write-Host "  FAIL  Could not fetch entities: $($_.Exception.Message)" -ForegroundColor Red; $fail++
}

# Summary
Write-Host "`n=== Results: $pass PASS, $fail FAIL ===" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
exit $fail
