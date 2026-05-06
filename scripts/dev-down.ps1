# dev-down.ps1 - Stop entire Resilience Copilot stack
$ErrorActionPreference = "Continue"
$base = Split-Path -Parent $PSScriptRoot
$project = Join-Path $base "Matter-to-FIWARE-Monitoring-System"

Write-Host "`n=== Resilience Copilot - Stopping Stack ===" -ForegroundColor Cyan

# 1. Stop Node processes
Write-Host "[1/2] Stopping Node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  Node processes stopped" -ForegroundColor Green

# 2. Stop Docker containers
Write-Host "[2/2] Stopping Docker containers..." -ForegroundColor Yellow
Push-Location $project
docker compose down
Pop-Location
Write-Host "  Docker containers stopped" -ForegroundColor Green

Write-Host "`n=== Stack Stopped ===`n" -ForegroundColor Cyan
