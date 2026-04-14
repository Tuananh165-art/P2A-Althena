# Start FIWARE Resilience Monitor - All Services
Write-Host "🚀 Bắt đầu tất cả dịch vụ..." -ForegroundColor Green

$basePath = Get-Location

# Kill existing node processes
Write-Host "🛑 Dừng các tiến trình Node cũ..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start Proxy Server in background
Write-Host "✅ Khởi động Proxy Server (port 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$basePath'; node proxy-server.js" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Matter Emulators in background
Write-Host "✅ Khởi động Matter Emulators..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$basePath\matter-emulators'; npm start" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Dashboard HTTP Server in background
Write-Host "✅ Khởi động Dashboard (port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$basePath\monitor-dashboard'; npx http-server -p 8000" -WindowStyle Normal

Write-Host "`n✨ Tất cả dịch vụ đã khởi động!`n" -ForegroundColor Green
Write-Host "📊 Dashboard: http://localhost:8000" -ForegroundColor Cyan
Write-Host "🔗 Proxy: http://localhost:3001" -ForegroundColor Cyan
Write-Host "🗄️ Orion: http://localhost:1026" -ForegroundColor Cyan
Write-Host "`n⏳ Chờ 10 giây để tất cả dịch vụ khởi động xong..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test services
Write-Host "`n🧪 Kiểm tra kết nối..." -ForegroundColor Yellow

$proxyTest = $false
$orionTest = $false

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/v2/entities" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Proxy Server: OK" -ForegroundColor Green
        $proxyTest = $true
    }
} catch {
    Write-Host "❌ Proxy Server: FAILED" -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:1026/v2/entities" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Orion: OK" -ForegroundColor Green
        $orionTest = $true
    }
} catch {
    Write-Host "❌ Orion: FAILED" -ForegroundColor Red
}

if ($proxyTest -and $orionTest) {
    Write-Host "`n🎉 Tất cả dịch vụ đang chạy! Mở browser: http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ Có dịch vụ không chạy. Kiểm tra console logs ở trên." -ForegroundColor Yellow
}

Read-Host "Nhấn Enter để đóng..."
