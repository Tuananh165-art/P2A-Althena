# ARCHITECTURE

## 1) Logical Architecture

```text
[Devices/Emulators]
  HumiditySensor, SmartPlug, AlertLamp
         |
         v
[FIMAT Agent]
  - Device discovery
  - Event normalize (Matter -> NGSI-v2)
  - Upsert Orion entities
         |
         v
[FIWARE Orion Context Broker]
  - Latest context state
  - Unified query/update API
         |
   +-----+--------------------+
   |                          |
   v                          v
[Dashboard]              [MCP-FIWARE Agent]
- Monitoring             - Context query tools
- Alerts timeline        - Risk reasoning
- Manual override        - Publish alert
                          - Invoke device command
```

## 2) Runtime Components
- `matter-emulators/`: phát event mô phỏng
- `fimat-agent/`: adapter protocol + semantic mapping
- `proxy-server.js`: CORS bridge cho dashboard (`/version`, `/v2/*`)
- `monitor-dashboard/`: web UI
- `docker-compose.yml`: Orion + MongoDB

## 3) Data Flow (chuẩn)
1. Thiết bị/emulator phát event (attribute value).
2. FIMAT chuyển event thành payload NGSI-v2.
3. Orion lưu state mới nhất theo entity.
4. Dashboard đọc dữ liệu, hiển thị risk + alerts.
5. MCP Agent đọc context, đánh giá risk, phát cảnh báo và gọi action.
6. Kết quả action trả ACK/ERROR, ghi audit.

## 4) Non-functional goals cho hackathon
- End-to-end latency <= 5 giây (MVP target)
- Demo stable 10 phút không crash
- Có fallback khi hardware lỗi (mock command)
