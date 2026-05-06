---
name: system-status
description: Get full system health and status
trigger: status, health, system check, how is everything, diagnostics
---

# System Status

When the user asks about overall system health:

## Steps

1. Check all services:
   ```
   GET http://localhost:3001/version        (Orion via proxy)
   GET http://localhost:3000/health          (FIMAT Agent)
   GET http://localhost:3002/health          (MCP Agent)
   GET http://localhost:3003/health          (Zigbee Bridge)
   GET http://localhost:3002/risk/all        (All zone risks)
   ```

2. Format status report:

   ```
   Resilience Copilot Status
   ========================

   Services:
   ✅ Orion Context Broker: Connected (v3.10.1)
   ✅ FIMAT Agent: Running
   ✅ MCP Agent: Running (AI: enabled)
   ✅ Zigbee Bridge: Connected (3 devices)

   Risk Assessment:
   Zone A: NORMAL (score 25/100)

   Active Alerts: 0
   Devices Online: 3
   Uptime: 2h 15m
   ```

3. If any service is down:
   ```
   Services:
   ✅ Orion: Connected
   ❌ MCP Agent: Disconnected
   ⚠️ Zigbee Bridge: MQTT reconnecting
   ```

## Device List

Also include registered devices:
   ```
   Devices:
   - Humidity Sensor (NodeID: 1) - Online
   - Smart Plug (NodeID: 2) - Online
   - Zigbee Motion Sensor - Online (last seen 5s ago)
   - Zigbee Water Leak Sensor - Online
   ```
