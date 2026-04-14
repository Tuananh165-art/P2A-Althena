param(
  [ValidateSet('normal','warning','critical')]
  [string]$Mode = 'critical',
  [string]$EntityId = 'urn:ngsi-ld:MatterDevice:2_1'
)

$ErrorActionPreference = 'Stop'

Write-Host "🎬 [demo-scenario] Mode=$Mode Entity=$EntityId" -ForegroundColor Cyan

switch ($Mode) {
  'normal' {
    $power = 80
    $onOff = $true
    $note = 'Normal operation'
  }
  'warning' {
    $power = 550
    $onOff = $true
    $note = 'Potential overload'
  }
  'critical' {
    $power = 980
    $onOff = $true
    $note = 'Critical overload + flood-risk context'
  }
}

$ts = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$payload = @{
  onOff = @{
    type = 'Boolean'
    value = $onOff
    metadata = @{ timestamp = @{ type = 'string'; value = $ts } }
  }
  activePower = @{
    type = 'Number'
    value = $power
    metadata = @{
      unit = @{ type = 'string'; value = 'W' }
      timestamp = @{ type = 'string'; value = $ts }
      scenario = @{ type = 'string'; value = $note }
    }
  }
} | ConvertTo-Json -Depth 20

Write-Host '-> Patching Orion attributes through proxy...' -ForegroundColor Yellow
Invoke-RestMethod -Method Patch -Uri "http://localhost:3001/v2/entities/$EntityId/attrs" -ContentType 'application/json' -Body $payload | Out-Null

Write-Host '-> Reading back entity...' -ForegroundColor Yellow
$entity = Invoke-RestMethod -Method Get -Uri "http://localhost:3001/v2/entities/$EntityId"

Write-Host '✅ Demo scenario injected.' -ForegroundColor Green
Write-Host ("   onOff={0}, activePower={1}W" -f $entity.onOff.value, $entity.activePower.value) -ForegroundColor Green
Write-Host '   Tip: open dashboard http://localhost:8080 to show effect live.' -ForegroundColor Cyan
