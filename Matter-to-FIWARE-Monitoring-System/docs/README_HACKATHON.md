# README_HACKATHON

## 1. Ý nghĩa của project
**Resilience Copilot (Matter x FIWARE x MCP)** là một MVP giúp biến dữ liệu IoT trong nhà (độ ẩm, trạng thái ổ cắm, công suất) thành **quyết định ứng phó thiên tai theo thời gian gần thực**.

Điểm khác biệt: không dừng ở giám sát, mà đi tới **cảnh báo + hành động**.

## 2. Nhu cầu và bài toán giải quyết
- Dữ liệu IoT phân tán, khó liên thông đa thiết bị/đa hãng.
- Thiếu một lớp context thống nhất để phân tích theo zone.
- Cảnh báo thường thủ công, phản ứng chậm.

**Giải pháp:**
- Matter/emulator -> FIMAT Agent -> Orion Context Broker -> MCP Agent -> Dashboard/thiết bị.
- Chuẩn hóa ngữ nghĩa qua NGSI-v2, thống nhất context để ra quyết định.

## 3. Lĩnh vực áp dụng
- Climate resilience
- Disaster mitigation & emergency response
- Smart building / smart campus / smart city pilot

## 4. Đối tượng sử dụng
- Ban quản lý tòa nhà/khu dân cư
- Đội vận hành an toàn
- Trung tâm điều phối ứng phó sự cố
- Nhóm nghiên cứu/đào tạo IoT + AI agent

## 5. Vì sao idea khả thi
- Có stack chạy thật trong repo (Orion/Mongo, agent, dashboard).
- Dễ bắt đầu bằng emulator, sau đó thay thế bằng phần cứng thực.
- Kiến trúc module hóa, tách ingestion / context / decision / action.

## 6. Tính nhân văn và tính thuyết phục
- Hỗ trợ phát hiện sớm nguy cơ ngập/chập/quá tải.
- Giảm độ trễ thông tin trong tình huống khẩn cấp.
- Có thể cứu tài sản và giảm rủi ro an toàn cho người dân.
- Hướng tới hỗ trợ con người ra quyết định, không thay thế hoàn toàn con người.

## 7. Tài liệu liên quan
- Master plan: `../HACKATHON_MVP_MASTER_PLAN.md`
- Kiến trúc: `./ARCHITECTURE.md`
- API contract: `./API_CONTRACT.md`
- Entity model: `./ENTITY_MODEL.md`
- Team split: `./TEAM_ROLES.md`
- Demo script: `./DEMO_SCRIPT.md`
- Test report template: `./TEST_REPORT.md`
- Risk register: `./RISK_REGISTER.md`
