# KPI SCORECARD — Electrical Fire Detection

## Fire Detection Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Fire risk detection latency** | **<= 5s** | Time from sensor reading to risk alert on dashboard |
| **False negative rate (critical)** | **0%** | Must detect every real fire risk |
| Command success rate | >= 90% | ACK responses / total commands (20 test runs) |
| Alert accuracy | >= 95% | Correct fire alerts / total alerts |
| Alert spam rate | 0 | Duplicate alerts within cooldown window |
| Compound hazard detection | Yes | System detects combined temp + power + humidity risk |
| Crash count | 0 | Service crashes during 10-min demo |
| Demo recovery time | <= 30s | Time to recover from simulated failure |

## Fire Risk Scenarios Tested

| Scenario | Trigger | Expected Response | Result |
|----------|---------|-------------------|--------|
| Heat wave warning | Temp >= 40°C + Power >= 800W | Alert + reduce load | |
| Wiring overheat critical | Temp >= 50°C + Power >= 950W | CUT POWER + alert + ACK | |
| Moisture short circuit | Humidity >= 90% + Power >= 800W | CUT POWER + alert + ACK | |
| Normal operation | All sensors in range | No alert | |

## Live Tracking

| Test Run | Latency (ms) | Command Result | Alert Correct | Notes |
|----------|-------------|----------------|---------------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |

## Aggregate Results

- **Average Latency:** -
- **Command Success Rate:** -
- **Alert Precision:** -
- **Crash Count:** -
