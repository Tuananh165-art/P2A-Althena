# demo-scenario.ps1 - Inject simulated events for demo
param(
    [ValidateSet("normal", "warning", "critical")]
    [string]$Mode = "critical"
)

$orion = "http://localhost:1026"
$mcp = "http://localhost:3002"
$ts = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

switch ($Mode) {
    "normal" {
        $humidity = 45 + (Get-Random -Minimum 0 -Maximum 20)
        $power = 50 + (Get-Random -Minimum 0 -Maximum 100)
        $temperature = 22 + (Get-Random -Minimum 0 -Maximum 5)
        $plugOn = $true
    }
    "warning" {
        $humidity = 76 + (Get-Random -Minimum 0 -Maximum 10)
        $power = 810 + (Get-Random -Minimum 0 -Maximum 100)
        $temperature = 41 + (Get-Random -Minimum 0 -Maximum 3)
        $plugOn = $true
    }
    "critical" {
        $humidity = 91 + (Get-Random -Minimum 0 -Maximum 8)
        $power = 960 + (Get-Random -Minimum 0 -Maximum 40)
        $temperature = 52 + (Get-Random -Minimum 0 -Maximum 5)
        $plugOn = $true
    }
}

Write-Host "`n=== Demo Scenario: $Mode ===" -ForegroundColor Cyan
Write-Host "  Temperature: $temperature C" -ForegroundColor White
Write-Host "  Humidity:    $humidity%" -ForegroundColor White
Write-Host "  Power:       ${power}W" -ForegroundColor White
Write-Host "  Plug:        $plugOn" -ForegroundColor White

# Update humidity sensor
$body1 = @{
    measuredValue = @{
        type = "Number"
        value = $humidity
        metadata = @{
            unit = @{ type = "string"; value = "%RH" }
            timestamp = @{ type = "string"; value = $ts }
        }
    }
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Uri "$orion/v2/entities/urn:ngsi-ld:HumiditySensor:ZoneA_Room102_Sensor1/attrs" `
        -Method PATCH -ContentType "application/json" -Body $body1 -ErrorAction Stop | Out-Null
    Write-Host "  Updated humidity sensor" -ForegroundColor Green
} catch {
    try {
        Invoke-RestMethod -Uri "$orion/v2/entities/urn:ngsi-ld:HumiditySensor:ZoneA_Room102_Sensor1/attrs?options=append" `
            -Method POST -ContentType "application/json" -Body $body1 -ErrorAction Stop | Out-Null
        Write-Host "  Created humidity sensor" -ForegroundColor Green
    } catch {
        Write-Host "  Error updating humidity: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Update smart plug
$body2 = @{
    onOff = @{ type = "Boolean"; value = $plugOn }
    activePower = @{
        type = "Number"
        value = $power
        metadata = @{
            unit = @{ type = "string"; value = "W" }
            timestamp = @{ type = "string"; value = $ts }
        }
    }
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Uri "$orion/v2/entities/urn:ngsi-ld:SmartPlug:ZoneA_Room102_AC/attrs" `
        -Method PATCH -ContentType "application/json" -Body $body2 -ErrorAction Stop | Out-Null
    Write-Host "  Updated smart plug" -ForegroundColor Green
} catch {
    try {
        Invoke-RestMethod -Uri "$orion/v2/entities/urn:ngsi-ld:SmartPlug:ZoneA_Room102_AC/attrs?options=append" `
            -Method POST -ContentType "application/json" -Body $body2 -ErrorAction Stop | Out-Null
        Write-Host "  Created smart plug" -ForegroundColor Green
    } catch {
        Write-Host "  Error updating plug: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Update temperature sensor
$body3 = @{
    temperature = @{
        type = "Number"
        value = $temperature
        metadata = @{
            unit = @{ type = "string"; value = "C" }
            timestamp = @{ type = "string"; value = $ts }
        }
    }
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Uri "$orion/v2/entities/urn:ngsi-ld:TemperatureSensor:ZoneA_Room102_Wiring/attrs" `
        -Method PATCH -ContentType "application/json" -Body $body3 -ErrorAction Stop | Out-Null
    Write-Host "  Updated temperature sensor" -ForegroundColor Green
} catch {
    try {
        Invoke-RestMethod -Uri "$orion/v2/entities/urn:ngsi-ld:TemperatureSensor:ZoneA_Room102_Wiring/attrs?options=append" `
            -Method POST -ContentType "application/json" -Body $body3 -ErrorAction Stop | Out-Null
        Write-Host "  Created temperature sensor" -ForegroundColor Green
    } catch {
        Write-Host "  Error updating temperature: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Trigger MCP evaluation
try {
    $evalResult = Invoke-RestMethod -Uri "$mcp/evaluate" -Method POST -TimeoutSec 25 -ErrorAction Stop
    Write-Host "`n  MCP Evaluation Result:" -ForegroundColor Yellow
    foreach ($r in $evalResult.results) {
        Write-Host "    Zone $($r.zone): risk=$($r.riskScore) level=$($r.riskLevel)" -ForegroundColor White
        Write-Host "    Rationale: $($r.rationale)" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "  MCP Agent not available for evaluation" -ForegroundColor DarkGray
}

Write-Host "`n=== Scenario $Mode complete ===`n" -ForegroundColor Cyan
