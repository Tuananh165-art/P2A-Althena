# HACKATHON MVP MASTER PLAN

## Project Name (đề xuất)
**Resilience Copilot: Matter x FIWARE x MCP for Disaster Response**

---

## 0) Executive Summary (Big Idea)

### Big Idea
Biến dữ liệu **smart home mức vi mô** (độ ẩm, điện năng, trạng thái thiết bị) thành **hành động ứng phó thiên tai theo thời gian gần thực** thông qua:

- **Matter** (chuẩn IoT thiết bị)
- **FIWARE Orion** (context broker / digital twin runtime)
- **MCP Agent** (AI orchestration: đọc context, suy luận rủi ro, kích hoạt action)

### 1 câu chốt hackathon
> Đây không phải chatbot hỏi-đáp; đây là **AI điều phối hành động** dựa trên context sống của hạ tầng IoT.

### Tác động
- Giảm độ trễ phát hiện sự cố cục bộ (ngập, ẩm cao, bất thường điện)
- Hỗ trợ cảnh báo + đề xuất xử lý + trigger thiết bị (đèn, ổ cắm)
- Là nền móng cho smart building / smart city resilience

### Strategic Focus (MCP + AI Agent First)
Trong bản MVP này, **MCP + AI Agent là lõi sản phẩm**:
1. MCP chuẩn hóa tool contracts giữa AI và hạ tầng FIWARE.
2. AI Agent không chỉ phân tích mà phải **orchestrate action loop**.
3. Dashboard là lớp quan sát/điều khiển, không phải giá trị cốt lõi duy nhất.
4. Rule engine là baseline an toàn, AI là lớp reasoning + tối ưu quyết định.

---

## 1) Căn cứ từ tài liệu đã đọc

## 1.1 Từ paper `1-s2.0-S0140366425003263-main.pdf`
Các điểm cốt lõi:
- FIWARE + Matter là hướng tích hợp mới, tăng khả năng liên thông Smart Home -> Smart City.
- Dữ liệu vi mô từ nhà dân có ích cho hazard map và evacuation.
- Vai trò IoT Agent là cầu nối protocol, chuẩn hóa sang NGSI.
- Orion Context Broker là lõi quản trị context, giúp dịch vụ ra quyết định realtime.

## 1.2 Từ `Idea.docx`
- Đề xuất chính xác track: Climate Change Resilience.
- Flow demo phù hợp hackathon: humidity tăng + activePower bất thường -> risk score theo zone -> cảnh báo + action.
- Nhấn mạnh human-in-the-loop cho hành động nhạy cảm.

## 1.3 Từ `Đưa giao thức MCP vào FIWARE.docx`
- MCP và FIWARE **bổ sung nhau**:
  - MCP chuẩn hóa cách AI dùng tool/context/action.
  - FIWARE chuẩn hóa context entity và mô hình dữ liệu.
- Mapping hợp lý: MCP resource/tool/context ↔ FIWARE entity/command/attributes.
- Khả thi xây **FIWARE MCP Agent/Gateway** theo tinh thần IoT Agent.

## 1.4 Từ repo `Matter-to-FIWARE-Monitoring-System`
Hiện có nền MVP chạy được:
- `matter-emulators/` phát event
- `fimat-agent/` chuyển đổi event sang NGSI-v2
- `docker-compose.yml` chạy Orion + Mongo
- `proxy-server.js` làm bridge `/version`, `/v2/*`
- `monitor-dashboard/` hiển thị realtime

---

## 2) Problem Statement (bài toán rõ ràng)

Trong các tình huống thiên tai/khẩn cấp ở khu dân cư (mưa lớn, ngập, chập điện, khói cháy):
- Dữ liệu thiết bị có, nhưng phân tán, khác chuẩn.
- Thiếu lớp context chung để tổng hợp và suy luận.
- Thiếu cơ chế tự động đề xuất hành động theo mức rủi ro.

**Bài toán dự án giải quyết:**
1. Chuẩn hóa telemetry từ thiết bị về một context model thống nhất.
2. Tính risk score theo zone/household gần realtime.
3. Đưa ra cảnh báo + hành động đề xuất + điều khiển thiết bị demo.

---

## 3) Scope MVP (hackathon-ready product)

## 3.1 In-scope (phải có)
1. Thu dữ liệu từ 2–5 thiết bị (emulator + tối thiểu 1–2 thiết bị vật lý nếu kịp).
2. Đồng bộ lên Orion (entities + attributes).
3. Rule engine đơn giản + AI reasoning có kiểm soát.
4. Dashboard hiển thị:
   - trạng thái kết nối
   - risk score theo zone
   - timeline sự kiện
   - alert feed
5. Action demo:
   - bật đèn cảnh báo
   - ngắt/bật smart plug (hoặc mô phỏng command ack)

## 3.2 Out-of-scope (không làm trong hackathon)
- Production-grade security/HA đầy đủ
- Mô hình ML phức tạp cần training lớn
- NGSI-LD full semantic graph production

---

## 4) Techstack chuẩn đề xuất

## 4.1 Core runtime
- **Node.js**: FIMAT Agent, MCP Gateway, Proxy
- **Docker Compose**: Orion + MongoDB
- **FIWARE Orion Context Broker**: context store / query / update
- **Matter libs/emulator**: tạo nguồn event thiết bị

## 4.2 App/UI
- **Vanilla JS/React (tùy)** cho dashboard
- HTTP polling hoặc WebSocket (nếu kịp)

## 4.3 AI/MCP layer (ưu tiên cao nhất)
- MCP Server (custom): tools cho FIWARE query/action
- AI model endpoint (OpenAI/Claude/local tùy budget)
- Policy/rule guardrail trước khi cho action
- Agent memory ngắn hạn theo phiên để theo dõi diễn tiến sự cố
- Prompt/policy template để đảm bảo hành vi nhất quán
- Action authorization flow (human-in-the-loop với command nhạy cảm)

## 4.4 Hardware (đơn giản, dễ demo)
- ESP32 + relay + bulb (đèn cảnh báo)
- Smart plug có đo công suất (nếu có)
- Sensor humidity (DHT11/DHT22) hoặc giả lập qua emulator

---

## 5) Architecture (chuẩn cho demo)

```text
[Physical/Emulated Devices]
  - Humidity Sensor
  - Smart Plug (onOff, activePower)
  - Alert Lamp
          |
          | Matter telemetry / emulator events
          v
[FIMAT Agent]
  - device discovery
  - semantic mapping (Matter -> NGSI-v2)
  - upsert entity attributes
          |
          v
[FIWARE Orion Context Broker]
  - latest context store
  - unified API for apps/agents
          |
     +----+----------------------+
     |                           |
     v                           v
[Dashboard]                 [MCP-FIWARE Agent]
- realtime status           - query context tools
- risk heatmap/timeline     - risk reasoning
- manual override           - publish alerts
                            - invoke device commands
```

## Kiến trúc điều khiển (control loop)
1. Sensor/event vào Orion.
2. MCP Agent đọc context mới nhất.
3. Tính risk score + rationale.
4. Nếu vượt ngưỡng: tạo alert entity + trigger command.
5. Dashboard phản ánh trạng thái + outcome.

---

## 6) Feature roadmap (MVP -> Product)

## 6.1 MVP features bắt buộc
- F1: Device telemetry ingestion (Matter/emulator)
- F2: NGSI entity synchronization (Orion)
- F3: Zone risk scoring (rule-based)
- F4: MCP tool layer (query/compute/publish/invoke)
- F5: AI Agent reasoning + rationale output theo schema chuẩn
- F6: Alert center (warning/critical)
- F7: One-click simulate disaster event
- F8: Command execution demo (light/plug)
- F9: Audit trail (event + action + ack)

## 6.2 Stretch features (nếu còn thời gian)
- S1: AI narrative summary ("vì sao hệ thống cảnh báo")
- S2: Human approval flow cho action nhạy cảm
- S3: Multi-zone map UI
- S4: Telegram bot push alert
- S5: Replay mode (phát lại timeline sự cố)

---

## 7) Team split 2 mảng (Software vs Hardware)

## 7.1 Team A – Software (MCP/AI/Agent/App/Protocol)
**Mục tiêu:** hoàn thành luồng dữ liệu, suy luận, dashboard, control API.

### Vai trò
- A1: Lead backend integration (FIWARE + FIMAT)
- A2: MCP/AI engineer
- A3: Frontend dashboard engineer
- A4: QA + integration support

### Task chính
1. Chuẩn hóa entity schema và naming.
2. Hoàn thiện API/query layer cho dashboard.
3. Xây MCP tools:
   - `query_entities(zone, window)`
   - `compute_risk(zone)`
   - `publish_alert(level, message, zone)`
   - `invoke_command(deviceId, action)`
4. Rule guardrail trước action.
5. Build dashboard + simulation panel.
6. Viết test smoke + integration.

## 7.2 Team B – Hardware (IoT/device/protocol)
**Mục tiêu:** dựng thiết bị vật lý đơn giản chạy ổn định để demo.

### Vai trò
- B1: Device wiring + firmware
- B2: Protocol bridge (Matter/MQTT/serial-to-agent)
- B3: Reliability + power safety

### Task chính
1. Chuẩn bị bộ demo:
   - đèn cảnh báo (relay + bulb)
   - ổ cắm/relay mô phỏng tải
   - cảm biến độ ẩm (thật hoặc giả lập phần cứng)
2. Định nghĩa command contract (ON/OFF, ACK, ERROR).
3. Kết nối command từ software sang thiết bị.
4. Chuẩn bị fallback nếu thiết bị lỗi (mock command).
5. Diễn tập tình huống demo và an toàn điện.

---

## 8) Task Board chi tiết (step-by-step)

## Phase 0 – Foundation (Day 1)
- [ ] Chốt big idea, problem, KPI demo
- [ ] Chốt schema entities (HumiditySensor, SmartPlug, Alert, ZoneRisk)
- [ ] Chốt script run all services

## Phase 1 – Data Pipeline (Day 1-2)
- [ ] Kiểm tra ingest ổn định từ emulator -> FIMAT -> Orion
- [ ] Chuẩn hóa mapping attribute + metadata timestamp/unit
- [ ] Thiết lập health endpoints + smoke test

## Phase 2 – Risk Engine (Day 2-3)
- [ ] Viết rule risk score theo ngưỡng
- [ ] Tạo `ZoneRisk` entity cập nhật định kỳ/sự kiện
- [ ] Tạo `Alert` entity cho warning/critical

## Phase 3 – MCP Agent (Day 3-4) [CRITICAL PATH]
- [ ] Thiết kế MCP tool contracts
- [ ] Implement MCP-FIWARE Gateway
- [ ] Thêm policy: action nhạy cảm cần xác nhận
- [ ] Log lý do AI quyết định (reason trace)
- [ ] Chuẩn hóa output AI: riskLevel/riskScore/rationale/recommendedAction
- [ ] Tạo test cases riêng cho MCP tool calls + safety policy

## Phase 4 – Dashboard Product (Day 4-5)
- [ ] Heatmap zone + timeline
- [ ] Alert panel + action panel
- [ ] Nút simulate event theo kịch bản
- [ ] Demo mode (auto script 3 phút)

## Phase 5 – Hardware Integration (song song)
- [ ] Kết nối relay light/plug
- [ ] Test command latency + ack
- [ ] Tạo fallback mock khi phần cứng mất kết nối

## Phase 6 – Hardening & Pitch (Day 6-7)
- [ ] End-to-end stability test 2h
- [ ] Chuẩn bị script 1-click run
- [ ] Chuẩn bị deck: problem -> solution -> impact -> demo
- [ ] Dry-run pitch 3 vòng

---

## 9) Rules, governance, safety

1. **Human-in-the-loop** cho hành động nguy hiểm (unlock/ngắt điện diện rộng).
2. Không dùng PII; chỉ telemetry theo device/zone.
3. Mọi action phải có audit log:
   - ai/khi nào
   - vì sao
   - kết quả ACK/ERROR
4. Fail-safe mặc định:
   - mất AI -> vẫn chạy rule cơ bản
   - mất hardware -> dashboard báo degraded mode

---

## 10) Context model & pattern chuẩn

## 10.1 Entity pattern (NGSI-v2)
- `MatterDevice` (HumiditySensor/SmartPlug)
- `ZoneRisk`
- `AlertEvent`
- `CommandExecution`

## 10.2 Attribute pattern
- Mọi attribute có:
  - `type`
  - `value`
  - `metadata.timestamp`
  - `metadata.unit` (nếu có)

## 10.3 Pattern xử lý sự kiện
- Ingestion -> Normalize -> Upsert -> Evaluate Risk -> Alert -> Command -> Ack -> Audit

## 10.4 Idempotency pattern
- Event key: `{deviceId}:{attribute}:{timestampBucket}`
- Tránh duplicate alert trong cửa sổ 30–60 giây

---

## 11) Test plan (đầy đủ nhưng gọn cho hackathon)

## 11.1 Smoke test
- `/version` Orion = 200
- `/v2/entities` qua proxy = 200
- `/health` FIMAT = ok
- dashboard tải được

## 11.2 Integration test
- T1: humidity tăng -> ZoneRisk tăng
- T2: activePower bất thường -> alert warning
- T3: risk critical -> command bật đèn cảnh báo
- T4: command ack -> dashboard hiển thị success

## 11.3 Failure test
- F1: Orion down -> hiện degraded mode
- F2: hardware offline -> fallback mock + warning
- F3: duplicate events -> không tạo alert spam

## 11.4 Demo acceptance criteria
- End-to-end latency sensor->alert <= 5 giây (MVP)
- Command success rate >= 90% trong 20 lần test
- Không crash trong phiên demo 10 phút

---

## 12) Script & runbook đề xuất

## 12.1 Scripts cần có
- `scripts/dev-up.ps1`: start toàn bộ stack
- `scripts/dev-down.ps1`: stop toàn bộ stack
- `scripts/smoke-test.ps1`: health + entity checks
- `scripts/demo-scenario.ps1`: bơm event kịch bản demo

## 12.2 Quy tắc script
- Một script = một nhiệm vụ rõ ràng
- In log ngắn, có mã màu trạng thái
- Exit code chuẩn để CI/check tự động

---

## 13) Skills/capability matrix cho team

## Software skillset
- Node.js backend integration
- REST + NGSI-v2
- Event-driven architecture
- MCP tool design
- Frontend realtime dashboard

## Hardware skillset
- ESP32/relay wiring
- Basic electrical safety
- Firmware command handling
- Device protocol bridge

## PM/Product skillset
- Storyline demo
- KPI impact framing
- Risk management
- Judge-oriented pitch

---

## 14) Documentation structure (chuẩn giao nộp)

```text
/docs
  README_HACKATHON.md
  ARCHITECTURE.md
  API_CONTRACT.md
  ENTITY_MODEL.md
  DEMO_SCRIPT.md
  TEST_REPORT.md
  TEAM_ROLES.md
  RISK_REGISTER.md
```

---

## 15) README template (nội dung phải có)

1. What problem we solve
2. Big idea and innovation
3. System architecture
4. Quick start (5 bước)
5. Demo flow (3 phút)
6. Metrics / evaluation
7. Limitations + future work
8. Team contribution split

---

## 16) Demo storyboard (3–5 phút)

1. **Problem (30s):** thiên tai cần phản ứng nhanh ở mức vi mô.
2. **System view (45s):** Matter -> FIMAT -> Orion -> MCP -> Dashboard/Device.
3. **Live simulation (2 phút):**
   - bơm sự kiện humidity + power bất thường
   - risk score tăng + alert hiện ra
   - AI đề xuất action + bật đèn cảnh báo
4. **Impact (30s):** giảm độ trễ ra quyết định, mở rộng cho đô thị thông minh.
5. **Roadmap (30s):** productionization và mở rộng multi-zone.

---

## 17) Product positioning cho hackathon

- **Innovation:** kết hợp chuẩn mở Matter + FIWARE + MCP AI orchestration.
- **Feasibility:** đã có pipeline chạy thực tế trong repo hiện tại.
- **Impact:** trực tiếp vào climate resilience, emergency response.
- **Scalability:** từ 1 nhà -> 1 khu -> nhiều zone đô thị.

---

## 18) Risk register (rủi ro và giảm thiểu)

1. **Hardware trục trặc lúc demo**
   - Mitigation: có mock command fallback + video backup.
2. **MCP/AI trả lời không ổn định**
   - Mitigation: rule-first, AI là lớp giải thích/tối ưu.
3. **Latency tăng khi tải cao**
   - Mitigation: cache context, giảm polling interval hợp lý.
4. **Alert spam**
   - Mitigation: debounce + cooldown window.

---

## 19) Definition of Done (DoD) cho MVP

MVP được xem là hoàn thành khi:
- [ ] Dữ liệu từ device/emulator vào Orion ổn định
- [ ] Dashboard hiển thị realtime + risk + alerts
- [ ] Có ít nhất 1 action điều khiển thiết bị thành công
- [ ] Có log/audit giải thích vì sao action xảy ra
- [ ] Có script chạy demo một chạm + tài liệu rõ ràng

---

## 20) Kế hoạch 14 ngày (nếu có đủ thời gian)

- **W1D1-D2:** pipeline + schema + smoke
- **W1D3-D4:** risk engine + alerts + dashboard cơ bản
- **W1D5-D6:** MCP gateway + action policy
- **W1D7:** hardware integration vòng 1
- **W2D1-D2:** polish UI + script demo
- **W2D3:** test failure mode
- **W2D4:** pitch deck + storytelling
- **W2D5:** full rehearsal
- **W2D6-D7:** buffer/fix cuối

---

## 21) Kết luận chiến lược

Dự án nên được trình bày như một **Resilience Operating Layer** cho smart home/smart city:
- Không chỉ hiển thị dữ liệu,
- mà còn **ra quyết định có kiểm soát**,
- và **kích hoạt hành động thực tế**.

Đây là điểm khác biệt lớn nhất để thắng hackathon: **AI + Context + Action**, gắn impact xã hội rõ ràng.
