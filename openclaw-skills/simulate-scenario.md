---
name: simulate-scenario
description: Trigger disaster simulation scenarios for demo
trigger: simulate, demo, test scenario, run demo, what if
---

# Simulate Scenario

When the user wants to run a demo or test scenario:

## Available Scenarios

| Scenario | Description | Trigger |
|----------|-------------|---------|
| normal | All readings normal | "simulate normal" |
| warning | Elevated risk (humidity 80%, power 850W) | "simulate warning" |
| critical | Critical risk (humidity 93%, power 970W) | "simulate critical" |
| flood | Rapid humidity increase | "simulate flood" |
| overload | Power spike | "simulate overload" |

## Execution

1. Call the MCP Agent evaluate endpoint after injecting data:
   ```
   POST http://localhost:3002/evaluate
   ```

2. Or use the demo-scenario script via shell:
   ```powershell
   scripts\demo-scenario.ps1 -Mode {mode}
   ```

3. Or directly patch Orion entities:
   ```
   PATCH http://localhost:3001/v2/entities/urn:ngsi-ld:HumiditySensor:ZoneA_Room102_Sensor1/attrs
   Body: { "measuredValue": { "type": "Number", "value": 93.5 } }
   ```

## Response Format

> Running critical scenario...
>
> Injected: Humidity 93.2%, Power 972W
>
> Result:
> 🔴 CRITICAL risk detected (score 92/100)
> Actions triggered: Alert lamp ON, Load reduced
> Command ACK: Success
>
> Scenario complete. Dashboard updated.

## Demo Flow

For a full demo, run scenarios in sequence:
1. "simulate normal" -> show green state
2. "simulate warning" -> show alert appearing
3. "simulate critical" -> show actions triggered
4. Show audit trail via "get alerts"
