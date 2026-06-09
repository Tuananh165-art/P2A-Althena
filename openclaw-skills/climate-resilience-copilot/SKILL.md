---
name: climate-resilience-copilot
description: "Use live FIWARE monitoring data and audited MCP Agent actions for electrical fire risk, alerts, IoT devices, smart-plug control, scenario simulation, city summaries, and system health. Use this skill whenever the user asks about current temperature, humidity, power, heat-wave or fire risk, recent incidents, monitored zones, sensor or smart-plug state, system availability, running a normal/warning/critical simulation, publishing or acknowledging an alert, or turning a controllable device on or off."
---

# Climate Resilience Copilot

Use the bundled CLI to obtain live application data before answering. Do not infer
current values from conversation history, examples, seed data, or prior tool output.

## Operations

Run commands from this skill directory:

```powershell
node scripts/climate-api.mjs health
node scripts/climate-api.mjs risk --zone A
node scripts/climate-api.mjs explain --zone A
node scripts/climate-api.mjs alerts --limit 20
node scripts/climate-api.mjs alerts --limit 20 --level CRITICAL
node scripts/climate-api.mjs commands --limit 20
node scripts/climate-api.mjs devices
node scripts/climate-api.mjs devices --zone A --type SmartPlug
node scripts/climate-api.mjs city-summary
node scripts/climate-api.mjs tools
```

Select the smallest operation that answers the question:

- `risk`: current computed risk and contributing measurements for a zone.
- `explain`: live risk payload for explaining why the current metrics are dangerous.
- `alerts`: recent alert history, optionally filtered by severity.
- `commands`: recent command audit history from Orion.
- `devices`: live NGSI entities, optionally filtered by zone or entity type.
- `city-summary`: zones, critical zones, recent alerts, and device count.
- `health`: MCP Agent, Orion, FIMAT Agent, and Zigbee Bridge availability.
- `tools`: MCP Agent tool schema discovery.

## Confirmed Actions

Mutating operations require explicit operator confirmation. First run the command without
`--confirm` to produce a preview. Ask the user to confirm the exact action, target, zone,
and reason. Only then rerun with `--confirm`.

```powershell
node scripts/climate-api.mjs control --zone A --type SmartPlug --action TURN_OFF --reason "operator confirmed load reduction"
node scripts/climate-api.mjs control --zone A --type SmartPlug --action TURN_OFF --reason "operator confirmed load reduction" --confirm

node scripts/climate-api.mjs simulate --scenario critical --zone A
node scripts/climate-api.mjs simulate --scenario critical --zone A --confirm

node scripts/climate-api.mjs publish-alert --level critical --zone A --message "Manual critical alert" --rationale "Operator confirmed external observation"
node scripts/climate-api.mjs publish-alert --level critical --zone A --message "Manual critical alert" --rationale "Operator confirmed external observation" --confirm

node scripts/climate-api.mjs ack-alert --alert-id urn:ngsi-ld:AlertEvent:A_123 --operator operator@example.com --note "investigating"
node scripts/climate-api.mjs ack-alert --alert-id urn:ngsi-ld:AlertEvent:A_123 --operator operator@example.com --note "investigating" --confirm
```

Action rules:

- `control` discovers the target device from live NGSI data before invoking command.
- If discovery returns zero or multiple devices, do not execute. Ask for clarification.
- Mock hardware returns `SIMULATED_ACK`, not real `ACK`.
- `simulate` writes a `SimulationRun` audit entity and triggers evaluation.
- `publish-alert` and `ack-alert` modify alert state and should be used only after
  confirmation.

## Response Rules

1. Treat output as live only when `source` is `live`.
2. Report values exactly as returned in `data`; preserve units when present.
3. State the zone or device identifier when it matters.
4. If `ok` is false and `data.status` is `CONFIRMATION_REQUIRED`, ask for confirmation
   instead of treating it as a failure.
5. If `ok` is false for any other reason, identify unavailable services or validation
   errors and avoid claiming success.
6. If the command returns an error, explain that live data is unavailable. Never replace it
   with sample values.
7. Answer in the user's language.

## Safety Boundary

This skill may run audited actions only through the CLI and only after confirmation.
Never claim that physical hardware definitely changed state when the command status is
`SIMULATED_ACK`. Say it was simulated and audited.

Read [references/api-contract.md](references/api-contract.md) when endpoint semantics or
data ownership are unclear. Read
[references/safety-policy.md](references/safety-policy.md) before proposing an operational
response.
