# Climate Resilience Copilot

Climate Resilience Copilot là MVP giám sát rủi ro cháy điện do nắng nóng cực đoan. Hệ thống mô phỏng hoặc nhận dữ liệu thiết bị IoT, chuẩn hóa vào FIWARE Orion theo NGSI-v2, đánh giá rủi ro bằng rule engine kết hợp lớp AI/MCP, hiển thị trên dashboard và có lớp gateway để mở rộng cảnh báo/hành động.

Project hiện tập trung vào proof-of-concept cho luồng:

```text
Device / Simulator
  -> FIMAT Agent hoặc Zigbee Bridge
  -> FIWARE Orion Context Broker
  -> MCP Agent
  -> Dashboard / OpenClaw Gateway / Device command
```

## Mục tiêu MVP

- Giám sát các chỉ số liên quan đến nguy cơ cháy điện: nhiệt độ, độ ẩm, công suất tiêu thụ và trạng thái ổ cắm.
- Chuẩn hóa dữ liệu thiết bị thành digital twin trong FIWARE Orion.
- Đánh giá rủi ro theo ngưỡng cấu hình trong `mcp-agent/config.js`.
- Hỗ trợ demo các kịch bản `normal`, `warning`, `critical`.
- Cung cấp dashboard vận hành, trang cảnh báo, bản đồ, thiết bị, mô phỏng và giao diện chat/demo.
- Tách module ingestion, context, decision, alert/action để dễ mở rộng.

## Kiến trúc thư mục

```text
.
├── docs/                                  Tài liệu kiến trúc, API, entity model, demo, FAQ
├── Matter-to-FIWARE-Monitoring-System/    Hệ thống service chính
│   ├── docker-compose.yml                 FIWARE Orion + MongoDB
│   ├── proxy-server.js                    CORS proxy cho Orion, port 3001
│   ├── matter-emulators/                  Thiết bị Matter mô phỏng
│   ├── fimat-agent/                       Adapter Matter -> NGSI-v2, port 3000
│   ├── mcp-agent/                         Risk engine, AI reasoner, command executor, port 3002
│   ├── zigbee-bridge/                     Zigbee2MQTT -> FIWARE bridge, port 3003
│   ├── openclaw-gateway/                  Gateway cảnh báo/skill/Telegram, port 3004
│   └── monitor-dashboard/                 Dashboard web tĩnh
├── openclaw-skills/                       Skill docs và Climate Resilience Copilot skill
├── scripts/                               Script dev, smoke test, seed, demo scenario
├── sim-generator/                         Công cụ tạo/gửi dữ liệu mô phỏng
└── sim-seed/                              Dữ liệu seed cho Orion
```

## Thành phần chính

| Thành phần | Vai trò | Port mặc định |
| --- | --- | --- |
| MongoDB | Lưu context cho Orion | 27017 |
| FIWARE Orion | Context Broker NGSI-v2 | 1026 |
| FIMAT Agent | Nhận/sinh dữ liệu Matter và ghi vào Orion | 3000 |
| Proxy Server | Proxy CORS `/version` và `/v2/*` đến Orion | 3001 |
| MCP Agent | Đánh giá rủi ro, quản lý cảnh báo, thực thi lệnh | 3002 |
| Zigbee Bridge | Nhận dữ liệu từ zigbee2mqtt qua MQTT và ghi vào Orion | 3003 |
| OpenClaw Gateway | Nhận alert webhook, route skill, Telegram formatter | 3004 |
| Dashboard | UI giám sát web tĩnh | 8080 hoặc 8001 |

## Công nghệ sử dụng

- Node.js cho các service, agent, bridge, gateway và simulator.
- Docker Compose để chạy FIWARE Orion và MongoDB.
- FIWARE Orion 3.10.1 với API NGSI-v2.
- MQTT/zigbee2mqtt cho luồng Zigbee tùy chọn.
- PowerShell scripts cho khởi động, seed dữ liệu, smoke test và demo.
- Dashboard HTML/CSS/JavaScript tĩnh, serve bằng `http-server`.

## Yêu cầu môi trường

- Windows PowerShell.
- Docker Desktop hoặc Docker Engine có Docker Compose plugin.
- Node.js 16 trở lên.
- `npm`.
- Trình duyệt web.
- MQTT broker/zigbee2mqtt nếu muốn chạy Zigbee Bridge ở trạng thái kết nối thật.

## Cài đặt dependency

Nếu clone mới hoặc chưa có `node_modules`, cài dependency cho các module Node.js:

```powershell
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\matter-emulators
npm install

cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\fimat-agent
npm install

cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\mcp-agent
npm install

cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\zigbee-bridge
npm install

cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\openclaw-gateway
npm install

cd F:\P2A-Althena\sim-generator
npm install
```

Các service có file `.env.example` gồm `mcp-agent`, `openclaw-gateway` và `zigbee-bridge`. Khi cần cấu hình riêng, copy sang `.env` trong đúng thư mục service.

## Khởi động nhanh

Từ thư mục gốc repo:

```powershell
cd F:\P2A-Althena
.\scripts\dev-up.ps1
```

Script này khởi động:

- Orion + MongoDB bằng Docker Compose.
- Proxy Server trên `http://localhost:3001`.
- FIMAT Agent trên `http://localhost:3000`.
- MCP Agent trên `http://localhost:3002`.
- Zigbee Bridge trên `http://localhost:3003`.
- Dashboard trên `http://localhost:8080`.

Mở dashboard:

```text
http://localhost:8080
```

Kiểm tra nhanh:

```powershell
.\scripts\smoke-test.ps1
```

Dừng stack:

```powershell
.\scripts\dev-down.ps1
```

Lưu ý: `dev-down.ps1` dừng toàn bộ process Node đang chạy trên máy và `docker compose down` cho stack này.

## Khởi động bản demo đầy đủ

Trong thư mục service chính có script `start-all.ps1` dùng cho demo đầy đủ hơn: seed dữ liệu, chạy OpenClaw Gateway và serve dashboard ở port `8001`.

```powershell
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System
.\start-all.ps1
```

Tùy chọn thường dùng:

```powershell
.\start-all.ps1 -SeedScenario small-batch -DeviceControlMode simulator
.\start-all.ps1 -SkipSeed
```

Dashboard của script này:

```text
http://localhost:8001
```

## Demo scenario

Sau khi stack đã chạy, có thể bơm dữ liệu demo vào Orion và kích hoạt MCP Agent đánh giá:

```powershell
cd F:\P2A-Althena
.\scripts\demo-scenario.ps1 -Mode normal
.\scripts\demo-scenario.ps1 -Mode warning
.\scripts\demo-scenario.ps1 -Mode critical
```

Các entity chính được cập nhật:

- `urn:ngsi-ld:HumiditySensor:ZoneA_Room102_Sensor1`
- `urn:ngsi-ld:SmartPlug:ZoneA_Room102_AC`
- `urn:ngsi-ld:TemperatureSensor:ZoneA_Room102_Wiring`

## Seed và simulation

Import seed có sẵn:

```powershell
cd F:\P2A-Althena
.\scripts\import-sim-seed.ps1 -Scenario small-batch
.\scripts\import-sim-seed.ps1 -Scenario normal
.\scripts\import-sim-seed.ps1 -Scenario overload
.\scripts\import-sim-seed.ps1 -Scenario offline
.\scripts\import-sim-seed.ps1 -Scenario noisy
```

Chạy generator gửi dữ liệu mô phỏng vào Orion:

```powershell
.\scripts\run-sim.ps1 -Scenario normal -Duration 120 -Rate 1
.\scripts\run-sim.ps1 -Scenario overload -Duration 60 -Rate 2
```

## Health check và API hữu ích

```powershell
Invoke-WebRequest http://localhost:1026/version
Invoke-WebRequest http://localhost:3001/version
Invoke-WebRequest http://localhost:3000/health
Invoke-WebRequest http://localhost:3002/health
Invoke-WebRequest http://localhost:3002/risk
Invoke-WebRequest http://localhost:3003/health
Invoke-WebRequest http://localhost:3004/health
Invoke-WebRequest http://localhost:3001/v2/entities
```

Smoke test chính:

```powershell
cd F:\P2A-Althena
.\scripts\smoke-test.ps1
```

Service check bổ sung:

```powershell
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System
.\scripts\verify-all.ps1
```

## Test

Chạy test cho từng package có test:

```powershell
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\fimat-agent
npm test

cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\mcp-agent
npm test
```

`openclaw-gateway` hiện có thư mục `test/` nhưng `package.json` chưa khai báo script `test`.

## Risk rules mặc định

Ngưỡng hiện nằm trong `Matter-to-FIWARE-Monitoring-System/mcp-agent/config.js`:

| Tín hiệu | Warning | Critical |
| --- | ---: | ---: |
| Humidity | 75% RH | 90% RH |
| Active power | 800 W | 950 W |
| Temperature | 40 C | 50 C |

MCP Agent poll mỗi 5 giây theo mặc định (`MCP_POLL_INTERVAL=5000`) và có cooldown cảnh báo mặc định 30 giây (`RISK_COOLDOWN_MS=30000`).

## Cấu hình quan trọng

| Biến môi trường | Service | Mặc định | Ý nghĩa |
| --- | --- | --- | --- |
| `ORION_HOST` / `ORION_PORT` | FIMAT, MCP, Zigbee | `localhost` / `1026` | Orion endpoint |
| `AGENT_PORT` | FIMAT | `3000` | Port FIMAT Agent |
| `MCP_PORT` | MCP | `3002` | Port MCP Agent |
| `DEVICE_CONTROL_MODE` | MCP | `live` | Chế độ điều khiển thiết bị; demo thường dùng `simulator` |
| `REQUIRE_OPERATOR_APPROVAL` | MCP | `true` | Yêu cầu operator approval cho hành động nhạy cảm |
| `AUTO_CRITICAL_ACTIONS` | MCP | `false` | Cho phép tự động xử lý critical nếu bật |
| `AI_ENDPOINT` / `AI_API_KEY` / `AI_MODEL` | MCP | rỗng / rỗng / `gpt-4o-mini` | Cấu hình lớp AI reasoner |
| `MQTT_URL` | Zigbee Bridge | `mqtt://localhost:1883` | MQTT broker của zigbee2mqtt |
| `OPENCLAW_PORT` | OpenClaw Gateway | `3004` | Port gateway |
| `TELEGRAM_BOT_TOKEN` | OpenClaw Gateway | rỗng | Telegram bot token nếu dùng Telegram |

## Trạng thái và giới hạn hiện tại

- Đây là MVP/demo, chưa phải hệ thống production.
- Luồng chính dùng FIWARE Orion NGSI-v2, chưa triển khai NGSI-LD đầy đủ.
- Matter device hiện chủ yếu là emulator/simulator.
- Zigbee Bridge cần MQTT broker và zigbee2mqtt để kết nối thật.
- Dashboard chưa có authentication/authorization.
- Lưu trữ lịch sử dài hạn chưa phải trọng tâm; Orion đang giữ context hiện tại.
- AI reasoner có thể chạy theo cấu hình, nhưng rule engine vẫn là baseline an toàn chính.

## Tài liệu liên quan

- `docs/ARCHITECTURE.md`: kiến trúc hệ thống.
- `docs/API_CONTRACT.md`: API contract.
- `docs/ENTITY_MODEL.md`: mô hình entity.
- `docs/DEMO_SCRIPT.md`: kịch bản demo.
- `docs/KPI_SCORECARD.md`: KPI.
- `docs/RISK_REGISTER.md`: risk register.
- `docs/README_HACKATHON.md`: phần trình bày hackathon.
- `openclaw-skills/SKILLS.md`: danh sách skill OpenClaw.

## License

Project sử dụng giấy phép trong `LICENSE`.
