# ENTITY_MODEL

## 1) MatterDevice - HumiditySensor
```json
{
  "id": "urn:ngsi-ld:MatterDevice:1_1",
  "type": "HumiditySensor",
  "measuredValue": {
    "type": "Number",
    "value": 72.4,
    "metadata": {
      "unit": { "type": "string", "value": "%RH" },
      "timestamp": { "type": "string", "value": "2026-04-14T16:00:00Z" }
    }
  }
}
```

## 2) MatterDevice - SmartPlug
```json
{
  "id": "urn:ngsi-ld:MatterDevice:2_1",
  "type": "SmartPlug",
  "onOff": { "type": "Boolean", "value": true },
  "activePower": {
    "type": "Number",
    "value": 500,
    "metadata": {
      "unit": { "type": "string", "value": "W" },
      "timestamp": { "type": "string", "value": "2026-04-14T16:00:00Z" }
    }
  }
}
```

## 3) ZoneRisk (planned)
```json
{
  "id": "urn:ngsi-ld:ZoneRisk:A",
  "type": "ZoneRisk",
  "riskScore": { "type": "Number", "value": 78 },
  "riskLevel": { "type": "Text", "value": "warning" },
  "rationale": { "type": "Text", "value": "Humidity high + abnormal power" }
}
```

## 4) AlertEvent (planned)
```json
{
  "id": "urn:ngsi-ld:AlertEvent:...",
  "type": "AlertEvent",
  "level": { "type": "Text", "value": "critical" },
  "zone": { "type": "Text", "value": "A" },
  "message": { "type": "Text", "value": "Flood/electrical risk detected" },
  "status": { "type": "Text", "value": "open" }
}
```

## 5) Quy tắc dữ liệu
- Mỗi attribute có timestamp metadata nếu là telemetry.
- Dùng naming ổn định, tránh đổi id giữa các lần chạy demo.
- Áp dụng debounce/cooldown để tránh spam alert.
