# JUDGE FAQ (1-Page Quick Reference)

## What is this?
**Climate Resilience Copilot** — an AI platform that detects electrical fire risk caused by climate change-driven heat waves, using IoT sensors for real-time monitoring and automated protective response.

## The Problem (Clear Link: Climate Change → Fire)
```
Climate Change → Heat Wave (35-40°C+)
  → Electrical Overload (AC, cooling at max)
  → Wiring Overheat + Insulation Degradation
  → Short Circuit → ELECTRICAL FIRE
```
Electrical fires are the #1 cause of urban fires. Current monitoring reacts in minutes-to-hours. We need **seconds-level detection**.

## How it works (30 seconds)
```
Temperature Sensor (°C) ─┐
Smart Plug (W, on/off)  ─┼→ FIMAT Agent → Orion (Digital Twin) → MCP AI Agent → Auto Response
Humidity Sensor (%RH)   ─┘
```
Three sensors feed real-time data into a context broker. An AI agent evaluates fire risk using rules + LLM reasoning, then triggers protective actions (power cut, alerts) within 5 seconds.

## Sensors for Realtime Detection
| Sensor | Measures | Fire Risk Indicator |
|--------|----------|-------------------|
| **Temperature Sensor** | Ambient temp (°C) | Wiring overheat — primary |
| **Smart Plug** | Power (W), on/off | Electrical load — overload risk |
| **Humidity Sensor** | Moisture (%RH) | Short circuit when + high power |

## Fire Risk Scoring
| Indicator | Warning | Critical |
|-----------|---------|----------|
| Temperature | >= 40°C | >= 50°C |
| Power | >= 800W | >= 950W |
| Temp + Power combo | Compound fire hazard | Imminent fire risk |
| Humidity + Power | Moisture short circuit | Arc flash risk |

## Demo Flow (3 min)
1. **Normal** — all green, temp 28°C, power 100W
2. **Heat wave warning** — temp 43°C, power 850W → alert appears
3. **Critical fire risk** — temp 55°C, power 980W → power CUT, alert lamp ON, ACK confirmed
4. **Audit trail** — what triggered, when, why, which sensor

## Specific Goals
- Detect fire risk in **<= 5 seconds** from sensor reading
- **0 false negatives** for critical events
- Automated response: power cut + alert + notification
- Scalable: 1 house → 1 building → multi-zone city

## Tech Stack
- **Matter/Zigbee** (IoT device protocols)
- **FIWARE Orion** (context broker / digital twin)
- **MCP Agent** (AI orchestration + fire risk engine)
- **OpenClaw** (multi-channel alert delivery)
- **Leaflet.js** (smart city map with GPS)

## FAQ

**Q: Why electrical fire?**
A: Climate change causes extreme heat → electrical overload → fire. This is the #1 urban fire cause and has a clear sensor-to-action pipeline.

**Q: What if AI is wrong?**
A: Rule-based baseline always runs first. AI adds explanation. Sensitive actions (power cut) require human confirmation option.

**Q: Real hardware?**
A: MVP uses emulators. Architecture is hardware-agnostic — swap in real Tuya smart plugs and Zigbee sensors via bridge.

**Q: How does it scale?**
A: Add devices = add NGSI entities. Add zones = add ZoneRisk instances. Each layer scales independently.

**Q: Why 5 seconds?**
A: Sensor interval (5s) + polling (5s) + response = 5-10s total. Fire needs minutes to develop — 5s detection gives time to prevent it.
