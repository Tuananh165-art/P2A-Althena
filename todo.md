# TODO MVP - Matter x FIWARE x MCP (Tiếng Việt)

Tài liệu này tổng hợp **requirement, đầu việc, workflow step-by-step, roadmap, pipeline** để build và chạy project ở mức **MVP demo hackathon**.

---

## 1) Mục tiêu MVP (đích cần đạt)

## 1.1 Mục tiêu sản phẩm
- Chạy end-to-end luồng:
  **Device/Emulator -> FIMAT Agent -> FIWARE Orion -> Dashboard -> (MCP/AI đề xuất + action demo)**
- Có ít nhất 1 kịch bản rủi ro (warning/critical) và 1 hành động demo thành công.

## 1.2 Mục tiêu kỹ thuật
- Hệ thống chạy ổn định 10 phút demo liên tục.
- Có script start nhanh + smoke test.
- Có docs đủ để người mới chạy được trong 20 phút.

## 1.3 KPI tối thiểu
- Sensor -> Alert latency <= 5 giây (mục tiêu MVP)
- Action ACK success rate >= 90% (trong môi trường demo)
- Không crash trong phiên demo

---

## 2) Requirement tổng hợp

## 2.1 Functional Requirements
1. Ingest dữ liệu từ Matter emulator/thiết bị.
2. Chuẩn hóa dữ liệu sang NGSI-v2 entity/attributes.
3. Ghi/cập nhật dữ liệu lên Orion.
4. Dashboard hiển thị trạng thái realtime.
5. Cảnh báo theo ngưỡng (rule-based baseline).
6. Có khả năng kích hoạt hành động demo (bật đèn/ngắt plug hoặc mock command).
7. Ghi log + audit trail cho alert và action.

## 2.2 Non-functional Requirements
1. Độ ổn định demo cao, log gọn, không spam.
2. Có fallback khi service/hardware lỗi.
3. Không dùng dữ liệu cá nhân (PII).
4. Có human-in-the-loop cho hành động nhạy cảm.

## 2.3 Documentation Requirements
- Có đủ các tài liệu trong `/docs`:
  - README_HACKATHON, ARCHITECTURE, API_CONTRACT, ENTITY_MODEL,
    DEMO_SCRIPT, TEST_REPORT, TEAM_ROLES, RISK_REGISTER.
- README chính có link đầy đủ tới docs và scripts.

---

## 3) Workflow triển khai step-by-step

## Bước 0 - Chuẩn bị môi trường
- [ ] Cài Docker + Docker Compose
- [ ] Cài Node.js
- [ ] Clone repo
- [ ] Kiểm tra port: 1026, 3000, 3001, 8080

## Bước 1 - Dựng hạ tầng lõi
- [ ] Chạy Orion + Mongo bằng `docker compose up -d`
- [ ] Verify `http://localhost:1026/version`

## Bước 2 - Chạy data pipeline
- [ ] Chạy `matter-emulators`
- [ ] Chạy `fimat-agent`
- [ ] Chạy `proxy-server.js`
- [ ] Chạy dashboard static server (8080)

## Bước 3 - Kiểm tra nhanh (smoke test)
- [ ] `GET /version` Orion = 200
- [ ] `GET /version` Proxy = 200
- [ ] `GET /health` FIMAT = ok
- [ ] `GET /v2/entities` qua proxy = 200
- [ ] Mở dashboard thành công

## Bước 4 - Kiểm tra dữ liệu nghiệp vụ
- [ ] Entity humidity có `measuredValue`
- [ ] Entity smart plug có cả `onOff` + `activePower`
- [ ] Timestamp/unit metadata đúng format

## Bước 5 - Thiết lập logic cảnh báo
- [ ] Rule warning/critical theo ngưỡng
- [ ] Cooldown chống spam alert
- [ ] Tạo risk summary (theo zone hoặc device)

## Bước 6 - Action demo
- [ ] Chọn action demo (đèn/plug)
- [ ] Thực hiện command
- [ ] Nhận ACK/ERROR và hiển thị trên UI/log

## Bước 7 - Chuẩn bị demo
- [ ] Chạy script scenario (`normal/warning/critical`)
- [ ] Đo KPI tối thiểu
- [ ] Chốt demo script 3-5 phút
- [ ] Rehearsal ít nhất 2 vòng

---

## 4) Pipeline kỹ thuật chuẩn

1. **Ingestion Layer**
   - Nhận event từ emulator/device
   - Normalize payload
2. **Context Layer**
   - Upsert entity vào Orion
   - Fallback append khi thiếu attribute
3. **Decision Layer**
   - Rule engine baseline (bắt buộc)
   - MCP/AI reasoning (nâng cao)
4. **Action Layer**
   - Trigger command
   - ACK/ERROR
5. **Observability Layer**
   - Log, health check, smoke test, audit trail

---

## 5) Roadmap MVP (7-10 ngày)

## Phase 1 (Ngày 1-2): Foundation
- [ ] Chuẩn hóa cấu trúc repo/docs/scripts
- [ ] Chạy end-to-end cơ bản

## Phase 2 (Ngày 3-4): Risk + Alert
- [ ] Hoàn thiện rule warning/critical
- [ ] Tạo panel alert/timeline

## Phase 3 (Ngày 5-6): Action + Hardware bridge
- [ ] Command action demo có ACK
- [ ] Fallback mock command

## Phase 4 (Ngày 7): Demo hardening
- [ ] KPI đo được
- [ ] Freeze demo branch
- [ ] Tài liệu/pitch hoàn chỉnh

(Thêm 2-3 ngày buffer nếu còn thời gian cho polishing)

---

## 6) Checklist đồng bộ & chuẩn chỉnh trước khi chốt

## 6.1 Đồng bộ code/docs
- [ ] README link đúng file thật
- [ ] docs nằm đúng trong thư mục project
- [ ] scripts nằm đúng trong `scripts/`
- [ ] Không có file lạc vị trí gây `git status` rối

## 6.2 Đồng bộ contract dữ liệu
- [ ] Entity ID naming nhất quán
- [ ] Attribute key không đổi tùy hứng
- [ ] Metadata timestamp/unit đầy đủ

## 6.3 Đồng bộ vận hành
- [ ] `dev-up` chạy được
- [ ] `smoke-test` PASS
- [ ] `demo-scenario` hoạt động

---

## 7) Rủi ro chính và cách giảm thiểu

1. **Lệch cấu trúc repo/docs**
   - Cách xử lý: chuẩn hóa path, commit cleanup ngay.
2. **Xung đột port khi demo**
   - Cách xử lý: kill tiến trình cũ trước khi start.
3. **Alert spam/false positive**
   - Cách xử lý: dedupe + cooldown window.
4. **Hardware lỗi**
   - Cách xử lý: có mock command fallback + video backup.
5. **AI không ổn định**
   - Cách xử lý: rule-first, AI chỉ tăng cường giải thích/đề xuất.

---

## 8) Team task split (gợi ý ngắn)

## Team Software
- [ ] FIMAT/Orion/proxy ổn định
- [ ] Dashboard + risk/alert
- [ ] MCP tool contracts + action pipeline
- [ ] Smoke/regression test

## Team Hardware
- [ ] Thiết bị đèn/plug/sensor
- [ ] Bridge command + ACK
- [ ] Kiểm thử an toàn và fallback

---

## 9) Definition of Done (DoD) MVP

MVP hoàn tất khi:
- [ ] Flow end-to-end chạy ổn định
- [ ] Có alert đúng ngữ cảnh
- [ ] Có action thành công + ACK
- [ ] Có script chạy nhanh + smoke test PASS
- [ ] Có docs đầy đủ, người mới chạy được

---
