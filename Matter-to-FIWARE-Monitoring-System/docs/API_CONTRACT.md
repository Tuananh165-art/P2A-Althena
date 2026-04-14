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

## 4) MCP tools (core contract - ưu tiên triển khai)
- `query_entities(zone?, type?, since?)`
  - Input: filter theo zone/type/time window
  - Output: danh sách entity chuẩn hóa
- `compute_risk(zone)`
  - Input: zone
  - Output bắt buộc:
    - `riskLevel` (`normal|warning|critical`)
    - `riskScore` (0..100)
    - `rationale` (text ngắn)
    - `recommendedAction` (array)
- `publish_alert(level, zone, message, rationale)`
  - Tạo/cập nhật alert event để dashboard hiển thị
- `invoke_command(deviceId, action, reason)`
  - Gửi command tới device bridge, nhận ACK/ERROR

## 5) AI Decision response schema (đề xuất)
```json
{
  "zone": "A",
  "riskLevel": "critical",
  "riskScore": 87,
  "rationale": "Humidity tăng nhanh + activePower bất thường",
  "recommendedAction": [
    "TURN_ON_ALERT_LAMP",
    "NOTIFY_OPERATOR"
  ]
}
```

## 6) Command response contract (đề xuất)
```json
{
  "commandId": "cmd-...",
  "deviceId": "urn:ngsi-ld:MatterDevice:2_1",
  "action": "TURN_ON_ALERT_LAMP",
  "status": "ACK",
  "timestamp": "2026-04-14T16:00:00Z"
}
```
