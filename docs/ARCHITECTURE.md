# ARCHITECTURE

## 0) Architecture Priority

**Ưu tiên kiến trúc cho MVP:**
1. MCP + AI Agent orchestration loop
2. Context integrity trong Orion
3. Action reliability (ACK/ERROR + audit)
4. Dashboard visualization

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
4. **MCP Agent đọc context và thực thi tool chain:**
   - query_entities -> compute_risk -> publish_alert -> invoke_command
5. Dashboard đọc dữ liệu, hiển thị risk + alerts + action status.
6. Kết quả action trả ACK/ERROR, ghi audit.

## 3.1 MCP/AI Agent loop (trọng tâm)
- Trigger: context thay đổi hoặc lịch polling ngắn.
- Decision: rule baseline trước, AI reasoning sau.
- Policy: action nhạy cảm yêu cầu xác nhận người vận hành.
- Output bắt buộc: `riskLevel`, `riskScore`, `rationale`, `recommendedAction`.

## 4) Non-functional goals cho hackathon
- End-to-end latency <= 5 giây (MVP target)
- Demo stable 10 phút không crash
- Có fallback khi hardware lỗi (mock command)
