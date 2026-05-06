# SETUP GUIDE — Climate Resilience Copilot

## 1) Yêu cầu hệ thống

| Tool | Version | Kiểm tra |
|------|---------|----------|
| Node.js | v18+ | `node --version` |
| Docker Desktop | latest | `docker --version` |
| PowerShell | 5.1+ | `$PSVersionTable` |

---

## 2) Cấu hình .env

### MCP Agent (`mcp-agent/.env`)
```env
ORION_HOST=localhost
ORION_PORT=1026
MCP_PORT=3002
MCP_POLL_INTERVAL=5000
RISK_COOLDOWN_MS=30000

# AI Reasoning
AI_ENDPOINT=https://chat.vitexa.app
AI_API_KEY=sk-tuananh-qaKK56P7VfPyxUyIKtLHcbqUf2vCz7J6j6taA9QaMwDXSBaAY4vIAEKvn2mT8zzn
AI_MODEL=mimo-v2.5-pro
```

### Zigbee Bridge (`zigbee-bridge/.env`)
```env
MQTT_URL=mqtt://localhost:1883
Z2M_BASE_TOPIC=zigbee2mqtt
ORION_HOST=localhost
ORION_PORT=1026
MCP_HOST=localhost
MCP_PORT=3002
```

---

## 3) Setup lần đầu

```powershell
# 1. Clone repo
cd F:\P2A-Althena

# 2. Install dependencies cho từng service
cd Matter-to-FIWARE-Monitoring-System\fimat-agent && npm install
cd ..\mcp-agent && npm install
cd ..\zigbee-bridge && npm install
cd ..\matter-emulators && npm install

# 3. Quay về root
cd F:\P2A-Althena
```

---

## 4) Chạy toàn bộ stack

### Cách 1: One-command (khuyên dùng)
```powershell
.\scripts\dev-up.ps1
```

Script sẽ tự động:
1. Kill process cũ
2. Start Docker (Orion + MongoDB)
3. Start Proxy Server (port 3001)
4. Start FIMAT Agent (port 3000)
5. Start MCP Agent (port 3002)
6. Start Zigbee Bridge (port 3003)
7. Start Dashboard (port 8080)

### Cách 2: Chạy từng service (debug)

```powershell
# Terminal 1 - Docker
cd Matter-to-FIWARE-Monitoring-System
docker compose up -d

# Terminal 2 - Proxy
node proxy-server.js

# Terminal 3 - FIMAT Agent
cd fimat-agent && npm start

# Terminal 4 - MCP Agent
cd mcp-agent && npm start

# Terminal 5 - Zigbee Bridge (optional, cần MQTT)
cd zigbee-bridge && npm start

# Terminal 6 - Dashboard
cd monitor-dashboard && npx http-server -p 8080 -c-1
```

---

## 5) Kiểm tra (Smoke Test)

```powershell
.\scripts\smoke-test.ps1`
```

Expected output:
```
=== Smoke Test ===
  PASS  Orion /version (http://localhost:1026/version)
  PASS  Proxy /version (http://localhost:3001/version)
  PASS  Proxy /v2/entities (http://localhost:3001/v2/entities)
  PASS  FIMAT /health (http://localhost:3000/health)
  PASS  MCP /health (http://localhost:3002/health)
  PASS  MCP /risk (http://localhost:3002/risk)
  PASS  Dashboard (http://localhost:8080)

--- Entity Checks ---
  PASS  HumiditySensor entity exists
  PASS  SmartPlug entity exists
  PASS  SmartPlug has onOff + activePower

=== Results: 10 PASS, 0 FAIL ===
```

---

## 6) Demo Scenario

```powershell
# Normal - mọi thứ bình thường
.\scripts\demo-scenario.ps1 -Mode normal

# Warning - cảnh báo (humidity 80%+, power 850W+)
.\scripts\demo-scenario.ps1 -Mode warning

# Critical - nguy hiểm (humidity 93%+, power 960W+)
.\scripts\demo-scenario.ps1 -Mode critical
```

Hoặc dùng nút bấm trên Dashboard: http://localhost:8080

---

## 7) Test AI Reasoning

Sau khi start MCP Agent với .env config:
```powershell
# Check AI status
curl http://localhost:3002/health

# Trigger evaluation (cần Orion running)
curl -X POST http://localhost:3002/evaluate

# Check risk (sẽ có AI/RULE badge)
curl http://localhost:3002/risk?zone=A
```

Dashboard sẽ hiển thị `AI` badge màu tím nếu AI reasoning hoạt động.

---

## 8) Test MCP Tools trực tiếp

```powershell
# Publish alert
curl -X POST http://localhost:3002/tools/publish_alert `
  -H "Content-Type: application/json" `
  -d '{"level":"warning","zone":"A","message":"Test","rationale":"Testing"}'

# Invoke command
curl -X POST http://localhost:3002/tools/invoke_command `
  -H "Content-Type: application/json" `
  -d '{"deviceId":"urn:ngsi-ld:MatterDevice:2_1","action":"TURN_ON","reason":"Test"}'

# Get alerts
curl http://localhost:3002/alerts

# Get commands
curl http://localhost:3002/commands
```

---

## 9) Stop toàn bộ

```powershell
.\scripts\dev-down.ps1
```

---

## 10) Ports summary

| Service | Port | URL |
|---------|------|-----|
| Orion Context Broker | 1026 | http://localhost:1026/version |
| MongoDB | 27017 | internal |
| Proxy Server | 3001 | http://localhost:3001/v2/entities |
| FIMAT Agent | 3000 | http://localhost:3000/health |
| MCP Agent | 3002 | http://localhost:3002/health |
| Zigbee Bridge | 3003 | http://localhost:3003/health |
| Dashboard | 8080 | http://localhost:8080 |

---

## 11) Troubleshooting

### Docker không start
```
Docker Desktop chưa chạy -> Mở Docker Desktop app, chờ "Docker Desktop is running"
```

### Port bị chiếm
```powershell
# Tìm process chiếm port
netstat -ano | findstr :3002
# Kill process
taskkill /PID <pid> /F
```

### Orion không kết nối
```powershell
# Check Docker containers
docker ps
# Restart Orion
cd Matter-to-FIWARE-Monitoring-System && docker compose restart
```

### MCP Agent không có AI
```
Check .env file có AI_ENDPOINT và AI_API_KEY không.
Check log: "[AIReasoner] Enabled: mimo-v2.5-pro via ..."
```

### Zigbee Bridge không kết nối MQTT
```
Cần cài zigbee2mqtt + MQTT broker (Mosquitto).
Hoặc bỏ qua Zigbee Bridge cho MVP demo (dùng emulators).
```
