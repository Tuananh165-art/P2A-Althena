# Đề xuất tích hợp OpenClaw Skills cho Smart Home, Smart City và Climate Resilience

## 1. Mục tiêu

Tài liệu này đề xuất kế hoạch tìm kiếm, thu thập, kiểm thử và tích hợp các OpenClaw skill liên quan đến đề tài Climate Resilience Copilot.

Các nhóm skill mục tiêu:

- Smart home: điều khiển thiết bị, giám sát ổ cắm thông minh, trạng thái cảm biến, giảm tải điện.
- Smart city: giám sát theo khu vực, tổng hợp rủi ro cấp đô thị, cảnh báo đa vùng, trạng thái hạ tầng.
- Climate change: phân tích rủi ro do nắng nóng, suy luận compound hazard, phòng ngừa cháy điện.

Mục tiêu là phát triển OpenClaw từ một Telegram gateway demo thành một lớp skill có nhận thức ngữ cảnh, có thể tương tác đúng với MCP Agent, FIWARE Orion và các service thiết bị IoT.

## 2. Trạng thái hiện tại

OpenClaw hiện tại có thể route tin nhắn người dùng và gọi REST API của MCP Agent, nhưng vẫn thiên về demo.

Hành vi hiện tại:

- OpenClaw load metadata skill từ `openclaw-skills/*.md`.
- Routing dựa trên keyword trong `openclaw-gateway/src/skill-router.js`.
- Một số action còn hardcode, ví dụ Smart Plug device ID `urn:ngsi-ld:MatterDevice:2_1`.
- Dashboard chat có router riêng trong `monitor-dashboard/chat.js`, nên logic bị lặp với OpenClaw Gateway.
- MCP Agent expose các REST endpoint dạng tool, chưa phải MCP protocol chuẩn.

Giới hạn chính:

OpenClaw gọi được MCP API, nhưng chưa có đủ context động để luôn chọn đúng tool, đúng thiết bị, đúng zone và đúng action.

## 3. Nguồn skill đề xuất

Các skill ứng viên nên được tìm và thu thập từ:

- ClawHub
- SkillMP
- Các skill nội bộ hiện có trong `openclaw-skills/`
- Skill tùy biến riêng cho MVP này

Từ khóa tìm kiếm:

- smart home
- smart plug
- energy monitoring
- IoT device control
- smart city
- city alerting
- climate resilience
- heat wave
- fire risk
- disaster response
- sensor monitoring
- FIWARE
- NGSI

## 4. Tiêu chí chọn skill

Mỗi skill ứng viên nên được đánh giá theo các tiêu chí sau:

| Tiêu chí | Yêu cầu |
|---|---|
| Liên quan domain | Phải liên quan đến smart home, smart city, IoT monitoring, climate change hoặc emergency response |
| Có khả năng hành động | Nên map được tới action hệ thống, API call, query hoặc alert |
| An toàn | Action vật lý phải có xác nhận, audit hoặc trạng thái simulated rõ ràng |
| Phụ thuộc dữ liệu | Phải nêu rõ cần Orion data, MCP risk data, device state hay external data |
| Tương thích | Có thể chuyển đổi sang metadata skill hiện tại của OpenClaw |
| Kiểm thử được | Có test case input/output đơn giản |

Các skill chỉ trả lời văn bản chung chung nên ưu tiên thấp hơn, trừ khi chúng cải thiện phần giải thích cho operator.

## 5. Format metadata skill đề xuất

Các file skill hiện tại nên được mở rộng từ metadata mô tả sang metadata khai báo capability.

Format đề xuất:

```yaml
---
name: smart-plug-control
description: Control smart plug devices using live Orion context
domain: smart-home
trigger: turn off, turn on, smart plug, o cam, tat o cam, bat o cam
tool: invoke_command
endpoint: /tools/invoke_command
requires:
  - mcp-agent
  - orion
  - device-discovery
safety: confirm_for_physical_action
status: candidate
---
```

Các field bắt buộc:

- `name`
- `description`
- `domain`
- `trigger`
- `tool`
- `endpoint`
- `requires`
- `safety`
- `status`

## 6. Flow runtime đề xuất

OpenClaw không nên hardcode trực tiếp thiết bị. Thay vào đó, OpenClaw nên resolve intent dựa trên live context.

Flow mục tiêu:

```text
User request
  -> OpenClaw skill router
  -> match skill
  -> query MCP/Orion để lấy live context
  -> chọn đúng zone/device/action
  -> gọi MCP tool endpoint
  -> nhận kết quả
  -> trả lời người dùng
  -> ghi audit trail nếu có action
```

Ví dụ:

```text
User: "Tắt ổ cắm đang quá tải ở zone A"

OpenClaw:
1. Match skill smart-plug-control
2. Query /tools/query_entities?type=SmartPlug&zone=A
3. Chọn plug có onOff=true và activePower cao nhất
4. Hỏi xác nhận nếu đây là action vật lý
5. Gọi /tools/invoke_command
6. Trả về ACK, SIMULATED_ACK hoặc ERROR
```

## 7. Nhóm skill cần tích hợp

### 7.1 Smart Home Skills

Capability ứng viên:

- Truy vấn trạng thái smart plug.
- Bật/tắt smart plug.
- Xác định thiết bị đang tải cao.
- Đề xuất giảm tải điện.
- Kiểm tra sức khỏe cảm biến.

Backend cần hỗ trợ:

- Dynamic device discovery từ Orion.
- Capability mapping theo device type.
- Trạng thái command thật hoặc simulated rõ ràng.

### 7.2 Smart City Skills

Capability ứng viên:

- Tổng hợp rủi ro theo zone.
- Liệt kê các zone critical.
- Báo cáo trạng thái hạ tầng đô thị.
- Gom nhóm alert theo severity.
- Đề xuất phản ứng vận hành cho sự cố cấp đô thị.

Backend cần hỗ trợ:

- Entity `ZoneRisk` cho nhiều zone.
- Metadata của zone.
- Alert history từ Orion hoặc persistent store.

### 7.3 Climate Change Skills

Capability ứng viên:

- Giải thích rủi ro cháy điện do heat wave.
- Phân tích compound hazard: nhiệt độ + độ ẩm + công suất.
- Tạo khuyến nghị phòng ngừa.
- Chạy simulation normal/warning/critical.
- Sinh incident summary sẵn dùng cho operator.

Backend cần hỗ trợ:

- Live sensor metrics.
- Output từ risk engine.
- AI reasoning tùy chọn.

## 8. Kế hoạch kiểm thử

### 8.1 Skill Parse Test

Xác minh OpenClaw có thể load metadata skill.

Checklist:

- Skill file có frontmatter hợp lệ.
- Có đủ field bắt buộc.
- Trigger được parse đúng.
- Skill xuất hiện trong `GET /skills`.

### 8.2 Route Test

Xác minh input ngôn ngữ tự nhiên map đúng skill.

Ví dụ:

| Input | Skill kỳ vọng |
|---|---|
| `rui ro hien tai the nao` | `query-risk` |
| `tat o cam zone A` | `smart-plug-control` |
| `show critical zones` | `city-risk-summary` |
| `giai thich vi sao nang nong gay chay dien` | `climate-risk-explainer` |

### 8.3 Integration Test

Xác minh skill đã match gọi đúng backend API.

Checklist:

- `query-risk` gọi MCP `/risk`.
- `get-alerts` gọi MCP `/alerts`.
- `device-control` query Orion/MCP trước để discover device.
- `invoke_command` ghi `CommandExecution`.
- `simulate-scenario` update Orion và trigger MCP `/evaluate`.

### 8.4 Safety Test

Action vật lý không được âm thầm coi là action thật nếu chưa có xác thực.

Checklist:

- Mock command trả `SIMULATED_ACK`, không trả `ACK` thường.
- Command thật phải có source, timestamp và target device.
- Action nguy hiểm cần confirmation hoặc explicit operator command.

## 9. Thay đổi code cần làm

Các bước implement đề xuất:

1. Thêm skill registry module trong OpenClaw.
2. Mở rộng metadata trong skill markdown.
3. Thay hardcoded Smart Plug ID bằng dynamic device discovery.
4. Thêm device capability mapping.
5. Thêm shared routing logic để Dashboard Chat và Telegram OpenClaw dùng cùng skill router.
6. Thêm MCP tool schema metadata hoặc endpoint discovery `/tools`.
7. Đổi mock command status từ `ACK` sang `SIMULATED_ACK`.
8. Persist alert và command history vào Orion thay vì chỉ lưu trong memory.

## 10. Tiêu chí thành công

Việc tích hợp được xem là thành công khi:

- OpenClaw load được các skill đã chọn từ local skill files.
- Ít nhất 3 smart home skill chạy end-to-end.
- Ít nhất 2 smart city skill hoạt động với Orion/MCP data.
- Ít nhất 2 climate change skill cung cấp giải thích rủi ro hoặc simulation hữu ích.
- Device control không còn phụ thuộc hardcoded device ID.
- Test parse, routing, integration và safety đều pass.
- Demo phân biệt rõ live data, simulated data và AI-generated explanation.

## 11. Phạm vi MVP khuyến nghị

Ở vòng tiếp theo, chỉ nên implement một tập skill tập trung:

- `smart-plug-control`
- `query-risk`
- `get-alerts`
- `city-risk-summary`
- `climate-risk-explainer`
- `simulate-scenario`

Phạm vi này giữ hệ thống đủ gọn, đồng thời chứng minh OpenClaw có thể đóng vai trò skill layer thật phía trên MCP Agent và FIWARE Orion.

## 12. Khuyến nghị cuối

OpenClaw nên trở thành user-facing skill router, trong khi MCP Agent giữ vai trò backend tool/action service và Orion giữ vai trò source of truth.

Kiến trúc khuyến nghị:

```text
OpenClaw
  -> skill registry
  -> intent routing
  -> context lookup
  -> MCP tool call
  -> response formatting

MCP Agent
  -> query entities
  -> compute risk
  -> publish alert
  -> invoke command
  -> write audit trail

FIWARE Orion
  -> live device context
  -> zone risk
  -> alerts
  -> command history
```

Cách này tránh biến skill file thành tài liệu tĩnh đơn thuần. Mỗi skill nên trở thành một capability có thể discover, có test, và được kết nối với dữ liệu/action thật của project.
