# Proposal: Giả lập dữ liệu thực tế (Simulation & Seed Data)

## Mục tiêu
- Tạo một flow giả lập dữ liệu giống thật để demo và test mà không cần thiết bị vật lý.
- Giữ nguyên contract FIWARE (NGSI-v2 / Orion) và giữ mapping từ Matter (device IDs, attributes) để các thành phần hiện có (FIMAT, MCP, Dashboard, proxy) không cần thay đổi lớn.

## Tổng quan cách làm
1. Dùng mô-đun emulator hiện có (`matter-emulators/`) làm nguồn sự kiện "Matter-like" (device ids, endpoints).
2. Viết script seed/runner (Node.js + PowerShell) để:
   - Sinh dữ liệu telemetry theo kịch bản (normal, heat-wave, overload, offline, noisy)
   - Chuyển đổi/send dữ liệu thành NGSI-v2 upsert vào Orion (HTTP API /v2/entities)
3. Giữ metadata đầy đủ (timestamp, unit, sampleRate) và entity ID ổn định.
4. Cung cấp các kịch bản có thể chạy lặp: smoke, scenario-critical, load-test.
5. Chạy script seed/runner và lưu script dạng data được chạy vài phút cho mỗi kịch bản

## Kiến trúc đề xuất
- `sim-generator/` (đề xuất): Node.js module sinh dữ liệu và gửi tới Orion hoặc tới `matter-emulators` HTTP endpoint.
- Scripts chạy trên Windows PowerShell (tương thích với repo hiện tại nơi có `scripts/*.ps1`).
- Sử dụng existing `proxy-server.js` / `semantic-proxy` để đảm bảo mapping Matter -> NGSI không thay đổi.

## Schema & mẫu dữ liệu (NGSI-v2)
Nguyên tắc:
- Mỗi entity là NGSI-v2 entity với `id`, `type`, và attributes có `value` + `metadata`.
- Thêm `timestamp` attribute luôn cập nhật (ISO8601 millis).

Ví dụ 1 — SmartPlug (SmartPlug: điện năng + on/off)

```json
{
  "id": "SmartPlug:001",
  "type": "SmartPlug",
  "onOff": { "value": true, "type": "Boolean" },
  "activePower": { "value": 420.5, "type": "Number", "metadata": { "unit": { "value": "W" } } },
  "timestamp": { "value": "2026-06-05T12:00:00.000Z", "type": "DateTime" }
}
```

Ví dụ 2 — Temperature sensor

```json
{
  "id": "TempSensor:room-12",
  "type": "TemperatureSensor",
  "temperature": { "value": 36.7, "type": "Number", "metadata": { "unit": { "value": "C" } } },
  "battery": { "value": 88, "type": "Integer", "metadata": { "unit": { "value": "%" } } },
  "timestamp": { "value": "2026-06-05T12:00:01.500Z", "type": "DateTime" }
}
```

Ghi chú: Các trường `id` giữ format `Type:NNN` để dễ map với Device registry và `ENTITY_MODEL.md`.

## Kịch bản giả lập (Scenarios)
- Normal: sampling interval 5s, giá trị trong ngưỡng bình thường (temp 20-28°C, power 0-200W).
- Heat-wave: temp tăng dần (28→40°C trong 30 phút), power tăng tương ứng, occasional spikes.
- Overload-risk: nhiều SmartPlug tăng công suất dẫn đến tổng activePower vượt ngưỡng -> trigger risk.
- Device offline: stop gửi dữ liệu cho một device trong N phút để test Liveness and reconnection.
- Noisy data / bad payload: gửi vài sự kiện malformed để kiểm thử xử lý lỗi.

Mỗi scenario có thể chạy ở 3 mức: quick (1–2 phút), demo (5–10 phút), full (định thời gian tùy chọn).

## Kịch bản chi tiết và mối liên hệ vật lý

### 1. Heat Wave khởi phát (Nắng nóng cực đoan)
- Mục tiêu: mô phỏng nền nhiệt tăng mạnh, tạo áp lực lên hệ thống làm mát.
- Dữ liệu cần thu: `ambientTemperature`, `humidity`, `surfaceTemperature`, `solarRadiation`, `roomTemperature`.
- Quy luật vật lý:
  - Khi nhiệt độ môi trường tăng, tải điều hòa và quạt tăng để giữ nhiệt độ trong phòng ổn định.
  - `activePower` của thiết bị HVAC tăng theo ánh xạ gần tuyến tính với nhiệt độ ngoài trời: mỗi +1°C có thể tăng 2-4% tải.
  - Nếu `ambientTemperature` vượt 35°C, các thiết bị chế độ ổn định chịu thêm stress, độ ẩm giảm khả năng thoát nhiệt.
- Mối liên hệ:
  - `TemperatureSensor:outdoor-XX` ảnh hưởng đến `SmartPlug:AC-XX.activePower`.
  - `TemperatureSensor:room-XX` phản hồi chậm hơn với nhiệt độ môi trường và thể hiện hiệu năng làm mát.
  - `HumiditySensor` giúp xác định khả năng đối lưu và độ bền cách điện.

### 2. Tiêu thụ điện tăng vọt (Load Surge)
- Mục tiêu: tạo trạng thái nhiều thiết bị bật đồng thời, dẫn tới công suất tổng lớn.
- Dữ liệu cần thu: `onOff`, `activePower`, `powerFactor`, `voltage`, `currentEstimate`.
- Quy luật vật lý:
  - Công suất tiêu thụ `P = V × I × PF`; với điện áp lưới ổn định 220-230V, tăng P = tăng dòng I.
  - Nhiệt độ dây dẫn tăng theo `I^2 × R`; do đó dòng cao hơn nhanh chóng làm nhiệt tăng, tăng nguy cơ quá tải.
  - Các thiết bị có hệ số công suất < 1 làm tăng công suất phản kháng và giảm hiệu suất hệ thống.
- Mối liên hệ:
  - `SmartPlug:012.activePower` cộng dồn thành `Zone:floor1.totalActivePower`.
  - `voltage` rớt nhẹ khi nhiều thiết bị kéo tải, từ đó làm thiết bị điều hòa chạy kịch hơn để duy trì nhiệt độ.
  - `powerFactor` kém cho thấy tải ký điện và có thể được dùng để phân loại loại tải (điều hòa, máy bơm, đèn sưởi).

### 3. Quá tải lưới và rủi ro dây dẫn
- Mục tiêu: mô phỏng trạng thái đường dây/ổ cắm gần ngưỡng định mức.
- Dữ liệu cần thu: `totalActivePower`, `circuitTemperature`, `breakerState`, `voltageDrop`, `currentSpike`.
- Quy luật vật lý:
  - Dòng điện trên nhánh tăng dẫn tới tăng nhiệt độ cách điện; cách điện suy giảm mạnh khi > 70°C.
  - Khi công suất tổng vượt 80-90% định mức, chu kỳ bật/tắt tần suất càng nhiều, làm mối nối, tiếp xúc trở nên yếu.
  - Thay đổi điện áp trên đường dây là dấu hiệu sớm của quá tải và sụt áp.
- Mối liên hệ:
  - `Zone:floor1.totalActivePower > threshold` kích hoạt `RiskEngine` nâng cấp cảnh báo.
  - `circuitTemperature` có thể tăng nhanh hơn `ambientTemperature` khi dòng cao bất thường.
  - `breakerState` và `currentSpike` cho phép phát hiện giao đoạn trước khi ngắt mạch.

### 4. Tiến triển chập cháy điện
- Mục tiêu: mô phỏng chuỗi sự kiện từ quá tải đến chập, cháy.
- Dữ liệu cần thu: `deviceTemperature`, `currentLeakage`, `smokePresence`, `arcEvent`, `faultCount`.
- Quy luật vật lý:
  - Chập điện thường bắt đầu bằng một điểm nối kém hoặc cách điện hỏng, tạo hồ quang và tăng đột ngột dòng điện.
  - Tăng nhiệt thêm khiến vật liệu cách điện giảm điện trở, tạo vòng hồi tiếp dương cho sự cố.
  - Rò rỉ điện và sự hiện diện của hơi ẩm/hạt bụi làm giảm khoảng cách cách điện và tăng khả năng hồ quang.
- Mối liên hệ:
  - `SmartPlug` hoặc `WiringSegment` tăng `deviceTemperature` và xuất hiện `currentLeakage` là chỉ dấu chập.
  - `SmokeSensor` hoặc `airQuality` có thể bổ trợ cho nhận diện sự cố cấp độ fire risk.
  - `action: tripBreaker` hoặc `action: disconnectLoad` là kết quả của việc phát hiện giai đoạn trước khi tạo ra lửa.

### 5. Tình huống thực tế bổ sung
- Offline / mất kết nối:
  - Thiết bị ngừng gửi telemetry trong 1-2 chu kỳ, dẫn tới `missing data` và yêu cầu hệ thống dùng fallback.
  - `heartbeat`/`timestamp` cũ giúp phát hiện stale data.
- Drift & sensor degradation:
  - Nhiệt độ/dòng điện tăng dần nhưng không đồng nhất, thể hiện sensor bị sai số.
  - Phải so sánh với thiết bị lân cận để phát hiện anomaly.
- Noisy / malformed data:
  - Một số event gửi `activePower: -5` hoặc `temperature: 999` để kiểm thử khả năng bỏ qua/alert.
  - Duplicate event, timestamp lùi lại, giá trị null.

### 6. Dữ liệu phải chặt chẽ với nhau
- Nhiệt độ môi trường tăng → tải điều hòa tăng → tổng `activePower` tăng → dòng điện cao hơn → nhiệt độ dây tăng.
- Khi tải và nhiệt độ hệ thống cao, giá trị `voltageDrop` và `powerFactor` xấu hơn.
- Quá tải lặp lại gây stress mối nối, từ đó xuất hiện `currentLeakage` và `deviceTemperature` cao.
- Một sự cố chập cháy thực tế thường không chỉ có một tín hiệu, mà là tập hợp:
  - spike `activePower`,
  - `currentLeakage` xuất hiện,
  - `circuitTemperature` tăng nhanh,
  - `smokePresence` hoặc `arcEvent` đôi khi khởi tạo.

### 7. Áp dụng vào bài toán chính
- Bài toán: Nắng nóng do biến đổi khí hậu → tiêu thụ điện tăng vọt → quá tải lưới → chập cháy điện.
- Mô phỏng sẽ dùng chuỗi dữ liệu:
  1. `ambientTemperature` tăng do heat wave.
  2. Tăng `SmartPlug.activePower` của nhiều thiết bị làm mát.
  3. Tích luỹ thành `Zone.totalActivePower` cao, tăng `currentEstimate` và `circuitTemperature`.
  4. Hệ thống phát hiện vùng quá tải, cảnh báo `riskLevel` và đưa ra hành động ngắt tải.
  5. Nếu không can thiệp kịp, mô phỏng phát triển thành `currentLeakage` + `deviceTemperature` tăng + `arcEvent`.
- Kịch bản này đảm bảo các bước logic không tách rời, mà là một chuỗi nhân quả rõ ràng.

Mỗi kịch bản có thể dùng như một profile cấu hình cho generator, với tham số thực tế như: nhiệt độ môi trường, công suất điều hòa, định mức một nhánh, ngưỡng nhiệt độ dây.

## Chiến lược seed data & sampling
- Use parameterized generators: min/max, trend (linear/step/exponential), noise (gaussian), spikes (probability p).
- Timestamps: generate realistic increasing timestamps with jitter; support backfill (historical run).
- Dedupe keys: `id + timestamp` hoặc `id + eventId` để tránh duplicate upserts when replaying.

## Scripts đề xuất (tên & chức năng)
- `sim-generator/generate.js` — generator core (produce JSON events, support scenarios & profile config)
- `sim-generator/seed-orion.js` — gửi upsert tới Orion `http://{ORION_HOST}/v2/entities` (supports batch upsert)
- `scripts/run-sim.ps1` — wrapper cho Windows: start scenario, khai báo ORION URL, duration, rate
- `scripts/seed-sample.ps1` — seed một bộ sample nhỏ cho smoke-test

Ví dụ lệnh (PowerShell):

```powershell
# chạy scenario demo gửi tới Orion local
$env:ORION_URL = "http://localhost:1026"
node sim-generator/generate.js --scenario heat-wave --duration 600 --rate 1
```

## Giữ FIWARE + Matter protocol
- Emulators: vẫn phát events theo Matter-like format (device ids, endpoints). Thay vì kết nối phần cứng, generator sẽ gọi cùng API mà `matter-emulators` dùng hoặc trực tiếp gọi `fimat-agent/src/orion-client.js`/Orion HTTP.
- Nếu có layer chuyển đổi Matter->NGSI (ví dụ `semantic-proxy.js`), giữ nguyên để test toàn diện: generator gửi Matter events -> proxy -> Orion.
- Làm test mapping: kiểm tra `ENTITY_MODEL.md` để đảm bảo attribute names và unit khớp.

## Mẫu seed file (small batch)

File JSON mẫu: `sim-seed/small-batch.json`

```json
[
  {"id":"SmartPlug:001","type":"SmartPlug","onOff":{"value":true},"activePower":{"value":120.2,"metadata":{"unit":{"value":"W"}}},"timestamp":{"value":"2026-06-05T12:00:00.000Z"}},
  {"id":"TempSensor:room-12","type":"TemperatureSensor","temperature":{"value":29.3,"metadata":{"unit":{"value":"C"}}},"timestamp":{"value":"2026-06-05T12:00:01.200Z"}}
]
```

`seed-orion.js` nên hỗ trợ đọc batch JSON và gọi HTTP:

POST /v2/op/update (batch update) hoặc upsert entities individually.

## Kiểm thử & Smoke tests
- `scripts/smoke-test.ps1` sẽ: start minimal Orion (nếu local stack), seed `small-batch.json`, kiểm tra entity tồn tại bằng GET `/v2/entities/{id}` và kiểm tra một số thuộc tính.

## Logging, audit, và idempotence
- Mỗi action seed/command phải ghi log: scenario, step, eventCount, failures.
- Seed script nên idempotent: gửi cùng `id+timestamp` không tạo duplicate nếu replay.

## Checklist triển khai (ước lượng nhanh)
1. Tạo `sim-generator/` + `generate.js`, `seed-orion.js` (2–4 giờ).
2. Tạo PowerShell wrapper scripts trong `scripts/` (1 giờ).
3. Tạo vài sample JSON trong `sim-seed/` (30 phút).
4. Thử chạy smoke-test, điều chỉnh mapping với `proxy-server.js` (1–2 giờ).

## Kết luận / Next steps
- Tôi đã đề xuất cấu trúc, kịch bản, mẫu dữ liệu và các script cần có. Nếu bạn muốn, tôi có thể tiếp tục và:
  - Tạo `sim-generator/` skeleton và `seed-orion.js` thực thi,
  - Thêm sample `sim-seed/small-batch.json`,
  - Viết `scripts/run-sim.ps1` và `scripts/seed-sample.ps1`.

---
File này lưu tại `docs/SIMULATION_PROPOSAL.md` để bạn duyệt và yêu cầu chỉnh sửa.

Chú thích:
HVAC (Heating, Ventilation, and Air Conditioning): các loại máy móc và linh kiện được sử dụng trong hệ thống sưởi ấm, thông gió và điều hòa không khí
