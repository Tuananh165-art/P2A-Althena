# 🌡️🔥 Climate Resilience Copilot

> **AI-Native Early Warning System for Climate-Driven Electrical Fire Risks**

![Status](https://img.shields.io/badge/Status-MVP-success)
![Hackathon](https://img.shields.io/badge/ASEAN_AI_Hackathon_2026-Top_40-orange)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🎯 Overview

Climate Resilience Copilot is an AI-assisted decision support system designed to detect and respond to **electrical fire risks caused by extreme heat waves**.

### ⚠️ Risk Chain

```text
🌍 Climate Change
        ↓
🌡️ Heat Wave (35–40°C+)
        ↓
⚡ Electrical Overload
        ↓
🔥 Wiring Overheat
        ↓
💥 Short Circuit
        ↓
🚒 Fire Incident
```

### 🚀 Objectives

* ⚡ Detect critical risks within **5 seconds**
* 🤖 Provide AI-assisted recommendations
* 📊 Deliver real-time situational awareness
* 📝 Maintain complete auditability
* 🛡️ Ensure reliable critical-event detection

---

# 🏗️ System Architecture

```text
📟 Devices / Emulators
          │
          ▼
🔄 FIMAT Agent / Zigbee Bridge
          │
          ▼
🧠 FIWARE Orion Context Broker
          │
   ┌──────┴─────────┐
   ▼                ▼
📊 Dashboard     🤖 MCP Agent
                 (Rules + AI)
                      │
                      ▼
              ⚙️ Actions & Commands
                      │
                      ▼
               ✅ ACK / Audit Trail
                      │
                      ▼
               📱 OpenClaw Alerts
```

### 🔄 Core Data Flow

```text
📟 Device
    ↓
🧠 Orion
    ↓
🤖 MCP Agent
    ↓
⚙️ Action
    ↓
✅ ACK
```

---

# 🛠️ Technology Stack

## 💻 Languages

<p>
<img src="https://skillicons.dev/icons?i=js,nodejs,python" />
</p>

## ☁️ Platform & Infrastructure

<p>
<img src="https://skillicons.dev/icons?i=docker,mongodb" />
</p>

### Core Components

| Component           | Purpose                            |
| ------------------- | ---------------------------------- |
| 🧠 FIWARE Orion     | Digital Twin Context Broker        |
| 🍃 MongoDB          | Context Persistence                |
| 🔄 FIMAT Agent      | Matter → NGSI-v2 Adapter           |
| 📡 Zigbee Bridge    | Zigbee → NGSI-v2 Adapter           |
| 🤖 MCP Agent        | Risk Evaluation & Decision Support |
| 📊 Dashboard        | Real-Time Monitoring               |
| 📱 OpenClaw Gateway | Notification & Automation          |

---

# 📦 Services

| Service                 | Port |
| ----------------------- | ---- |
| 🧠 Orion Context Broker | 1026 |
| 🔄 FIMAT Agent          | 3000 |
| 🌐 Proxy Server         | 3001 |
| 🤖 MCP Agent            | 3002 |
| 📡 Zigbee Bridge        | 3003 |
| 📱 OpenClaw Gateway     | 3004 |
| 📊 Dashboard            | 8080 |

---

# 🎯 Engineering Principles

### 1️⃣ Rule First, AI Second

Deterministic rules remain the primary decision source.

### 2️⃣ Full Auditability

Every command, response, and action is recorded.

### 3️⃣ Human-in-the-Loop

Critical actions require human approval.

### 4️⃣ Privacy by Design

No PII is processed in the MVP.

### 5️⃣ Configuration Driven

Environment-specific settings are never hardcoded.

---

# 🧪 Demo Validation

Run all checks before demonstration:

```powershell
scripts/dev-up.ps1
scripts/smoke-test.ps1
scripts/demo-scenario.ps1 -Mode critical
```

### ✅ Validation Checklist

* Dashboard accessible
* Orion healthy
* Critical alert generated
* SmartPlug contains:

  * `onOff`
  * `activePower`

---

# 🗺️ Development Roadmap

### Phase 1 — 🔄 Pipeline Hardening

* Matter ingestion stabilization
* Zigbee integration
* Metadata standardization

### Phase 2 — 🧠 Risk Intelligence

* Improved risk scoring
* Alert schema standardization
* False positive reduction

### Phase 3 — ⚙️ Action Reliability

* Reliable command lifecycle
* ACK/ERROR handling
* Dashboard visibility

### Phase 4 — 🎬 Demo Readiness

* Stable demo scenario
* One-command startup
* Operational runbook

### Phase 5 — 🚀 Future Extensions

* Telegram / Email notifications
* Multi-zone risk map
* CI/CD smoke testing
* Replay & forensic timeline

---

# 🌟 Project Vision

Climate Resilience Copilot combines:

🧠 **Digital Twins (FIWARE Orion)**
🤖 **AI-Assisted Reasoning**
⚡ **Real-Time Risk Detection**
📊 **Operational Visibility**
📝 **Auditable Actions**

to help organizations move from **reactive fire response** to **proactive climate resilience**.

---

### 🏆 ASEAN AI Hackathon 2026

**Team DNTU — ALTHENA**

*Climate Risk Detection → AI-Assisted Decision Support → Auditable Response Actions*
