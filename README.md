# TECHNICAL ROADMAP — Climate Resilience Copilot

## 1) Mục tiêu sản phẩm

**Climate Resilience Copilot** là MVP phát hiện rủi ro **chập cháy điện do nắng nóng cực đoan** theo thời gian thực.

Chuỗi rủi ro mục tiêu:

```text
Climate Change -> Heat Wave (35-40°C+) -> Electrical Overload -> Wiring Overheat -> Short Circuit -> FIRE
```

Mục tiêu vận hành:
- Phát hiện rủi ro critical trong <= 5 giây.
- Tự động phản hồi (cảnh báo + action) theo policy.
- 0 false negative cho sự kiện critical trong kịch bản demo.

---

## 2) Scope kỹ thuật của project này

### In-scope (MVP)
- Ingestion dữ liệu từ emulator/device.
- Chuẩn hóa telemetry sang NGSI-v2.
- Đồng bộ context vào FIWARE Orion.
- Rule-based risk baseline + AI reasoning bổ sung.
- Dashboard realtime + action status.
- Action pipeline có ACK/ERROR + audit trail.

### Out-of-scope (giai đoạn hiện tại)
- Production HA/security đầy đủ.
- NGSI-LD semantic graph đầy đủ.
- ML training pipeline lớn.

---

## 3) Architecture tổng thể

```text
[Devices / Emulators]
  - Matter emulators
  - Zigbee devices (optional)
         |
         v
[Ingestion Layer]
  - FIMAT Agent (Matter -> NGSI-v2)
  - Zigbee Bridge (zigbee2mqtt -> NGSI-v2)
         |
         v
[FIWARE Orion Context Broker]
  - Single source of truth for digital twin context
         |
   +-----+---------------------+
   |                           |
   v                           v
[Monitor Dashboard]        [MCP Agent]
  - realtime status         - rule engine baseline
  - alerts timeline         - AI reasoning
  - action monitor          - publish alert + invoke command
                                |
                                v
                         [Command ACK/ERROR + Audit Trail]
                                |
                                v
                         [OpenClaw Gateway (optional)]
                         - Telegram skill routing / notifications
```

### Core flow không được phá vỡ
`Device/Event -> FIMAT -> Orion -> Dashboard/MCP -> Action/Ack`

---

## 4) Thành phần chính và tech stack

### Platform & Data
- **FIWARE Orion** (NGSI-v2 Context Broker, port 1026)
- **MongoDB** (Orion backend)
- **Node.js services** cho adapter/agent/proxy

### Services hiện có
- `Matter-to-FIWARE-Monitoring-System/fimat-agent/` (port 3000)
- `Matter-to-FIWARE-Monitoring-System/mcp-agent/` (port 3002)
- `Matter-to-FIWARE-Monitoring-System/zigbee-bridge/` (port 3003)
- `Matter-to-FIWARE-Monitoring-System/openclaw-gateway/` (port 3004)
- `Matter-to-FIWARE-Monitoring-System/proxy-server.js` (port 3001)
- `Matter-to-FIWARE-Monitoring-System/monitor-dashboard/` (port 8080)
- `Matter-to-FIWARE-Monitoring-System/matter-emulators/`

### Runtime orchestration
- **Docker Compose** cho Orion + Mongo.
- Script PowerShell cho bring-up/test/demo.

---

## 5) Decision & Action workflow

## 5.1 Ingestion workflow
1. Nhận event từ emulator/device.
2. Normalize schema về NGSI-v2.
3. Upsert entity/attrs vào Orion.
4. Nếu attr chưa tồn tại thì append fallback.

## 5.2 Decision workflow
1. MCP Agent đọc context theo polling/event.
2. Rule engine tính risk baseline trước.
3. AI reasoning chỉ là lớp bổ sung giải thích/khuyến nghị.
4. Trigger action theo policy cho phép.

## 5.3 Action workflow
1. Tạo action request.
2. Gửi command tới device/bridge.
3. Nhận ACK/ERROR/timeout.
4. Ghi audit trail trước và sau action.

## 5.4 Anti-spam workflow
- Dedupe theo event key + time window.
- Alert cooldown để tránh spam dashboard/user.

---

## 6) Data model chuẩn (tóm tắt)

Entity chính:
- `MatterDevice` (HumiditySensor/SmartPlug/...)
- `ZoneRisk`
- `AlertEvent`
- `CommandExecution`

Quy tắc dữ liệu:
- Telemetry attr phải có `metadata.timestamp`.
- Attr có đơn vị phải có `metadata.unit`.
- Entity ID ổn định, không đổi ngẫu nhiên giữa các lần chạy.
- Không đổi field name nếu chưa cập nhật contract/docs.

Tài liệu nguồn:
- `docs/API_CONTRACT.md`
- `docs/ENTITY_MODEL.md`

---

## 7) API surface chính

### Orion / Proxy
- Orion: `/version`, `/v2/*`
- Proxy (3001): pass-through `/version`, `/v2/*` cho dashboard

### FIMAT Agent (3000)
- `/health`
- `/entities`

### MCP Agent (3002)
- `/health`
- `/risk`, `/risk/all`
- `/tools/query_entities`
- `/tools/compute_risk`
- `/tools/publish_alert`
- `/tools/invoke_command`
- `/alerts`, `/commands`, `/evaluate`

### Zigbee Bridge (3003)
- `/health`, `/devices`
- `/command`, `/devices/{name}/control`

---

## 8) Non-negotiable engineering rules

1. Rule-first, AI-second.
2. Mọi action phải có audit trail (ai/khi nào/vì sao/kết quả).
3. Action nhạy cảm cần human-in-the-loop.
4. Không dùng PII trong MVP; chỉ telemetry device/zone.
5. Không hardcode config môi trường; dùng env/config.
6. Mọi thay đổi contract phải cập nhật docs liên quan.

---

## 9) Build/Test gate trước demo

Bắt buộc chạy đủ:
1. `scripts/dev-up.ps1`
2. `scripts/smoke-test.ps1` (PASS)
3. `scripts/demo-scenario.ps1 -Mode critical`
4. Dashboard mở được tại `http://localhost:8080`
5. SmartPlug có đủ `onOff` + `activePower`

Nếu fail bất kỳ bước nào: chưa chốt build demo.

---

## 10) Known issues & mitigation

1. **Service startup order dễ gây false alarm healthcheck**
   - Mitigation: luôn bring up bằng `dev-up.ps1`, chờ Orion/proxy healthy trước khi mở dashboard.

2. **Thiếu attr khi update entity có thể gây lỗi patch**
   - Mitigation: dùng append fallback trong ingestion path.

3. **Alert spam khi event burst**
   - Mitigation: dedupe key + cooldown window ở decision layer.

4. **Phần cứng có thể không ổn định trong demo**
   - Mitigation: fallback mock command + hiển thị degraded mode rõ trên dashboard.

5. **AI output không ổn định theo ngữ cảnh**
   - Mitigation: rule baseline quyết định cuối cùng; AI chỉ bổ sung rationale/recommendation.

---

## 11) Technical roadmap theo phase

### Phase 1 — Pipeline hardening
- Ổn định ingestion đa nguồn (Matter + Zigbee).
- Chuẩn hóa telemetry metadata timestamp/unit.
- Bảo đảm idempotent upsert + append fallback.

### Phase 2 — Risk engine quality
- Cải thiện risk baseline theo ngữ cảnh nhiệt độ/điện năng/độ ẩm.
- Chuẩn hóa alert levels và rationale schema.
- Tăng độ chính xác critical detection, giảm false positive.

### Phase 3 — Action reliability
- Chuẩn hóa command lifecycle: request -> dispatch -> ACK/ERROR -> audit.
- Timeout/failure handling nhất quán theo contract.
- Bổ sung dashboard visibility cho action outcome.

### Phase 4 — Product demo readiness
- Kịch bản demo 3–5 phút ổn định.
- One-command runbook cho người mới.
- Hoàn thiện docs vận hành và FAQ cho judge.

### Phase 5 — Post-MVP extensions
- Notification đa kênh (Telegram/Zalo/SMS/Email).
- Multi-zone risk map và replay timeline.
- Chuẩn bị CI smoke test chống regression.

---

## 12) Documentation map

- `docs/ARCHITECTURE.md` — kiến trúc chi tiết
- `docs/API_CONTRACT.md` — API contracts
- `docs/ENTITY_MODEL.md` — entity schemas
- `docs/README_HACKATHON.md` — quick start + positioning
- `docs/DEMO_SCRIPT.md` — flow demo
- `docs/TEST_REPORT.md` — kết quả test
- `docs/RISK_REGISTER.md` — risk và mitigation
- `docs/KPI_SCORECARD.md` — latency / action success / alert quality

---

## 13) Kết luận kỹ thuật

Project đã có nền end-to-end rõ ràng cho bài toán **Electrical Fire Detection & Prevention from Climate-Driven Heat Waves**: context-centric (Orion), decision-centric (Rule + MCP/AI), và action-centric (ACK + audit). Hướng ưu tiên hiện tại là tăng độ ổn định demo và độ tin cậy action pipeline trước khi mở rộng production features.