---
name: seed-scenario-inspector
description: Compare current live telemetry against sim-seed scenario profiles
trigger: seed scenario, sim-seed, closer to normal, closer to heat-wave, closer to overload, closer to noisy, closer to offline, giong normal, giong heat-wave, giong overload, giong noisy, giong offline
---

# Seed Scenario Inspector

Use this skill when the operator asks whether the current live data looks like one of the simulation seed profiles.

## Data Sources

- Live Orion entities
- Current MCP risk results
- Recent alerts
- Local seed files:
  - `sim-seed/normal.json`
  - `sim-seed/heat-wave.json`
  - `sim-seed/overload.json`
  - `sim-seed/noisy.json`
  - `sim-seed/offline.json`

## Comparison Metrics

- Maximum temperature
- Maximum humidity
- Maximum smart-plug power
- Average smart-plug power
- Active controllable loads
- Alert/risk context

## Response Must Include

- Nearest matching seed scenario
- Evidence from live telemetry
- Differences from each seed profile
- Whether the current system looks normal, heat-wave, overload, noisy, or offline
- Recommended operator next step
