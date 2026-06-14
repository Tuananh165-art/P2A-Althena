param(
    [string]$InputFile = 'sim-seed\small-batch.json',
    [string]$OrionUrl = 'http://localhost:1026'
)

$base = Split-Path -Parent $PSScriptRoot
$seedScript = Join-Path $base 'sim-generator\seed-orion.js'
$node = 'node'

if (-not (Test-Path $seedScript)) {
    Write-Host "Seed script not found: $seedScript" -ForegroundColor Red
    exit 1
}

$inputPath = Join-Path $base $InputFile
if (-not (Test-Path $inputPath)) {
    Write-Host "Input JSON not found: $inputPath" -ForegroundColor Red
    exit 1
}

$env:ORION_URL = $OrionUrl
Write-Host "Seeding sample data to Orion: $OrionUrl" -ForegroundColor Cyan
Write-Host "Input file: $inputPath" -ForegroundColor Cyan

& $node $seedScript '--input' $inputPath

if ($LASTEXITCODE -ne 0) {
    Write-Host "Seed script failed with code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Verifying sample entities..." -ForegroundColor Cyan
try {
    $entities = Invoke-RestMethod -Uri "$OrionUrl/v2/entities?limit=10" -TimeoutSec 10 -ErrorAction Stop
    if ($entities) {
        Write-Host "  Found $(($entities | Measure-Object).Count) entities in Orion" -ForegroundColor Green
    } else {
        Write-Host "  No entities returned from Orion" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Verification failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
