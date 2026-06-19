---
name: judge-demo-commander
description: Run the full judge demo flow from health checks to risk, simulation, alerts, device action, and audit summary
trigger: judge demo, full demo, demo commander, end-to-end demo, full flow, ban giam khao
---

# Judge Demo Commander

Use this skill when the operator wants a single end-to-end demonstration for judges.

## Flow

1. Check service health:
   - Orion
   - MCP Agent
   - FIMAT Agent
   - Zigbee Bridge

2. Fetch live context:
   - Orion entities
   - Zone risk
   - Recent alerts
   - Recent command audit trail

3. Trigger a critical Zone A simulation.

4. Run immediate MCP evaluation.

5. Select the highest-power active controllable load in Zone A and turn it off.

6. Return an LLM-written Telegram briefing based only on the collected tool results.

## Response Must Include

- Service health
- Live risk and sensor evidence
- SimulationRun audit ID
- Alert count and severity
- Device selected and why
- Command status and command audit ID
- What the result proves about FIWARE -> MCP -> OpenClaw -> Telegram
