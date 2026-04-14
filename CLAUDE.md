# CLAUDE.md

## Purpose
Tài liệu này định nghĩa **rule + context + pattern bắt buộc** khi build và mở rộng project `Matter-to-FIWARE-Monitoring-System`.
Mục tiêu: giữ flow đồng bộ, tránh lệch kiến trúc, tăng độ ổn định demo/hackathon.

---

## 1) Non-negotiable Rules (bắt buộc)

1. **Không phá vỡ flow lõi:** `Device/Event -> FIMAT -> Orion -> Dashboard/MCP -> Action/Ack`.
2. **Rule-first, AI-second:** logic cảnh báo cơ bản phải chạy được ngay cả khi AI layer lỗi.
3. **Mọi action phải có audit trail:** ai/khi nào/vì sao/kết quả.
4. **Hành động nhạy cảm cần Human-in-the-loop** (unlock/ngắt điện diện rộng).
5. **Không dùng PII** trong MVP; chỉ telemetry device/zone.
6. **Không hardcode config môi trường** trong code; dùng config/env.
7. **Mọi thay đổi contract phải cập nhật docs tương ứng** (`API_CONTRACT.md`, `ENTITY_MODEL.md`, `README_HACKATHON.md`).

---

## 2) Context bắt buộc

## 2.1 Product Context
- Project thuộc track climate resilience.
- Product định vị: AI điều phối ứng phó dựa trên context realtime, không phải chatbot.

## 2.2 Technical Context
- Context broker trung tâm: **FIWARE Orion**.
- Dữ liệu thiết bị chuẩn hóa về NGSI-v2 entities.
- Proxy phải pass được `/version` và `/v2/*` cho dashboard.

## 2.3 Demo Context
- Mục tiêu demo 3–5 phút.
- Có ít nhất 1 scenario cảnh báo và 1 command action thành công.

---

## 3) Architecture Pattern (chuẩn)

## 3.1 Ingestion Pattern
- Nhận event từ thiết bị/emulator.
- Normalize về schema chuẩn.
- Upsert entity vào Orion.
- Nếu attr chưa có, dùng append fallback.

## 3.2 Decision Pattern
- Rule engine tính risk baseline.
- MCP/AI bổ sung reasoning + recommendation.
- Chỉ trigger action khi policy cho phép.

## 3.3 Action Pattern
- Action request -> device command -> ACK/ERROR.
- Ghi log đầy đủ trước/sau action.
- Timeout/failure phải có fallback.

## 3.4 Anti-spam Pattern
- Dedupe event key theo cửa sổ thời gian.
- Cooldown alert để tránh spam dashboard/user.

---

## 4) Data Pattern

1. Mỗi telemetry attribute có metadata:
   - `timestamp`
   - `unit` (nếu có)
2. Entity ID ổn định, không đổi tùy hứng theo từng lần chạy.
3. Không đổi tên field nếu chưa có migration/docs update.

---

## 5) Coding Pattern

1. **Idempotent** cho các thao tác create/update quan trọng.
2. Xử lý lỗi theo tầng:
   - network lỗi,
   - dữ liệu lỗi,
   - service down.
3. Log ngắn gọn, có prefix module (`[OrionClient]`, `[FIMAT]`, `[MCP]`).
4. Tránh log spam; ưu tiên signal hơn noise.

---

## 6) Build/Test Gate (bắt buộc trước demo)

Trước khi merge hoặc demo:
1. Chạy `scripts/dev-up.ps1`.
2. Chạy `scripts/smoke-test.ps1` phải PASS.
3. Chạy `scripts/demo-scenario.ps1 -Mode critical` thấy dữ liệu đổi đúng.
4. Dashboard mở được tại `http://localhost:8080`.
5. Xác nhận entity SmartPlug có cả `onOff` + `activePower`.

Nếu bất kỳ bước nào fail -> không chốt build demo.

---

## 7) Team Workflow Pattern

1. Mọi feature đều đi qua chu trình:
   - Issue -> Design note -> Implement -> Test -> Docs update.
2. Không merge trực tiếp code phá contract dữ liệu.
3. Freeze demo branch trước giờ thi 12h.
4. Có người owner rõ cho từng mảng:
   - Ingestion,
   - Dashboard,
   - MCP/AI,
   - Hardware bridge.

---

## 8) Done Criteria (MVP)

MVP được xem là hoàn tất khi:
- Flow end-to-end chạy ổn định.
- Có cảnh báo đúng ngữ cảnh.
- Có action demo thành công và có ACK.
- Có docs và scripts đủ để người mới chạy trong 15–20 phút.

---

## 9) Recommendation ưu tiên tiếp theo

1. Thêm `scripts/dev-down.ps1` để stop stack sạch.
2. Thêm `docs/JUDGE_FAQ_SHORT.md` bản 1 trang để pitch nhanh.
3. Bổ sung `docs/KPI_SCORECARD.md` ghi latency/action success/alert precision.
4. Đưa smoke test vào CI local (nếu kịp) để chống regression trước demo.
