# verify-all.ps1 - Health check for all Climate Resilience Copilot services
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Climate Resilience Copilot - Service Check" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$ok = 0
$fail = 0

$checks = @(
    @{ Name = "MongoDB (27017)";         Url = "http://localhost:27017" },
    @{ Name = "FIWARE Orion (1026)";     Url = "http://localhost:1026/version" },
    @{ Name = "Proxy Server (3001)";     Url = "http://localhost:3001/version" },
    @{ Name = "FIMAT Agent (3000)";      Url = "http://localhost:3000/health" },
    @{ Name = "MCP Agent (3002)";        Url = "http://localhost:3002/health" },
    @{ Name = "Zigbee Bridge (3003)";    Url = "http://localhost:3003/health" },
    @{ Name = "OpenClaw Gateway (3004)"; Url = "http://localhost:3004/health" },
    @{ Name = "Dashboard (8080)";        Url = "http://localhost:8080/" }
)

foreach ($c in $checks) {
    try {
        $null = Invoke-WebRequest -Uri $c.Url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        Write-Host ("  [OK]   " + $c.Name) -ForegroundColor Green
        $ok++
    } catch {
        Write-Host ("  [FAIL] " + $c.Name + " - " + $_.Exception.Message) -ForegroundColor Red
        $fail++
    }
}

Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Cyan
$msg = " Results: $ok OK, $fail FAILED"
if ($fail -eq 0) {
    Write-Host $msg -ForegroundColor Green
} else {
    Write-Host $msg -ForegroundColor Yellow
}
Write-Host "--------------------------------------------" -ForegroundColor Cyan

Write-Host ""
Write-Host "Data Pipeline Check:" -ForegroundColor Cyan

try {
    $entities = Invoke-RestMethod -Uri "http://localhost:3001/v2/entities" -TimeoutSec 5
    $deviceCount = 0
    foreach ($e in $entities) {
        if ($e.type -match "Sensor|SmartPlug") { $deviceCount++ }
    }
    Write-Host "  Devices in Orion: $deviceCount" -ForegroundColor Green
} catch {
    Write-Host "  Cannot fetch entities from Orion" -ForegroundColor Red
}

try {
    $risk = Invoke-RestMethod -Uri "http://localhost:3002/risk?zone=A" -TimeoutSec 5
    Write-Host "  Risk Level: $($risk.riskLevel) (score: $($risk.riskScore))" -ForegroundColor Green
    Write-Host "  Source: $($risk.reasoningSource)" -ForegroundColor Gray
} catch {
    Write-Host "  Cannot fetch risk from MCP Agent" -ForegroundColor Red
}

Write-Host ""
