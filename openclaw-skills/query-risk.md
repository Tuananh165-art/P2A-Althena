---
name: query-risk
description: Query the current risk assessment for a building zone
trigger: risk, danger, safety, zone status, how safe
---

# Query Risk Assessment

When the user asks about risk, danger level, or safety status of a zone:

## Steps

1. Call the MCP Agent risk endpoint:
   ```
   GET http://localhost:3002/risk?zone={zone}
   ```
   Default zone is "A" if not specified.

2. Format the response for the user:

   **If risk level is NORMAL:**
   > Zone {zone}: All clear. Risk score: {score}/100.
   > {rationale}

   **If risk level is WARNING:**
   > Zone {zone}: WARNING - Elevated risk detected.
   > Risk score: {score}/100
   > {rationale}
   > Recommended: {actions}

   **If risk level is CRITICAL:**
   > Zone {zone}: CRITICAL - Immediate attention required!
   > Risk score: {score}/100
   > {rationale}
   > Actions taken: {actions}
   > Confidence: {confidence}%

3. Include the reasoning source (AI or Rule-based).

## API Response Format

```json
{
  "zone": "A",
  "riskScore": 85,
  "riskLevel": "critical",
  "rationale": "Humidity 93% indicates flood risk...",
  "recommendedActions": ["TURN_ON_ALERT_LAMP", "NOTIFY_OPERATOR"],
  "reasoningSource": "ai",
  "confidence": 0.92,
  "timestamp": "2026-05-05T10:30:00Z"
}
```

## Zone Mapping

- Zone A: Main area (default)
- Zones can be added via configuration
