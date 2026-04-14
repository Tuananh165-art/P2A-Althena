# TEST_REPORT

## Build Info
- Date:
- Commit:
- Tester:

## 1) Smoke Tests
- [ ] `GET http://localhost:1026/version` = 200
- [ ] `GET http://localhost:3001/version` = 200
- [ ] `GET http://localhost:3000/health` = ok
- [ ] `GET http://localhost:3001/v2/entities` = 200
- [ ] Dashboard `http://localhost:8080` mở được

## 2) Functional Tests
- [ ] Humidity event cập nhật entity sensor
- [ ] SmartPlug có đủ `onOff` + `activePower`
- [ ] Alert xuất hiện khi vượt ngưỡng
- [ ] Command demo trả ACK

## 3) Failure / Recovery
- [ ] Orion restart và hệ thống phục hồi
- [ ] Hardware/mock command fallback hoạt động
- [ ] Không spam alert khi event lặp

## 4) KPI
- End-to-end latency (sensor->alert):
- Command success rate:
- Crash count:

## 5) Notes
- 
