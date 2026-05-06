# Climate Resilience Copilot (MVP)

## 1) Project này giải quyết bài toán gì?

**Bài toán cụ thể:** Nắng nóng cực đoan do biến đổi khí hậu → tiêu thụ điện tăng vọt (điều hòa, tải lạnh) → quá tải lưới → **chập cháy điện**. Mối liên hệ:
```
Climate Change → Heat Wave (35-40°C+) → Electrical Overload → Wiring Overheat → Short Circuit → FIRE
```

**Giải pháp:** `Climate Resilience Copilot` — nền tảng AI phát hiện rủi ro chập cháy điện **trong 5 giây**:

- **Cảm biến nhiệt độ** (°C) → phát hiện quá tải nhiệt dây dẫn — nguyên nhân trực tiếp gây cháy
- **Ổ cắm thông minh** (W) → giám sát tải điện, phát hiện quá tải
- **Cảm biến độ ẩm** (%RH) → phát hiện rủi ro đoản mạch do ẩm + điện
- **FIWARE Orion** → digital twin realtime
- **MCP AI Agent** → suy luận rủi ro chập cháy bằng Rule + LLM
- **Tự động ngắt tải** + cảnh báo khi phát hiện nguy hiểm, 0 false negative

**Mục tiêu cụ thể:** Phát hiện <= 5 giây, tự động ngắt tải, 0 false negative cho critical.

---

## 2) Bài toán cụ thể: Chập cháy điện do nắng nóng

## 2.1. Mối liên hệ Climate Change → Electrical Fire
Biến đổi khí hậu → nắng nóng cực đoan (35-40°C+) → nhu cầu điện tăng vọt (điều hòa, tải lạnh) → quá tải lưới → **chập cháy điện**. Đây là nguyên nhân #1 gây cháy tại đô thị.

**Project giải quyết bằng cách:**
- Cảm biến nhiệt độ (°C) → phát hiện quá tải nhiệt dây dẫn
- Ổ cắm thông minh (W) → giám sát tải điện thực tế
- Cảm biến độ ẩm (%RH) → phát hiện rủi ro đoản mạch
- AI kết hợp 3 chỉ số → đánh giá rủi ro chập cháy tổng hợp

## 2.2. Hệ thống cảnh báo hiện tại phản ứng quá chậm
Phát hiện quá tải/chập cháy thường dựa vào con người — mất vài phút đến vài giờ. Khi cháy xảy ra, đã quá muộn.

**Project giải quyết bằng cách:**
- Rule engine baseline + AI reasoning phát hiện rủi ro trong **<= 5 giây**
- Tự động ngắt tải khi phát hiện nguy hiểm
- End-to-end latency: Sensor (5s) → Orion → MCP Agent (5s poll) → Action

## 2.3. Dữ liệu IoT phân mảnh, khó tích hợp
Mỗi cảm biến có giao thức/format khác nhau. Không có single source of truth.

**Project giải quyết bằng cách:**
- FIMAT Agent chuyển event Matter → NGSI-v2
- FIWARE Orion làm digital twin thống nhất
- Mọi quyết định dựa trên context thống nhất

## 2.4. Cần proof-of-concept cho Fire Detection Platform
Các tòa nhà, khu công nghiệp, chung cư cần nền tảng phát hiện chập cháy tự động.

**Project giải quyết bằng cách:**
- Demo kiến trúc IoT + Context Broker + AI Agent hoàn chỉnh
- 3 cảm biến: nhiệt độ, điện năng, độ ẩm → phát hiện chập cháy
- Scalable: 1 nhà → 1 tòa nhà → 1 khu phố → 1 thành phố

---

## 3) Ứng dụng thực tiễn

1. **Phát hiện chập cháy điện tự động** — giám sát nhiệt độ + điện năng + độ ẩm realtime
2. **Cảnh báo quá tải khi nắng nóng** — phát hiện grid stress trước khi cháy
3. **Compound hazard detection** — AI kết hợp nhiều chỉ số để đánh giá rủi ro tổng hợp
4. **Tự động ngắt tải bảo vệ** — cắt điện khi phát hiện nguy hiểm, có ACK
5. **Fire risk dashboard** — hiển thị realtime trạng thái rủi ro theo zone
6. **Nền tảng mở rộng** cho:
   - Thêm cảm biến khí gas, khói, mực nước
   - Cảnh báo đa kênh (Telegram/Zalo/SMS/Email)
   - Phân tích xu hướng + dự báo
   - Scale từ 1 tòa nhà đến 1 thành phố

---

## 4) Fire Risk Scenarios cụ thể

## 4.1. Heat Wave Electrical Overload (Quá tải điện khi nắng nóng)
- **Climate context:** Nắng nóng 40°C+ → nhu cầu điều hòa tăng vọt → quá tải mạch điện
- **Input:** `temperature` (°C) + `activePower` (W) từ cảm biến
- **Rule:**
  - Temp >= 40°C + Power >= 800W: WARNING — heat wave causing grid stress
  - Temp >= 50°C + Power >= 950W: CRITICAL — wiring overheat, imminent fire
- **Output:** Cảnh báo + tự động ngắt tải + ACK

## 4.2. Wiring Overheat Detection (Quá tải nhiệt dây dẫn)
- **Climate context:** Nhiệt độ môi trường cao + tải điện lớn → dây dẫn nóng → chảy cách điện
- **Input:** `temperature` từ cảm biến nhiệt độ (đặt gần ổ cắm/dây dẫn)
- **Rule:**
  - Temp >= 45°C: WARNING — dây dẫn đang nóng bất thường
  - Temp >= 55°C: CRITICAL — cách điện chảy, ngắn mạch sắp xảy ra
- **Output:** Cắt điện ngay lập tức + cảnh báo + sơ tán zone

## 4.3. Moisture + Power Short Circuit (Đoản mạch do ẩm)
- **Climate context:** Độ ẩm cao (mưa, ngập) + tải điện lớn → đoản mạch
- **Input:** `measuredValue` (%RH) + `activePower` (W)
- **Rule:**
  - Humidity >= 90% + Power >= 800W: CRITICAL — moisture-induced short circuit
- **Output:** Cắt điện + cảnh báo + thông báo

## 4.4. Smart City Fire Risk Map
- Mỗi cảm biến là entity trong Orion với tọa độ GPS
- Hiển thị bản đồ realtime: xanh (an toàn), vàng (cảnh báo), đỏ (nguy hiểm)
- Mô phỏng di chuyển cảm biến, giả lập GPS

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
