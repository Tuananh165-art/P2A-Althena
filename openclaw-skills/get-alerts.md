---
name: get-alerts
description: Get recent alerts and alert history
trigger: alerts, warnings, notifications, what happened, incidents
---

# Get Alerts

When the user asks about alerts, warnings, or recent incidents:

## Steps

1. Fetch alerts from MCP Agent:
   ```
   GET http://localhost:3002/alerts?limit={limit}
   ```
   Default limit is 10.

2. Format for messaging:

   **If no alerts:**
   > No active alerts. System operating normally.

   **If alerts exist:**
   > Recent Alerts ({count}):
   >
   > 🔴 CRITICAL - Zone A: Flood risk detected (score 92)
   > 10:30 AM - Humidity 93% + Power 970W
   >
   > 🟡 WARNING - Zone A: High humidity (score 65)
   > 10:25 AM - Humidity 78%

3. Group by severity (critical first, then warning).

## Filter Options

User can ask for:
- "latest alerts" -> limit=5
- "critical alerts only" -> filter by level=critical
- "alerts today" -> filter by timestamp
- "alert history" -> limit=20

## API Response Format

```json
[
  {
    "level": { "value": "critical" },
    "zone": { "value": "A" },
    "message": { "value": "Risk critical in zone A" },
    "rationale": { "value": "Humidity 93% + abnormal power" },
    "timestamp": { "value": "2026-05-05T10:30:00Z" }
  }
]
```
