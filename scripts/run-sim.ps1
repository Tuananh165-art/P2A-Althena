param(
    [string]$Scenario = 'normal',
    [int]$Duration = 120,
    [double]$Rate = 1,
    [string]$OrionUrl = 'http://localhost:1026',
    [string]$Output = ''
)

$base = Split-Path -Parent $PSScriptRoot
$generator = Join-Path $base 'sim-generator\generate.js'
$node = 'node'

if (-not (Test-Path $generator)) {
    Write-Host "Generator not found: $generator" -ForegroundColor Red
    exit 1
}

$env:ORION_URL = $OrionUrl
$arguments = @(
    $generator,
    '--scenario', $Scenario,
    '--duration', $Duration,
    '--rate', $Rate,
    '--send',
    '--verbose'
)

if ($Output -ne '') {
    $arguments += @('--output', $Output)
}

Write-Host "Running simulation: $Scenario for $Duration seconds at $Rate events/s" -ForegroundColor Cyan
Write-Host "Orion URL: $OrionUrl" -ForegroundColor Cyan

& $node $arguments
