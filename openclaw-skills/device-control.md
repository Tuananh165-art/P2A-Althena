---
name: device-control
description: Control IoT devices - turn on/off, adjust settings
trigger: turn on, turn off, switch, activate, deactivate, control device
---

# Device Control

When the user wants to control an IoT device:

## Supported Devices

| Device | Entity ID | Actions |
|--------|-----------|---------|
| Humidity Sensor | urn:ngsi-ld:MatterDevice:1_1 | read only |
| Smart Plug | urn:ngsi-ld:MatterDevice:2_1 | ON, OFF, toggle |
| Alert Lamp | via Zigbee bridge | ON, OFF, brightness |
| Zigbee devices | via Zigbee bridge | ON, OFF, set value |

## Control Flow

1. Identify the device from user message
2. Determine the action (on/off/set)
3. For Zigbee devices:
   ```
   POST http://localhost:3003/devices/{name}/control
   Body: { "state": "ON" } or { "state": "OFF" }
   ```
4. For emulated devices (via MCP Agent):
   ```
   POST http://localhost:3002/tools/invoke_command
   Body: {
     "deviceId": "urn:ngsi-ld:MatterDevice:2_1",
     "action": "TURN_ON",
     "reason": "User requested via OpenClaw"
   }
   ```
5. Report result to user

## Response Format

**Success:**
> Smart Plug turned ON. Command ACK received.

**Failure:**
> Failed to control Smart Plug. Device may be offline.

**Safety Check:**
For sensitive actions (cutting power to multiple zones), ask for confirmation:
> Warning: This will cut power to Zone A. Confirm? (yes/no)

## Examples

User: "turn on the alert lamp"
-> POST /devices/alert_lamp/control { "state": "ON" }
-> "Alert lamp is now ON."

User: "switch off the smart plug"
-> POST /tools/invoke_command { "deviceId": "...", "action": "TURN_OFF" }
-> "Smart plug turned OFF. Command ACK received."
