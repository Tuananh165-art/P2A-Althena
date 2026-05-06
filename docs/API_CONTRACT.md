# API_CONTRACT

## 1) Orion (1026)
### Health/version
- `GET /version`

### Entities
- `GET /v2/entities`
- `GET /v2/entities/{id}`
- `POST /v2/entities`
- `PATCH /v2/entities/{id}/attrs`
- `POST /v2/entities/{id}/attrs?options=append` (fallback create missing attrs)

## 2) Proxy (3001)
- `GET /version` -> proxy to Orion `/version`
- `ALL /v2/*` -> pass-through to Orion `/v2/*`

## 3) FIMAT Agent API (3000)
- `GET /health` -> `{ status: 'ok', message: 'FIMAT Agent is running' }`
- `GET /entities` -> list entities from Orion

## 4) MCP Agent API (3002)

### Health
- `GET /health` -> `{ status: 'ok', message: 'MCP Agent running', uptime: N }`

### Risk Assessment
- `GET /risk?zone=A` -> current risk for zone
- `GET /risk/all` -> all zone risks

### MCP Tool Endpoints
- `GET /tools/query_entities?zone=&type=&since=` -> filtered entity list
- `POST /tools/compute_risk` -> `{ zone }` -> risk result
- `POST /tools/publish_alert` -> `{ level, zone, message, rationale }` -> alert
- `POST /tools/invoke_command` -> `{ deviceId, action, reason }` -> command execution

### Alerts & Commands
- `GET /alerts?limit=20` -> recent alerts
- `GET /commands?limit=20` -> recent command executions

### Manual Trigger
- `POST /evaluate` -> force risk evaluation now

## 5) Zigbee Bridge API (3003)

### Health
- `GET /health` -> `{ status: 'ok', mqttConnected, devicesRegistered, messagesProcessed, devices }`

### Devices
- `GET /devices` -> list registered Zigbee devices

### Command
- `POST /command` -> `{ device, payload }` -> send command via MQTT
- `POST /devices/{name}/control` -> direct device control

## 6) Electrical Fire Risk Decision response schema
```json
{
  "zone": "A",
  "riskLevel": "critical",
  "riskScore": 95,
  "rationale": "Temperature 55°C — wiring insulation melting, imminent short circuit and fire. Power 980W — circuit breaker capacity exceeded. Heat wave compound hazard: extreme ambient heat + electrical overload.",
  "recommendedActions": ["CUT_POWER_IMMEDIATELY", "TURN_ON_ALERT_LAMP", "NOTIFY_OPERATOR", "EVACUATE_ZONE"],
  "reasoningSource": "ai",
  "confidence": 0.95,
  "timestamp": "2026-05-06T10:30:00Z"
}
```

## 7) Command response contract
```json
{
  "commandId": "cmd-...",
  "deviceId": "urn:ngsi-ld:MatterDevice:2_1",
  "action": "TURN_ON_ALERT_LAMP",
  "status": "ACK",
  "timestamp": "2026-05-05T10:30:00Z"
}
```
