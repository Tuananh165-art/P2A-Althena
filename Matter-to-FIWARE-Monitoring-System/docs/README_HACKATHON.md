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
- MCP/AI layer có thể triển khai theo từng bước: tool contract -> reasoning -> action policy.

## 5.1 Trọng tâm build MVP: MCP + AI Agent
- Mục tiêu chính: chứng minh **AI orchestration loop** hoạt động được trên context realtime.
- Dashboard là lớp quan sát; lõi giá trị là năng lực tự động đề xuất/kích hoạt hành động có kiểm soát.
- Rule baseline giúp an toàn; AI tăng chất lượng quyết định và khả năng giải thích.

## 6. Tính nhân văn và tính thuyết phục
- Hỗ trợ phát hiện sớm nguy cơ ngập/chập/quá tải.
- Giảm độ trễ thông tin trong tình huống khẩn cấp.
- Có thể cứu tài sản và giảm rủi ro an toàn cho người dân.
- Hướng tới hỗ trợ con người ra quyết định, không thay thế hoàn toàn con người.

## 7. Judge FAQ (Innovation / Impact / Scalability)

### Q1) Innovation của team là gì, khác gì dashboard IoT thông thường?
**A:** Khác biệt cốt lõi là vòng lặp **Context -> Reasoning -> Action**:
1. Matter/emulator đưa dữ liệu thiết bị vào FIWARE theo chuẩn ngữ nghĩa.
2. MCP/AI Agent đọc context sống (không phải dữ liệu tĩnh) để đánh giá rủi ro.
3. Hệ thống không chỉ hiển thị mà còn có thể tạo cảnh báo và kích hoạt hành động có kiểm soát.

=> Đây là **AI điều phối vận hành** chứ không phải chatbot hay dashboard chỉ quan sát.

### Q2) Impact thực tế đo bằng gì?
**A:** Team tập trung vào KPI định lượng trong demo:
- End-to-end latency (sensor -> alert)
- Action success rate (command -> ACK)
- Alert quality (giảm alert spam nhờ dedupe/cooldown)

Impact xã hội:
- Phát hiện sớm ngập/chập/quá tải cục bộ.
- Hỗ trợ đội vận hành phản ứng nhanh hơn, giảm rủi ro tài sản và an toàn.

### Q3) Scalability có thật không hay chỉ demo nhỏ?
**A:** Có tính mở rộng theo kiến trúc:
- Thêm thiết bị mới theo pattern entity/attribute chuẩn.
- Thêm zone mới mà không phải viết lại toàn hệ thống.
- Tách lớp ingestion/context/decision/action nên dễ scale độc lập.
- Có thể mở rộng từ 1 nhà -> 1 tòa nhà -> nhiều khu vực.

### Q4) Vì sao dùng Matter + FIWARE + MCP?
**A:**
- **Matter**: chuẩn liên thông thiết bị smart home.
- **FIWARE Orion**: context broker mạnh cho digital twin runtime.
- **MCP**: chuẩn hóa cách AI agent dùng tools/context/actions.

Ba lớp này bổ sung nhau, tránh lock-in vào một vendor.

### Q5) Nếu AI sai thì sao?
**A:** Thiết kế theo nguyên tắc an toàn:
- Rule-based là baseline bắt buộc.
- AI là lớp nâng cao (giải thích + tối ưu đề xuất).
- Hành động nhạy cảm có **human-in-the-loop**.
- Có audit log để truy xuất “vì sao hệ thống quyết định như vậy”.

## 8. Tài liệu liên quan
- Master plan: `../HACKATHON_MVP_MASTER_PLAN.md`
- Kiến trúc: `./ARCHITECTURE.md`
- API contract: `./API_CONTRACT.md`
- Entity model: `./ENTITY_MODEL.md`
- Team split: `./TEAM_ROLES.md`
- Demo script: `./DEMO_SCRIPT.md`
- Test report template: `./TEST_REPORT.md`
- Risk register: `./RISK_REGISTER.md`
