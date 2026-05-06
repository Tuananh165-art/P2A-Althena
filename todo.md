# TODO KANBAN MVP (D1..D7) — Electrical Fire Detection

> Mục tiêu: build được **MVP chạy thật** với trọng tâm **AI phát hiện chập cháy điện do nắng nóng cực đoan**.

---

## 0) North Star (Big Idea)

**Climate Resilience Copilot** = nền tảng AI phát hiện rủi ro chập cháy điện từ nắng nóng cực đoan theo thời gian thực:
- Nhận dữ liệu từ IoT sensors: **nhiệt độ** (quá tải nhiệt), **điện năng** (quá tải lưới), **độ ẩm** (đoản mạch)
- Suy luận rủi ro chập cháy bằng Rule + MCP/AI Agent
- Tự động ngắt tải + cảnh báo khi phát hiện nguy hiểm (<= 5 giây)

**Một câu pitch:**
> AI phát hiện chập cháy điện do nắng nóng cực đoan trong 5 giây — trước khi cháy xảy ra.

**Mối liên hệ rõ ràng:**
```
Climate Change → Heat Wave (35-40°C+)
  → Electrical Overload (AC, cooling at max)
  → Wiring Overheat + Insulation Degradation
  → Short Circuit → ELECTRICAL FIRE
```

**Mục tiêu cụ thể:**
- Phát hiện rủi ro chập cháy <= 5 giây
- Tự động ngắt tải + cảnh báo
- 0 false negative cho sự kiện critical

---

## 1) Definition of Done (MVP)

MVP Climate Resilience chỉ được xem là DONE khi thỏa **đủ**:
- [ ] End-to-end chạy: Climate Sensor -> FIMAT -> Orion -> MCP AI Agent -> Climate Response -> Dashboard
- [ ] Phát hiện được ít nhất 2 loại rủi ro khí hậu: flood risk (humidity), grid stress (power)
- [ ] Có ít nhất 1 climate response action thành công + ACK (ngắt tải, cảnh báo)
- [ ] AI reasoner trả về climate-specific rationale (không phải generic)
- [ ] Dashboard hiển thị climate hazard language + smart city map
- [ ] `smoke-test` PASS 100%
- [ ] Demo chạy ổn định >= 10 phút
- [ ] Docs + scripts đủ để người mới chạy được <= 20 phút

---

## 2) Kanban theo ngày (D1..D7)

## D1 - Foundation & Repo Hygiene
**Mục tiêu ngày:** dựng hạ tầng sạch, thống nhất cấu trúc.

### To Do
- [x] Chuẩn hóa cấu trúc repo (`docs/`, `scripts/`, `todo.md`, `CLAUDE.md`)
- [x] Xác nhận mọi link README/docs trỏ đúng đường dẫn thật
- [ ] Chạy Orion + Mongo (`docker compose up -d`)
- [ ] Verify health: `1026/version`

### Deliverables
- [x] Repo không lệch path
- [ ] Infra lên ổn định

---

## D2 - Data Pipeline ổn định
**Mục tiêu ngày:** dữ liệu vào Orion đúng schema, không lỗi cơ bản.

### To Do
- [ ] Chạy `matter-emulators`, `fimat-agent`, `proxy-server`, dashboard
- [ ] Validate entity: humidity + smart plug (`onOff`, `activePower`)
- [ ] Kiểm tra fallback append attrs (tránh 422)
- [ ] Giảm log noise, giữ log signal

### Deliverables
- [ ] Pipeline ingest/context chạy liên tục
- [ ] Không còn lỗi block luồng dữ liệu

---

## D3 - MCP Layer Design (Core day)
**Mục tiêu ngày:** chốt contract MCP và control loop.

### To Do
- [x] Chốt tool contracts MCP:
  - [x] `query_entities(...)`
  - [x] `compute_risk(...)`
  - [x] `publish_alert(...)`
  - [x] `invoke_command(...)`
- [x] Chốt policy: rule-first, human-in-the-loop cho action nhạy cảm
- [x] Chốt model output schema (riskLevel, riskScore, rationale)

### Deliverables
- [x] `docs/API_CONTRACT.md` update MCP tools
- [x] `docs/ENTITY_MODEL.md` có `ZoneRisk`, `AlertEvent`, `CommandExecution`

---

## D4 - MCP Agent Build (Execution day)
**Mục tiêu ngày:** MCP Agent chạy được với Orion và action pipeline.

### To Do
- [x] Build MCP-FIWARE gateway/service
- [x] Nối MCP tools -> Orion query/update
- [x] Implement risk evaluation (rule baseline + AI reasoning)
- [x] Implement action path + ACK tracking

### Deliverables
- [x] MCP agent chạy local
- [x] Có log quyết định + rationale

---

## D5 - Productize UI & Scenario
**Mục tiêu ngày:** dashboard phục vụ demo, có kịch bản trình diễn rõ.

### To Do
- [x] Dashboard panel: risk, alert timeline, action status
- [x] Nút/flow simulate (`normal`, `warning`, `critical`)
- [x] Hiển thị command ACK/ERROR
- [ ] Chuẩn hóa demo script 3-5 phút

### Deliverables
- [ ] Demo flow mạch lạc nhìn thấy “AI + Context + Action”

---

## D6 - Test, Hardening, Failsafe
**Mục tiêu ngày:** chống fail khi live demo.

### To Do
- [ ] Chạy full `smoke-test`
- [ ] Test failure mode: Orion restart, hardware offline, duplicate events
- [ ] Thêm cooldown/dedupe alert
- [ ] Chuẩn bị fallback mock command + phương án backup

### Deliverables
- [ ] `docs/TEST_REPORT.md` có số liệu thật
- [ ] `docs/RISK_REGISTER.md` cập nhật mitigation thực tế

---

## D7 - Pitch & Freeze
**Mục tiêu ngày:** chốt bản thi.

### To Do
- [ ] Freeze demo branch
- [ ] Chốt KPI scorecard (latency, action success, alert quality)
- [ ] Dry-run pitch 2-3 vòng
- [ ] Đảm bảo one-command setup + smoke pass

### Deliverables
- [ ] Bản build demo ổn định
- [ ] Storyline thuyết phục judge

---

## 3) Backlog ưu tiên (sau D7 nếu còn giờ)
- [ ] WebSocket realtime thay polling
- [ ] Multi-zone heatmap
- [ ] Notification channel (Telegram/Email)
- [ ] Replay timeline mode

---

## 4) Pipeline chuẩn (bắt buộc không phá)

1. **Ingestion:** device/emulator event -> normalize
2. **Context:** upsert Orion entity/attrs
3. **Decision:** rule baseline -> MCP/AI reasoning
4. **Action:** publish alert + invoke command
5. **Feedback:** ACK/ERROR + audit trail + UI update

---

## 5) Checklist chạy nhanh mỗi ngày
- [ ] `dev-up` thành công
- [ ] `smoke-test` PASS
- [ ] `demo-scenario -Mode critical` phản ánh đúng trên dashboard
- [ ] Không có lỗi blocker trong log

---

## 6) Team Split (tick theo ngày)

## Software Team (MCP/AI/Agent/App)
- [x] D1: repo/docs/contracts
- [ ] D2: pipeline + entity integrity
- [x] D3: MCP tool design
- [x] D4: MCP gateway + reasoning + action
- [x] D5: dashboard product demo
- [ ] D6: test/hardening
- [ ] D7: pitch support

## Hardware Team (Device/IoT/Protocol)
- [ ] D1: thiết bị + wiring + an toàn
- [ ] D2: feed telemetry ổn định
- [ ] D3: command contract (ACK/ERROR)
- [ ] D4: bridge command software->device
- [ ] D5: live action demo
- [ ] D6: fallback khi hardware fail
- [ ] D7: demo rehearsal

---

## 7) Nguyên tắc vận hành
- Rule-first, AI-second
- Human-in-the-loop cho action nhạy cảm
- Mọi thay đổi contract phải update docs
- Chỉ demo những gì đã test pass
