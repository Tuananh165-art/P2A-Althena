# ARCHITECTURE — Electrical Fire Detection from Climate-Driven Heat Waves

## 0) Architecture Priority

**Ưu tiên kiến trúc cho MVP phát hiện chập cháy điện:**
1. MCP + AI Agent orchestration loop (fire risk reasoning)
2. Context integrity trong Orion (digital twin cho zone giám sát)
3. Action reliability (ACK/ERROR + audit) — fire response cần chính xác, 0 false negative
4. Dashboard visualization (fire risk map + real-time sensor data)
5. OpenClaw multi-channel alert delivery (cảnh báo cháy đa kênh)
6. Real sensor connectivity (Zigbee/Tuya cho production)

## 1) Logical Architecture

```text
[Physical Devices]
  Zigbee Sensors (humidity, leak, motion)
  Zigbee Actuators (plugs, lamps)
         |
         | Zigbee protocol
         v
[zigbee2mqtt] <---> [Zigbee Bridge (port 3003)]
                          |
[Matter Emulators]        | NGSI-v2
  HumiditySensor          |
  SmartPlug               |
         |                |
         v                v
[FIMAT Agent (port 3000)]
  - Device discovery
  - Event normalize (Matter/Zigbee -> NGSI-v2)
  - Upsert Orion entities
         |
         v
[FIWARE Orion Context Broker]
  - Latest context state
  - Unified query/update API
         |
    +----+-------+--------------------+
    |            |                    |
    v            v                    v
[Dashboard]  [MCP Agent]        [OpenClaw Gateway]
(port 8080)  (port 3002)        (port 3004)
- Monitoring - Risk reasoning    - Telegram bot
- Alerts     - AI analysis       - Alert push
- Simulate   - Alert publish     - Skill routing
- Actions    - Command exec      - Multi-channel
```

## 2) Runtime Components

| Component | Port | Description |
|-----------|------|-------------|
| `matter-emulators/` | - | Matter device simulation |
| `fimat-agent/` | 3000 | Matter-to-NGSI adapter |
| `zigbee-bridge/` | 3003 | Zigbee-to-NGSI adapter via MQTT |
| `mcp-agent/` | 3002 | AI orchestration + risk engine |
| `proxy-server.js` | 3001 | CORS bridge for dashboard |
| `monitor-dashboard/` | 8080 | Web UI |
| `docker-compose.yml` | 1026/27017 | Orion + MongoDB |
| `openclaw-gateway/` | 3004 | OpenClaw Gateway (Telegram + skill routing) |
| `openclaw-skills/` | - | OpenClaw skill definitions |

## 3) Data Flow (chuẩn)

1. **Ingestion:** Zigbee devices -> zigbee2mqtt -> Zigbee Bridge -> Orion
   OR Matter emulators -> FIMAT Agent -> Orion
2. **Context:** Orion stores latest state per entity
3. **Decision:** MCP Agent polls Orion every 5s:
   - Rule engine computes risk score
   - AI reasoner enhances rationale (if configured)
4. **Action:** If risk exceeds threshold:
   - Publish AlertEvent entity to Orion
   - Execute device commands (alert lamp, plug control)
   - Track ACK/ERROR
5. **Notification:** OpenClaw delivers alerts to messaging platforms
6. **Visualization:** Dashboard shows risk, alerts, commands in real-time

## 3.1 MCP/AI Agent loop (trọng tâm)

- Trigger: context thay đổi hoặc lịch polling ngắn (5s)
- Decision: rule baseline trước, AI reasoning sau
- Policy: action nhạy cảm yêu cầu xác nhận người vận hành
- Output bắt buộc: `riskLevel`, `riskScore`, `rationale`, `recommendedAction`
- AI reasoning: Optional LLM endpoint (OpenAI/Azure/local) via env vars

## 3.2 Zigbee Bridge

- Connects to zigbee2mqtt via MQTT
- Auto-discovers Zigbee devices
- Maps Zigbee attributes to NGSI-v2 entities
- Supports bidirectional: state ingestion + command execution
- Device types: humidity, smart_plug, light, water_leak, occupancy

## 3.3 OpenClaw Gateway Integration

- Standalone service on port 3004 (`openclaw-gateway/`)
- Telegram bot receives user messages, routes via keyword-based skill router
- Supported skills: query-risk, get-alerts, device-control, system-status, simulate-scenario
- AlertSubscriber polls MCP Agent `/alerts` and pushes new warning/critical alerts to Telegram
- Webhook endpoint `POST /webhook/alert` for MCP Agent to push alerts directly
- Skills call MCP Agent REST APIs (same endpoints as dashboard chat bubble)
- Config: Telegram bot token + allowed chat IDs via `.env`

### Setup

```powershell
cd Matter-to-FIWARE-Monitoring-System/openclaw-gateway
cp .env.example .env
# Edit .env with your Telegram bot token and chat ID
npm install
npm start
```

### Architecture

```
User (Telegram)
  <-> OpenClaw Gateway (port 3004)
      -> Skill Router (keyword-based)
          -> MCP Agent API (port 3002)
              -> FIWARE Orion (port 1026)

MCP Agent (poll loop)
  -> OpenClaw Gateway (poll /alerts or webhook)
      -> Telegram Bot (push notification)
```

## 4) Non-functional goals cho hackathon
- End-to-end latency <= 5 giây (MVP target)
- Demo stable 10 phút không crash
- Có fallback khi hardware lỗi (mock command)
- OpenClaw alert delivery < 10s from trigger
