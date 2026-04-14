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
- `GET /version` -> proxy đến Orion `/version`
- `ALL /v2/*` -> pass-through đến Orion `/v2/*`

## 3) FIMAT Agent API (3000)
- `GET /health` -> `{ status: 'ok', message: 'FIMAT Agent is running' }`
- `GET /entities` -> danh sách entities đọc từ Orion

## 4) Planned MCP tools (đề xuất)
- `query_entities(zone?, type?, since?)`
- `compute_risk(zone)`
- `publish_alert(level, zone, message, rationale)`
- `invoke_command(deviceId, action, reason)`

## 5) Command response contract (đề xuất)
```json
{
  "commandId": "cmd-...",
  "deviceId": "urn:ngsi-ld:MatterDevice:2_1",
  "action": "TURN_ON_ALERT_LAMP",
  "status": "ACK",
  "timestamp": "2026-04-14T16:00:00Z"
}
```
