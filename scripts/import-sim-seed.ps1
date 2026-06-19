param(
    [string]$Scenario = 'small-batch',
    [string]$InputFile = '',
    [string]$OrionUrl = 'http://localhost:1026'
)

$ErrorActionPreference = 'Stop'

$basePath = Split-Path -Parent $PSScriptRoot
$seedDir = Join-Path $basePath 'sim-seed'

if ($InputFile -eq '') {
    $InputFile = Join-Path $seedDir "$Scenario.json"
} elseif (-not [System.IO.Path]::IsPathRooted($InputFile)) {
    $InputFile = Join-Path $basePath $InputFile
}

if (-not (Test-Path $InputFile)) {
    Write-Host "Seed file not found: $InputFile" -ForegroundColor Red
    exit 1
}

try {
    Invoke-RestMethod -Uri "$OrionUrl/version" -TimeoutSec 5 -ErrorAction Stop | Out-Null
} catch {
    Write-Host "Orion is not reachable at $OrionUrl" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor DarkRed
    exit 1
}

$entities = Get-Content -Path $InputFile -Raw | ConvertFrom-Json
if ($null -eq $entities) {
    Write-Host "Seed file is empty: $InputFile" -ForegroundColor Red
    exit 1
}

if ($entities -isnot [System.Array]) {
    $entities = @($entities)
}

$importTimestamp = (Get-Date).ToUniversalTime().ToString('o')

function Update-Timestamps {
    param([Parameter(ValueFromPipeline = $true)]$Node)

    if ($null -eq $Node) {
        return
    }

    if ($Node -is [System.Array]) {
        foreach ($item in $Node) {
            Update-Timestamps $item
        }
        return
    }

    if ($Node -is [pscustomobject]) {
        foreach ($prop in $Node.PSObject.Properties) {
            if ($prop.Name -eq 'timestamp' -and $prop.Value -is [pscustomobject]) {
                $prop.Value.value = $importTimestamp
            } else {
                Update-Timestamps $prop.Value
            }
        }
    }
}

Update-Timestamps $entities

Write-Host "Importing seed data to Orion/OpenClaw context" -ForegroundColor Cyan
Write-Host "  File: $InputFile" -ForegroundColor Cyan
Write-Host "  Orion: $OrionUrl" -ForegroundColor Cyan
Write-Host "  Entities: $($entities.Count)" -ForegroundColor Cyan
Write-Host "  Timestamp: $importTimestamp" -ForegroundColor Cyan

$success = 0
$failed = 0

foreach ($entity in $entities) {
    if (-not $entity.id -or -not $entity.type) {
        Write-Host "  Skipping entity without id/type" -ForegroundColor Yellow
        $failed += 1
        continue
    }

    $body = $entity | ConvertTo-Json -Depth 30
    try {
        Invoke-RestMethod `
            -Uri "$OrionUrl/v2/entities?options=upsert" `
            -Method POST `
            -ContentType 'application/json' `
            -Body $body `
            -TimeoutSec 10 `
            -ErrorAction Stop | Out-Null
        $success += 1
    } catch {
        try {
            $attrs = [ordered]@{}
            foreach ($prop in $entity.PSObject.Properties) {
                if ($prop.Name -ne 'id' -and $prop.Name -ne 'type') {
                    $attrs[$prop.Name] = $prop.Value
                }
            }
            $attrBody = $attrs | ConvertTo-Json -Depth 30
            $encodedId = [System.Uri]::EscapeDataString([string]$entity.id)

            Invoke-RestMethod `
                -Uri "$OrionUrl/v2/entities/$encodedId/attrs?options=append" `
                -Method POST `
                -ContentType 'application/json' `
                -Body $attrBody `
                -TimeoutSec 10 `
                -ErrorAction Stop | Out-Null
            $success += 1
        } catch {
            Write-Host "  Failed: $($entity.id) - $($_.Exception.Message)" -ForegroundColor Yellow
            $failed += 1
        }
    }
}

Write-Host "Seed import complete: $success/$($entities.Count) entities upserted" -ForegroundColor Green
if ($failed -gt 0) {
    Write-Host "Seed import had $failed failed entity/entities" -ForegroundColor Yellow
    exit 1
}
