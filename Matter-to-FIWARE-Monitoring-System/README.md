# Resilience Copilot Monitor (MVP)

## 📌 Tài liệu định hướng nhanh

- Master Plan (đầy đủ): `HACKATHON_MVP_MASTER_PLAN.md`
- Hackathon docs index: `docs/README_HACKATHON.md`
- Kiến trúc: `docs/ARCHITECTURE.md`
- API contract: `docs/API_CONTRACT.md`
- Entity model: `docs/ENTITY_MODEL.md`
- Demo script: `docs/DEMO_SCRIPT.md`
- Team roles: `docs/TEAM_ROLES.md`
- Risk register: `docs/RISK_REGISTER.md`
- Script chạy nhanh:
  - `scripts/dev-up.ps1`
  - `scripts/smoke-test.ps1`
  - `scripts/demo-scenario.ps1`

## 1) Project này giải quyết bài toán gì?

`Matter-to-FIWARE-Monitoring-System` là một hệ thống mô phỏng giám sát rủi ro thiên tai quy mô nhỏ (MVP), tập trung vào:

- **Thu thập dữ liệu cảm biến IoT theo ngữ nghĩa Matter** (độ ẩm, trạng thái thiết bị, công suất điện)
- **Chuẩn hóa dữ liệu lên FIWARE Orion (NGSI-v2)**
- **Hiển thị theo thời gian gần thực (near real-time) trên dashboard web**
- **Làm nền cho cảnh báo sớm/ra quyết định vận hành**

Nói ngắn gọn: project giúp chứng minh luồng **thiết bị thông minh -> lớp tích hợp -> context broker -> giao diện giám sát** hoạt động đầy đủ.

---

## 2) Nhu cầu/vấn đề thực tế mà project đáp ứng

## 2.1. Vấn đề dữ liệu IoT phân mảnh, khó tích hợp
Trong thực tế, mỗi thiết bị có giao thức/format khác nhau. Điều này gây khó cho hệ thống giám sát tập trung.

**Project giải quyết bằng cách:**
- Dùng `FIMAT Agent` để chuyển event Matter sang chuẩn NGSI-v2
- Đưa dữ liệu vào `FIWARE Orion` để tạo **single source of context**

## 2.2. Thiếu môi trường thử nghiệm nhanh cho bài toán cảnh báo
Triển khai thật trên thiết bị vật lý tốn thời gian và chi phí.

**Project giải quyết bằng cách:**
- Dùng `matter-emulators` tạo cảm biến giả lập
- Cho phép test toàn bộ pipeline không cần phần cứng thực

## 2.3. Khó quan sát trạng thái hệ thống theo thời gian thực
Không có dashboard thì khó nhìn tổng quan, khó debug.

**Project giải quyết bằng cách:**
- `monitor-dashboard` gọi dữ liệu định kỳ mỗi 3 giây
- Hiển thị trạng thái kết nối, danh sách entities, dữ liệu raw, cảnh báo độ ẩm

## 2.4. Cần proof-of-concept cho kiến trúc Digital Twin/Context-aware
Các dự án thành phố thông minh, tòa nhà thông minh, cảnh báo môi trường cần một nền context broker.

**Project giải quyết bằng cách:**
- Thể hiện được mô hình context entity (HumiditySensor, SmartPlug)
- Có thể mở rộng sang thêm thiết bị, luật cảnh báo, automation

---

## 3) Ứng dụng thực tiễn của project

Project phù hợp cho các mục tiêu sau:

1. **Demo kiến trúc IoT tích hợp FIWARE** cho học tập, nghiên cứu, POC doanh nghiệp.
2. **Mô phỏng hệ giám sát rủi ro môi trường** (ngập, cháy, quá tải điện ở mức MVP).
3. **Nền tảng phát triển tiếp** cho:
   - Cảnh báo đa kênh (Telegram/Zalo/SMS/Email)
   - Rule engine nâng cao
   - Lưu lịch sử + phân tích xu hướng
   - Dashboard vận hành cho tòa nhà/kho/xưởng
4. **Môi trường test API NGSI-v2** trước khi kết nối thiết bị thật.

---

## 4) Bài toán nghiệp vụ cụ thể có thể triển khai từ project

## 4.1. Cảnh báo ẩm cao (nguy cơ ngập/mốc)
- Input: `measuredValue` từ HumiditySensor
- Rule ví dụ:
  - >80%: warning
  - >90%: critical
- Output: Cảnh báo trên dashboard + có thể mở rộng gửi thông báo

## 4.2. Theo dõi tải điện thiết bị
- Input: `onOff` và `activePower` từ SmartPlug
- Rule ví dụ:
  - Công suất cao kéo dài -> cảnh báo quá tải
  - Bật/tắt bất thường -> cảnh báo hành vi lạ

## 4.3. Bản đồ trạng thái tài sản theo context entity
- Mỗi thiết bị là một entity trong Orion
- Truy vấn tập trung để lập báo cáo trạng thái theo thời gian

---

## 5) Kiến trúc và vai trò từng thành phần

```text
Matter Emulators
   -> phát event mô phỏng
FIMAT Agent
   -> nhận event, chuyển đổi sang NGSI-v2, ghi vào Orion
FIWARE Orion (Context Broker)
   -> lưu/điều phối context entities
Proxy Server (3001)
   -> CORS bridge cho dashboard (forward /version, /v2/*)
Monitor Dashboard (8080)
   -> hiển thị realtime + cảnh báo + debug JSON
```

### Thành phần chính
- `matter-emulators/`: thiết bị giả lập độ ẩm + ổ cắm
- `fimat-agent/`: adapter Matter -> NGSI-v2
- `proxy-server.js`: proxy API Orion cho frontend
- `monitor-dashboard/`: UI giám sát
- `docker-compose.yml`: chạy Orion + MongoDB

---

## 6) Cách dùng project (đã chuẩn hóa theo trạng thái hiện tại)

## 6.1. Yêu cầu môi trường
- Docker + Docker Compose plugin
- Node.js >= 16 (đã test tốt với Node 24)
- Trình duyệt web

## 6.2. Khởi động nhanh (5 terminal)

### Terminal 1: Orion + Mongo
```bash
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System
docker compose up -d
```

Kiểm tra:
```bash
curl http://localhost:1026/version
```

### Terminal 2: Matter emulators
```bash
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\matter-emulators
npm install
npm start
```

### Terminal 3: FIMAT agent
```bash
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\fimat-agent
npm install
npm start
```

### Terminal 4: Proxy CORS cho dashboard
```bash
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System
node proxy-server.js
```

### Terminal 5: Serve dashboard
```bash
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\monitor-dashboard
npx http-server -p 8080
# hoặc python -m http.server 8080
```

Mở trình duyệt:
- `http://localhost:8080`

---

## 7) Cách kiểm tra hệ thống chạy đúng

## 7.1. Health checks
```bash
curl http://localhost:3000/health
curl http://localhost:3001/version
curl http://localhost:3001/v2/entities
```

## 7.2. Kiểm tra entities trọng yếu
```bash
curl http://localhost:1026/v2/entities/urn:ngsi-ld:MatterDevice:1_1
curl http://localhost:1026/v2/entities/urn:ngsi-ld:MatterDevice:2_1
```

Kỳ vọng:
- Humidity entity có `measuredValue`
- SmartPlug entity có cả `onOff` và `activePower`

## 7.3. Kiểm tra UI
- Orion status phải chuyển sang connected
- Device card cập nhật theo thời gian
- Debug JSON hiển thị entities mới nhất

---

## 8) Input / Output của hệ thống

## 8.1. Input
- Event từ mô phỏng Matter:
  - `nodeId`, `endpointId`, `clusterId`
  - `attributeName`, `attributeValue`
  - `timestamp`

## 8.2. Output
- NGSI-v2 entities trong Orion
- Dữ liệu hiển thị realtime trên dashboard
- Cảnh báo khi độ ẩm vượt ngưỡng

---

## 9) Giá trị mang lại theo từng vai trò

## 9.1. Kỹ sư phần mềm / tích hợp IoT
- Có sandbox nhanh để test luồng end-to-end
- Dễ debug logic mapping + API contract

## 9.2. Nhóm vận hành / giám sát
- Có dashboard trực quan theo thời gian gần thực
- Theo dõi tình trạng thiết bị và thông số quan trọng

## 9.3. Nhóm nghiên cứu / học tập
- Mẫu chuẩn cho kiến trúc context broker + digital twin foundation
- Dễ mở rộng thành đồ án, luận văn, hoặc POC doanh nghiệp

---

## 10) Giới hạn hiện tại (MVP)

1. Chưa dùng thiết bị Matter thật (đang mô phỏng).
2. Dashboard ở mức cơ bản, chưa có auth/role/observability nâng cao.
3. Chưa có lưu trữ lịch sử dài hạn, chủ yếu context hiện tại.
4. Rule cảnh báo còn đơn giản.
5. Chưa triển khai NGSI-LD (mới NGSI-v2).

---

## 11) Hướng mở rộng đề xuất

1. Kết nối thiết bị Matter thật hoặc gateway thực.
2. Thêm cơ chế cảnh báo đa kênh (Telegram/Email/SMS).
3. Bổ sung lưu lịch sử (TimescaleDB/InfluxDB/ClickHouse).
4. Xây rule engine nâng cao (multi-condition + hysteresis).
5. Thêm điều khiển ngược từ dashboard -> thiết bị.
6. Nâng cấp bảo mật: auth, API key, reverse proxy, TLS.

---

## 12) Khi nào nên dùng project này?

Nên dùng khi:
- Cần một hệ thống demo nhanh cho IoT + FIWARE.
- Cần kiểm chứng thiết kế dữ liệu context trước production.
- Cần môi trường test không phụ thuộc thiết bị vật lý.

Không nên dùng trực tiếp production khi chưa bổ sung:
- Bảo mật đầy đủ
- Giám sát/quan sát hệ thống nâng cao
- Cơ chế HA/backup/recovery

---

## 13) Tóm tắt ngắn

Đây là một **MVP giám sát IoT dựa trên Matter + FIWARE NGSI-v2**, giúp giải bài toán tích hợp dữ liệu cảm biến, chuẩn hóa context, và quan sát realtime trên dashboard. Project đặc biệt hữu ích để làm POC, demo kiến trúc, và nền tảng mở rộng thành hệ cảnh báo/vận hành thông minh hoàn chỉnh.
