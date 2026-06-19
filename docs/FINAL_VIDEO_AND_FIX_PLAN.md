# DNTU01 ALTHENA - Final Video And Fix Plan

## 1. Ket luan tu feedback

Prototype da co nen ky thuat tot: dashboard, FIWARE Orion, MCP Agent, simulator, risk score, 3D zone, Telegram/AI chat, ACK/ERROR audit. Diem yeu chinh cua video cu khong phai la he thong khong chay, ma la nguoi xem phai tu suy luan qua nhieu.

Video final 5 phut can chung minh 5 y:

1. ALTHENA giai quyet rui ro chay dien do nang nong cuc doan trong boi canh ASEAN.
2. AI/MCP nam o dau trong kien truc va khong thay the rule-first safety path.
3. Luong normal -> warning -> critical -> human-approved action ro rang.
4. Dataset/validation/KPI du minh bach cho MVP.
5. Co business model va kha nang mo rong sang campus, dormitory, public buildings.

## 2. Code da cap nhat de video thuyet phuc hon

- MCP Agent bo sung `safetyPolicy` trong risk response va ZoneRisk audit.
- Critical action mac dinh tao `CommandExecution` voi status `APPROVAL_REQUIRED`, khong tao cam giac he thong tu y cat dien.
- Van co tuy chon demo auto simulation bang env `AUTO_CRITICAL_ACTIONS=true` neu can quay canh tu dong tat tai.
- Dashboard Overview hien policy human approval, reminder 30s, escalation 60s.
- Command timeline hien `requestedBy`, `approvalRequired`, `policy`, ACK/ERROR/status.
- CommandExecutor mac dinh ghi simulated audit ro rang khi khong co adapter that.
- Test `mcp-agent` da pass 11/11.

## 3. Recommend chinh sua tiep theo neu con thoi gian

Uu tien cao:

- Them mot bang nho tren dashboard hoac slide: `Normal / Warning / Critical / Action / Fallback`.
- Tao trang hoac panel `KPI Scorecard`: latency, false negative, precision/recall tren replay scenarios, audit completeness.
- Them nut/flow `Approve mitigation` rieng cho critical thay vi dung nut device control chung.
- Them seed data validation: mot file replay CSV/JSON va script test in ra confusion matrix.
- Them health banner giai thich `degraded` la phat hien duoc loi bridge/telemetry, khong phai demo bi hong.

Uu tien trung binh:

- Sua encoding mojibake trong README/docs Markdown.
- Gom cac lenh demo vao mot script `final-demo.ps1`: start stack, normal, warning, critical, evaluate, export logs.
- Them overlay text trong video thay vi de nguoi xem doc chu nho tren Telegram.

## 4. Checklist truoc khi quay

1. Start stack theo cach ban da build thanh cong.
2. Mo dashboard: `http://localhost:8080`.
3. Kiem tra sidebar co `Orion Connected` va `MCP Agent Running`.
4. Bam `Normal`, sau do `Evaluate now`, chup canh risk low.
5. Bam `Warning`, sau do `Evaluate now`, chup canh risk/rationale.
6. Bam `Critical`, sau do `Evaluate now`, chup canh `APPROVAL_REQUIRED` trong command timeline.
7. Mo AI Chat/Telegram, hoi 3 cau ngan:
   - `Summarize the incident timeline.`
   - `Why is the risk still unsafe after load reduction?`
   - `What conditions are required before restoring power?`
8. Chuan bi 3 slide chen nhanh: architecture, validation/KPI, business/ASEAN rollout.

## 5. Kich ban quay video 5 phut

### 0:00-0:25 - Problem

Hinh anh: logo team, title, animation/slide: Heatwave -> Cooling demand -> Electrical overload -> Wiring stress -> Fire risk.

Voice:
Across ASEAN, extreme heat increases cooling demand in campuses, dormitories, and public buildings. Before smoke appears, electrical systems may already be under stress. ALTHENA is an AI-native Climate Resilience Copilot that detects early compound risks and supports safe, human-supervised response.

### 0:25-0:55 - Solution

Hinh anh: IoT -> Digital Twin -> MCP/AI Risk Analysis -> Human-supervised Action -> Audit.

Voice:
ALTHENA transforms IoT telemetry into FIWARE digital-twin context, evaluates fire risk through transparent rules, uses AI to explain the situation, and guides operators through auditable response workflows.

### 0:55-1:15 - Architecture

Hinh anh: Matter/Zigbee -> FIMAT/Zigbee Bridge -> Orion -> MCP Agent -> Dashboard/Telegram/Command Log.

Voice:
The MCP Agent observes Orion context, computes risk, explains alerts, recommends response playbooks, and records command outcomes. The safety path is rule-first; AI supports explanation and operator decision-making.

### 1:15-1:35 - Dataset And Validation

Hinh anh: bang ngan.

Noi dung tren man hinh:
- Data: synthetic and replayed MVP telemetry.
- Features: temperature, humidity, active power, device state, timestamp, zone.
- Target: normal, warning, critical.
- Metrics: latency, confusion matrix, precision/recall, false-negative checks, audit completeness.
- Next: campus baseline and past incident-informed scenarios.

### 1:35-1:50 - Escalation Logic

Hinh anh: bang normal -> warning -> critical -> action/fallback.

Voice:
The workflow is intentionally simple: normal monitoring, warning explanation, critical alert, then operator-approved mitigation or escalation. This keeps the system understandable and auditable.

### 1:50-2:25 - Demo Normal

Hinh anh: dashboard Overview.

Thao tac:
1. Bam `Normal`.
2. Bam `Evaluate now`.
3. Zoom vao Orion/MCP status, low risk, stable sensors.

Voice:
In the normal scenario, digital-twin connectivity is active, sensors are stable, and no emergency action is triggered.

### 2:25-3:00 - Demo Warning

Thao tac:
1. Bam `Warning`.
2. Bam `Evaluate now`.
3. Zoom vao risk score, rationale, recommended actions.

Voice:
When temperature, humidity, or active power rises, ALTHENA classifies the condition as warning and explains why heat stress and cooling load can increase electrical fire risk.

### 3:00-3:35 - Demo Critical And AI Explanation

Thao tac:
1. Bam `Critical`.
2. Bam `Evaluate now`.
3. Zoom vao critical score, rationale, command timeline.
4. Mo AI Chat/Telegram incident summary.

Voice:
In the critical scenario, high temperature, high humidity, and abnormal load occur together. The MCP Agent computes a critical risk and provides a human-readable explanation and response playbook.

### 3:35-4:15 - Human Intervention And Audit

Hinh anh: command timeline co `APPROVAL_REQUIRED`, policy reminder/escalation.

Voice:
ALTHENA is not uncontrolled automation. Sensitive actions require operator approval. If the operator does not respond, the system repeats the alert after 30 seconds and escalates after 60 seconds. Every decision is logged with timestamp, reason, requester, status, and ACK or ERROR.

### 4:15-4:35 - KPI Evidence

Hinh anh: KPI scorecard.

Voice:
The MVP is measured through detection latency, false-negative checks in critical replay scenarios, precision and recall, MCP tool-use logs, and audit completeness. The longer demo and logs provide technical evidence that the system runs end to end.

### 4:35-4:55 - Business And ASEAN Scale

Hinh anh: customers and rollout.

Voice:
ALTHENA complements certified fire alarm systems as an early climate-risk decision-support layer. Initial users are campuses, dormitories, public buildings, and facility managers. Rollout starts at DNTU, expands to Vietnamese campuses, and then ASEAN pilots with local thresholds, multilingual alerts, and country-specific procedures.

### 4:55-5:00 - Closing

Voice:
ALTHENA helps ASEAN buildings move from reactive alarms to explainable, human-supervised climate resilience.

## 6. Loi quay nen tranh

- Dung quay Telegram qua lau neu chu nho; chi quay 1-2 cau tra loi quan trong va zoom.
- Dung noi "AI tu dong tat dien" trong pitch life-safety. Hay noi "operator-approved mitigation" hoac "simulated mitigation in MVP".
- Dung de canh Zigbee unavailable/999V/1.5 power factor xuat hien ma khong giai thich; neu hien thi thi noi do la invalid telemetry/degraded-service detection.
- Dung quay nhieu tab lan man; moi canh phai tra loi mot cau hoi cua judge.
