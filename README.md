# 🌡️🔥 Climate Resilience Copilot

> **AI-assisted climate resilience MVP for early detection of electrical fire risk during extreme heat events.**

<p align="center">
  <img alt="Project status" src="https://img.shields.io/badge/status-MVP-success?style=for-the-badge" />
  <img alt="FIWARE Orion" src="https://img.shields.io/badge/FIWARE-Orion-00AEEF?style=for-the-badge" />
  <img alt="NGSI-v2" src="https://img.shields.io/badge/API-NGSI--v2-blue?style=for-the-badge" />
  <img alt="License" src="https://img.shields.io/badge/license-see_LICENSE-lightgrey?style=for-the-badge" />
</p>

<p align="center">
  <img alt="Tech stack" src="https://skillicons.dev/icons?i=js,nodejs,html,css,docker,mongodb,powershell" />
</p>

## 🚀 Overview

Climate Resilience Copilot is a working MVP that monitors climate-driven electrical fire risk. It ingests simulated or real IoT device data, normalizes it into **FIWARE Orion** as **NGSI-v2** context entities, evaluates risk through a rule-first **MCP Agent**, and exposes operational views through a static dashboard and alert/action gateways.

The current proof-of-concept focuses on this flow:

```text
🌡️ Device / Simulator
        ↓
🔌 FIMAT Agent or Zigbee Bridge
        ↓
🧠 FIWARE Orion Context Broker
        ↓
🤖 MCP Agent
        ↓
📊 Dashboard / OpenClaw Gateway / Device Command
```

## 🎯 MVP Goals

- 🌡️ Monitor fire-risk signals: temperature, humidity, active power, and smart plug state.
- 🧠 Store device state as digital-twin context in FIWARE Orion.
- ⚖️ Evaluate risk with configurable thresholds in `mcp-agent/config.js`.
- 🎬 Support demo scenarios: `normal`, `warning`, and `critical`.
- 📊 Provide dashboard pages for overview, alerts, devices, map, simulator, and chat/demo flows.
- 🧩 Keep ingestion, context, decision, alert, and action modules separated for easier extension.

## 🧱 Architecture

```text
                           ┌──────────────────────┐
                           │  Matter / Sim Data   │
                           └──────────┬───────────┘
                                      │
                                      ▼
┌──────────────────────┐     ┌──────────────────────┐
│  Zigbee2MQTT / MQTT  │────▶│  Zigbee Bridge       │
└──────────────────────┘     └──────────┬───────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │     FIMAT Agent      │
                           └──────────┬───────────┘
                                      │ NGSI-v2
                                      ▼
                           ┌──────────────────────┐
                           │ FIWARE Orion + Mongo │
                           └───────┬──────┬───────┘
                                   │      │
                         ┌─────────▼─┐  ┌─▼────────────┐
                         │ Dashboard │  │  MCP Agent   │
                         └───────────┘  └──────┬───────┘
                                                │
                                                ▼
                                       ┌─────────────────┐
                                       │ OpenClaw Gateway│
                                       └─────────────────┘
```

## 📁 Repository Map

```text
.
├── docs/                                  Architecture, API, entity model, demo, FAQ
├── Matter-to-FIWARE-Monitoring-System/    Main service stack
│   ├── docker-compose.yml                 FIWARE Orion + MongoDB
│   ├── proxy-server.js                    CORS proxy for Orion, port 3001
│   ├── matter-emulators/                  Matter device emulators
│   ├── fimat-agent/                       Matter -> NGSI-v2 adapter, port 3000
│   ├── mcp-agent/                         Risk engine, AI reasoner, command executor, port 3002
│   ├── zigbee-bridge/                     Zigbee2MQTT -> FIWARE bridge, port 3003
│   ├── openclaw-gateway/                  Alert/skill/Telegram gateway, port 3004
│   └── monitor-dashboard/                 Static web dashboard
├── openclaw-skills/                       OpenClaw skill docs and Copilot skill package
├── scripts/                               Dev, smoke test, seed, and demo scripts
├── sim-generator/                         Simulation event generator
└── sim-seed/                              Seed datasets for Orion
```

## 🛠️ Tech Stack

### Languages & Runtime

| Logo | Technology | Used for |
| --- | --- | --- |
| <img src="https://skillicons.dev/icons?i=js" width="32" alt="JavaScript" /> | JavaScript | Agents, bridges, gateway, simulator, dashboard logic |
| <img src="https://skillicons.dev/icons?i=nodejs" width="32" alt="Node.js" /> | Node.js | Service runtime |
| <img src="https://skillicons.dev/icons?i=html" width="32" alt="HTML" /> | HTML | Static dashboard pages |
| <img src="https://skillicons.dev/icons?i=css" width="32" alt="CSS" /> | CSS | Dashboard styling |
| <img src="https://skillicons.dev/icons?i=powershell" width="32" alt="PowerShell" /> | PowerShell | Dev automation, smoke tests, demo scenarios |

### Platform & Data

| Logo | Technology | Used for |
| --- | --- | --- |
| <img src="https://skillicons.dev/icons?i=docker" width="32" alt="Docker" /> | Docker Compose | Local Orion + MongoDB stack |
| <img src="https://skillicons.dev/icons?i=mongodb" width="32" alt="MongoDB" /> | MongoDB 4.4 | Orion context persistence |
| 🧠 | FIWARE Orion 3.10.1 | NGSI-v2 Context Broker |
| 📡 | MQTT / zigbee2mqtt | Optional Zigbee ingestion path |
| 🔗 | NGSI-v2 | Context entity API contract |

## 🧩 Core Services

| Service | Purpose | Default port |
| --- | --- | ---: |
| 🍃 MongoDB | Context persistence for Orion | `27017` |
| 🧠 FIWARE Orion | NGSI-v2 Context Broker | `1026` |
| 🔌 FIMAT Agent | Matter data ingestion and NGSI-v2 conversion | `3000` |
| 🌐 Proxy Server | CORS proxy for `/version` and `/v2/*` | `3001` |
| 🤖 MCP Agent | Risk evaluation, alert management, command execution | `3002` |
| 📡 Zigbee Bridge | zigbee2mqtt/MQTT to FIWARE bridge | `3003` |
| 📣 OpenClaw Gateway | Alert webhook, skill routing, Telegram formatting | `3004` |
| 📊 Dashboard | Static monitoring UI | `8080` or `8001` |

## ✅ Requirements

- 🪟 Windows PowerShell.
- 🐳 Docker Desktop or Docker Engine with the Docker Compose plugin.
- 🟢 Node.js 16+.
- 📦 `npm`.
- 🌐 A web browser.
- 📡 MQTT broker and zigbee2mqtt only if you want a real Zigbee Bridge connection.

## 📦 Install Dependencies

From a fresh clone, install dependencies for each Node.js module:

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

Services with `.env.example` files:

- `Matter-to-FIWARE-Monitoring-System/mcp-agent`
- `Matter-to-FIWARE-Monitoring-System/openclaw-gateway`
- `Matter-to-FIWARE-Monitoring-System/zigbee-bridge`

Copy `.env.example` to `.env` inside the relevant service folder when you need custom configuration.

## ⚡ Quick Start

From the repository root:

```powershell
cd F:\P2A-Althena
.\scripts\dev-up.ps1
```

This starts:

- 🧠 Orion + MongoDB via Docker Compose.
- 🌐 Proxy Server at `http://localhost:3001`.
- 🔌 FIMAT Agent at `http://localhost:3000`.
- 🤖 MCP Agent at `http://localhost:3002`.
- 📡 Zigbee Bridge at `http://localhost:3003`.
- 📊 Dashboard at `http://localhost:8080`.

Open the dashboard:

```text
http://localhost:8080
```

Run a smoke test:

```powershell
.\scripts\smoke-test.ps1
```

Stop the stack:

```powershell
.\scripts\dev-down.ps1
```

> ⚠️ `dev-down.ps1` stops all local Node processes and runs `docker compose down` for this stack.

## 🎬 Full Demo Startup

The main service folder also includes `start-all.ps1`, which is more complete for demos. It can seed Orion, start OpenClaw Gateway, and serve the dashboard on port `8001`.

```powershell
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System
.\start-all.ps1
```

Useful options:

```powershell
.\start-all.ps1 -SeedScenario small-batch -DeviceControlMode simulator
.\start-all.ps1 -SkipSeed
```

Demo dashboard:

```text
http://localhost:8001
```

## 🧪 Demo Scenarios

After the stack is running, inject demo data into Orion and trigger MCP evaluation:

```powershell
cd F:\P2A-Althena
.\scripts\demo-scenario.ps1 -Mode normal
.\scripts\demo-scenario.ps1 -Mode warning
.\scripts\demo-scenario.ps1 -Mode critical
```

Main entities updated by the demo script:

- `urn:ngsi-ld:HumiditySensor:ZoneA_Room102_Sensor1`
- `urn:ngsi-ld:SmartPlug:ZoneA_Room102_AC`
- `urn:ngsi-ld:TemperatureSensor:ZoneA_Room102_Wiring`

## 🌱 Seed Data & Simulation

Import a seed dataset:

```powershell
cd F:\P2A-Althena
.\scripts\import-sim-seed.ps1 -Scenario small-batch
.\scripts\import-sim-seed.ps1 -Scenario normal
.\scripts\import-sim-seed.ps1 -Scenario overload
.\scripts\import-sim-seed.ps1 -Scenario offline
.\scripts\import-sim-seed.ps1 -Scenario noisy
```

Run the simulation generator and send events to Orion:

```powershell
.\scripts\run-sim.ps1 -Scenario normal -Duration 120 -Rate 1
.\scripts\run-sim.ps1 -Scenario overload -Duration 60 -Rate 2
```

## 🩺 Health Checks

Useful endpoints:

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

Primary smoke test:

```powershell
cd F:\P2A-Althena
.\scripts\smoke-test.ps1
```

Additional service check:

```powershell
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System
.\scripts\verify-all.ps1
```

## 🧪 Tests

Run tests for packages that currently define a test script:

```powershell
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\fimat-agent
npm test

cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\mcp-agent
npm test
```

`openclaw-gateway` currently has a `test/` folder, but its `package.json` does not define an `npm test` script yet.

## 🔥 Default Risk Rules

The active thresholds live in `Matter-to-FIWARE-Monitoring-System/mcp-agent/config.js`.

| Signal | Warning | Critical |
| --- | ---: | ---: |
| 💧 Humidity | `75% RH` | `90% RH` |
| ⚡ Active power | `800 W` | `950 W` |
| 🌡️ Temperature | `40 C` | `50 C` |

MCP Agent defaults:

- Poll interval: `MCP_POLL_INTERVAL=5000`.
- Risk cooldown: `RISK_COOLDOWN_MS=30000`.
- Rule engine remains the safety baseline.
- AI reasoner is configurable and should be treated as an assisting layer.

## ⚙️ Important Configuration

| Environment variable | Service | Default | Meaning |
| --- | --- | --- | --- |
| `ORION_HOST` / `ORION_PORT` | FIMAT, MCP, Zigbee | `localhost` / `1026` | Orion endpoint |
| `AGENT_PORT` | FIMAT | `3000` | FIMAT Agent port |
| `MCP_PORT` | MCP | `3002` | MCP Agent port |
| `DEVICE_CONTROL_MODE` | MCP | `live` | Device command mode; demos commonly use `simulator` |
| `REQUIRE_OPERATOR_APPROVAL` | MCP | `true` | Requires operator approval for sensitive actions |
| `AUTO_CRITICAL_ACTIONS` | MCP | `false` | Enables automatic critical actions when explicitly allowed |
| `AI_ENDPOINT` / `AI_API_KEY` / `AI_MODEL` | MCP | empty / empty / `gpt-4o-mini` | AI reasoner configuration |
| `MQTT_URL` | Zigbee Bridge | `mqtt://localhost:1883` | MQTT broker for zigbee2mqtt |
| `OPENCLAW_PORT` | OpenClaw Gateway | `3004` | Gateway port |
| `TELEGRAM_BOT_TOKEN` | OpenClaw Gateway | empty | Telegram bot token if Telegram alerts are used |

## 🚧 Current Status & Limits

- 🧪 This is an MVP/demo system, not a production deployment.
- 🔗 The main context API is FIWARE Orion NGSI-v2; full NGSI-LD is not implemented.
- 🧰 Matter devices are currently emulator/simulator driven.
- 📡 Zigbee Bridge needs a real MQTT broker and zigbee2mqtt for live integration.
- 🔐 The dashboard does not include authentication or authorization.
- 🕒 Long-term historical storage is not the current focus; Orion stores current context.
- 🤖 AI reasoning is configurable, but deterministic rules remain the primary safety baseline.

## 📚 Documentation

- `docs/ARCHITECTURE.md` - System architecture.
- `docs/API_CONTRACT.md` - API contract.
- `docs/ENTITY_MODEL.md` - Entity model.
- `docs/DEMO_SCRIPT.md` - Demo script.
- `docs/KPI_SCORECARD.md` - KPI scorecard.
- `docs/RISK_REGISTER.md` - Risk register.
- `docs/README_HACKATHON.md` - Hackathon-facing overview.
- `openclaw-skills/SKILLS.md` - OpenClaw skill list.

## 📄 License

This project uses the license declared in `LICENSE`.
