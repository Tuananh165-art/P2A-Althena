# IoT Device Connection Guide — Climate Resilience Copilot

## Overview

Hướng dẫn kết nối thiết bị IoT thực (Smart Plug, Cảm biến...) vào hệ thống Resilience Copilot thông qua FIWARE Orion Context Broker.

### Supported Device Types

| Device | Protocol | Bridge | NGSI Entity |
|--------|----------|--------|-------------|
| WiFi Smart Plug (Tuya) | WiFi/Tuya Cloud | tuya-mqtt | SmartPlug |
| Zigbee Humidity Sensor | Zigbee/zigbee2mqtt | zigbee-bridge | HumiditySensor |
| Zigbee Smart Plug | Zigbee/zigbee2mqtt | zigbee-bridge | SmartPlug |
| Zigbee Motion Sensor | Zigbee/zigbee2mqtt | zigbee-bridge | MotionSensor |
| Zigbee Water Leak Sensor | Zigbee/zigbee2mqtt | zigbee-bridge | WaterLeakSensor |
| Zigbee Alert Lamp | Zigbee/zigbee2mqtt | zigbee-bridge | AlertLamp |

---

## 1) WiFi Smart Plug (Tuya / Smart Life / Tuya Smart)

### 1.1 Thiết bị yêu cầu

- **Ổ cắm điện thông minh WiFi** (Smart Plug 16A ~ 3500W)
- Hỗ trợ: điều khiển từ xa, hẹn giờ bật/tắt, đo lượng điện tiêu thụ
- App điều khiển: **Smart Life**, **Tuya Smart**
- Kết nối: Google Home, Amazon Alexa

**Gợi ý sản phẩm:**
- Tuya WiFi Smart Plug 16A with Energy Monitoring
- Any Tuya-compatible smart plug (hỗ trợ protocol Tuya)

### 1.2 Bước 1: Setup thiết bị với App

1. Tải app **Smart Life** hoặc **Tuya Smart** trên điện thoại
2. Tạo tài khoản và đăng nhập
3. Thêm thiết bị mới:
   - Mở app -> **Add Device** -> **Electrical** -> **Socket (WiFi)**
   - Kết nối WiFi (2.4GHz, không hỗ trợ 5GHz)
   - Làm theo hướng dẫn trên app
4. Kiểm tra thiết bị hoạt động: bật/tắt qua app
5. Ghi lại **Device ID** (trong Device Info / About)

### 1.3 Bước 2: Tuya Cloud Developer Account

1. Truy cập: https://developer.tuya.com/
2. Đăng ký tài khoản developer
3. Tạo **Cloud Project**:
   - Go to **Cloud** -> **Create Cloud Project**
   - Project Name: `Resilience-Copilot`
   - Development Method: **Smart Home**
   - Data Center: **Western America** (hoặc vùng gần VN)
4. Ghi lại:
   - **Access ID / Client ID**
   - **Access Secret / Client Secret**
5. Cấp quyền API:
   - Trong project -> **API Explorer** -> Enable:
     - `IoT Core` (device control)
     - `Smart Home Device Management`
     - `Device Status Notification`
6. Link thiết bị vào project:
   - **Devices** -> **Link Tuya App Account**
   - Authorize app Smart Life/Tuya Smart

### 1.4 Bước 3: Tuya-to-MQTT Bridge

#### Option A: tuya-mqtt (Recommended)

```bash
# Install
npm install -g tuya-mqtt

# Configure
cat > tuya-mqtt-config.json << 'EOF'
{
  "tuyaRegion": "eu",
  "tuyaAccessId": "YOUR_ACCESS_ID",
  "tuyaAccessSecret": "YOUR_ACCESS_SECRET",
  "tuyaAppSchema": "tuyaSmart",
  "mqttHost": "localhost",
  "mqttPort": 1883
}
EOF

# Run
tuya-mqtt -c tuya-mqtt-config.json
```

#### Option B: tuyapi (Node.js library)

```bash
npm install tuyapi

# Create bridge script
cat > tuya-bridge.js << 'EOF'
const TuyaDevice = require('tuyapi');
const mqtt = require('mqtt');

const device = new TuyaDevice({
  id: 'YOUR_DEVICE_ID',
  key: 'YOUR_DEVICE_KEY'
});

const mqttClient = mqtt.connect('mqtt://localhost:1883');

device.on('data', data => {
  const state = {
    onOff: data.dps['1'],        // Switch state
    activePower: data.dps['19']  // Power consumption (mW -> W)
  };
  mqttClient.publish('tuya/smartplug/state', JSON.stringify(state));
});

device.find().then(() => device.connect());
EOF

node tuya-bridge.js
```

### 1.5 Bước 4: Tuya Attribute Mapping -> NGSI-v2

| Tuya DPS | Description | NGSI Attribute | Type | Unit |
|----------|-------------|----------------|------|------|
| dps.1 | Switch (on/off) | `onOff` | Boolean | - |
| dps.19 | Current (mA) | `current` | Number | mA |
| dps.20 | Power (mW) | `activePower` | Number | W |
| dps.21 | Voltage (mV) | `voltage` | Number | V |
| dps.22 | Energy consumption (Wh) | `energyConsumed` | Number | Wh |

**NGSI-v2 Entity Example:**
```json
{
  "id": "urn:ngsi-ld:TuyaSmartPlug:abcdef123456",
  "type": "SmartPlug",
  "onOff": { "type": "Boolean", "value": true },
  "activePower": {
    "type": "Number",
    "value": 850.5,
    "metadata": {
      "unit": { "type": "string", "value": "W" },
      "timestamp": { "type": "string", "value": "2026-05-06T10:30:00Z" }
    }
  },
  "voltage": {
    "type": "Number",
    "value": 220.1,
    "metadata": { "unit": { "type": "string", "value": "V" } }
  },
  "current": {
    "type": "Number",
    "value": 3860,
    "metadata": { "unit": { "type": "string", "value": "mA" } }
  }
}
```

### 1.6 Bước 5: Tích hợp vào Resilience Copilot

#### Option A: Qua Zigbee Bridge (MQTT)

Nếu dùng tuya-mqtt bridge, thiết bị sẽ publish state qua MQTT topic `tuya/+`. Cần mở rộng zigbee-bridge để subscribe thêm topic này:

```javascript
// Thêm vào zigbee-bridge/src/index.js
const TUYA_TOPIC = 'tuya/+';
client.subscribe(TUYA_TOPIC);

client.on('message', (topic, message) => {
  if (topic.startsWith('tuya/')) {
    handleTuyaMessage(topic, message);
  }
});
```

#### Option B: Direct Orion Push (khuyên dùng cho demo)

Tạo script bridge trực tiếp từ Tuya Cloud API -> Orion:

```javascript
// tuya-orion-bridge.js
const axios = require('axios');
const crypto = require('crypto');

const TUYA_ACCESS_ID = process.env.TUYA_ACCESS_ID;
const TUYA_ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;
const TUYA_DEVICE_ID = process.env.TUYA_DEVICE_ID;
const ORION_URL = 'http://localhost:1026';

// Tuya API authentication (v2)
async function getTuyaToken() {
  const timestamp = Date.now().toString();
  const signStr = TUYA_ACCESS_ID + timestamp;
  const sign = crypto.createHmac('sha256', TUYA_ACCESS_SECRET)
    .update(signStr).digest('hex').toUpperCase();

  const res = await axios.get('https://openapi.tuyaeu.com/v1.0/token?grant_type=1', {
    headers: {
      'client_id': TUYA_ACCESS_ID,
      'sign': sign,
      'sign_method': 'HMAC-SHA256',
      't': timestamp
    }
  });
  return res.data.result.access_token;
}

// Get device status from Tuya Cloud
async function getDeviceStatus(token) {
  const timestamp = Date.now().toString();
  const path = `/v1.0/devices/${TUYA_DEVICE_ID}/status`;
  const signStr = TUYA_ACCESS_ID + token + timestamp;
  const sign = crypto.createHmac('sha256', TUYA_ACCESS_SECRET)
    .update(signStr).digest('hex').toUpperCase();

  const res = await axios.get(`https://openapi.tuyaeu.com${path}`, {
    headers: {
      'client_id': TUYA_ACCESS_ID,
      'access_token': token,
      'sign': sign,
      'sign_method': 'HMAC-SHA256',
      't': timestamp
    }
  });
  return res.data.result;
}

// Push to Orion NGSI-v2
async function pushToOrion(dps) {
  const entity = {
    onOff: { type: 'Boolean', value: dps['1'] },
    activePower: {
      type: 'Number',
      value: (dps['20'] || 0) / 1000,  // mW -> W
      metadata: { unit: { type: 'string', value: 'W' } }
    }
  };

  try {
    await axios.patch(
      `${ORION_URL}/v2/entities/urn:ngsi-ld:TuyaSmartPlug:${TUYA_DEVICE_ID}/attrs`,
      entity,
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    if (err.response?.status === 404) {
      // Entity not found, create it
      await axios.post(`${ORION_URL}/v2/entities`, {
        id: `urn:ngsi-ld:TuyaSmartPlug:${TUYA_DEVICE_ID}`,
        type: 'SmartPlug',
        ...entity
      }, { headers: { 'Content-Type': 'application/json' } });
    }
  }
}

// Polling loop
async function main() {
  const token = await getTuyaToken();
  console.log('[TuyaBridge] Connected to Tuya Cloud');

  setInterval(async () => {
    try {
      const status = await getDeviceStatus(token);
      const dps = {};
      status.forEach(s => { dps[s.code] = s.value; });
      await pushToOrion(dps);
      console.log('[TuyaBridge] Synced to Orion:', dps);
    } catch (err) {
      console.error('[TuyaBridge] Error:', err.message);
    }
  }, 5000);  // Poll every 5s
}

main();
```

Chạy bridge:
```bash
# Cấu hình .env
TUYA_ACCESS_ID=your_access_id
TUYA_ACCESS_SECRET=your_access_secret
TUYA_DEVICE_ID=your_device_id

# Run
node tuya-orion-bridge.js
```

---

## 2) Zigbee Devices (via zigbee2mqtt)

### 2.1 Yêu cầu phần cứng

| Hardware | Description | Price (approx) |
|----------|-------------|-----------------|
| Zigbee Coordinator | SONOFF Zigbee 3.0 USB Dongle Plus (CC2652P) | ~$15-25 |
| Zigbee Router (optional) | IKEA TRADFRI signal repeater | ~$10 |
| Zigbee Sensors | Xiaomi/Aqara humidity, motion, water leak | ~$10-20 each |
| Zigbee Smart Plug | IKEA TRADFRI, SONOFF S31 Lite ZB | ~$10-15 |

### 2.2 Setup zigbee2mqtt

```bash
# Install zigbee2mqtt
git clone https://github.com/Koenkk/zigbee2mqtt.git
cd zigbee2mqtt
npm ci

# Configure
cat > data/configuration.yaml << 'EOF'
homeassistant: false
permit_join: true
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://localhost:1883
serial:
  port: COM3  # Windows - check Device Manager
  # port: /dev/ttyUSB0  # Linux
advanced:
  network_key: GENERATE
  pan_id: GENERATE
  channel: 20
EOF

# Run
npm start
```

### 2.3 Pair Zigbee Devices

1. Put device in pairing mode (usually long-press button 5s)
2. In zigbee2mqtt log, look for: `Device '0x00158d0001234567' joined`
3. Device auto-registers in zigbee-bridge -> Orion

### 2.4 Attribute Mapping (auto by zigbee-bridge)

| Zigbee Device | MQTT State | NGSI Entity | Attributes |
|---------------|-----------|-------------|------------|
| Humidity Sensor | `{ "humidity": 65.2 }` | HumiditySensor | `measuredValue` (%RH) |
| Smart Plug | `{ "state": "ON", "power": 850 }` | SmartPlug | `onOff`, `activePower` (W) |
| Motion Sensor | `{ "occupancy": true }` | MotionSensor | `detected` (Boolean) |
| Water Leak | `{ "water_leak": true }` | WaterLeakSensor | `detected` (Boolean) |
| Light/Lamp | `{ "state": "ON", "brightness": 200 }` | AlertLamp | `onOff`, `brightness` (0-254) |

---

## 3) Google Home & Alexa Integration

Smart plugs kết nối qua Tuya/Smart Life đã hỗ trợ Google Home và Alexa:

### Google Home
1. Mở Google Home app
2. **+** -> **Set up device** -> **Works with Google**
3. Tìm **Smart Life** hoặc **Tuya Smart**
4. Đăng nhập tài khoản Smart Life/Tuya Smart
5. Devices auto-sync to Google Home

### Amazon Alexa
1. Mở Alexa app
2. **Devices** -> **+** -> **Add Device**
3. Chọn **Smart Home** -> **Smart Life** skill
4. Enable skill và đăng nhập
5. "Alexa, discover devices"

**Lưu ý:** Google/Alexa control song song với Resilience Copilot. Không xung đột vì cả hai đều control qua Tuya Cloud API.

---

## 4) End-to-End Data Flow

```
[Physical Smart Plug (WiFi)]
    |
    | WiFi -> Tuya Cloud
    v
[Tuya Cloud API]
    |
    | HTTP polling (5s)
    v
[tuya-orion-bridge.js]
    |
    | NGSI-v2 POST/PATCH
    v
[FIWARE Orion :1026]
    |
    +---> [MCP Agent :3002] -> Risk Engine -> Alerts/Commands
    |
    +---> [Dashboard :8080] -> Monitor + Chat + Map
```

---

## 5) Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tuya device not found | Device not linked to cloud project | Link Smart Life account in Tuya Developer |
| MQTT connection refused | MQTT broker not running | Start Mosquitto: `mosquitto -v` |
| Orion entity not created | Bridge not running or wrong URL | Check ORION_URL in .env, verify bridge logs |
| Zigbee device won't pair | Too far from coordinator | Add Zigbee router/repeater |
| Power reading = 0 | Plug doesn't support energy monitoring | Use plug with power monitoring feature |
| CORS error in dashboard | Proxy not running | Start proxy-server.js on port 3001 |
| Tuya API rate limit | Polling too fast | Increase polling interval to 10s+ |

### Debug Commands

```bash
# Check Orion entities
curl http://localhost:1026/v2/entities | json_pp

# Check MCP health
curl http://localhost:3002/health

# Check MQTT messages
mosquitto_sub -t "zigbee2mqtt/#" -v
mosquitto_sub -t "tuya/#" -v

# Check Zigbee bridge devices
curl http://localhost:3003/devices
```

---

## 6) Step-by-Step zigbee2mqtt Setup (Detailed)

### 6.1. Install Mosquitto MQTT Broker

**Windows:**
1. Download from https://mosquitto.org/download/
2. Run installer (default path: `C:\Program Files\mosquitto`)
3. Open PowerShell as Admin:
```powershell
# Start Mosquitto service
net start mosquitto

# Verify it's running
mosquitto_sub -t "test/topic" -C 1 &
mosquitto_pub -t "test/topic" -m "hello"
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto

# Verify
mosquitto_pub -t "test" -m "hello"
mosquitto_sub -t "test" -C 1
```

**Verify port 1883 is open:**
```bash
# Windows
netstat -an | findstr 1883

# Linux
ss -tlnp | grep 1883
```

### 6.2. Install zigbee2mqtt

```bash
# Clone zigbee2mqtt
git clone https://github.com/Koenkk/zigbee2mqtt.git
cd zigbee2mqtt

# Install dependencies
npm ci

# Copy example config
cp data/configuration.yaml data/configuration.yaml.bak
```

### 6.3. Configure zigbee2mqtt

Edit `data/configuration.yaml`:

```yaml
# MQTT configuration
mqtt:
  # Mosquitto broker URL (local)
  base_topic: zigbee2mqtt
  server: 'mqtt://localhost:1883'
  # If Mosquitto requires auth:
  # user: mqtt_user
  # password: mqtt_password

# Serial port for Zigbee coordinator
serial:
  # Windows: check Device Manager for COM port
  port: COM3
  # Linux: usually /dev/ttyUSB0 or /dev/ttyACM0
  # port: /dev/ttyUSB0
  adapter: zstack

# Network settings
advanced:
  network_key: GENERATE  # auto-generate secure key
  pan_id: GENERATE
  channel: 15  # Zigbee channel (11, 15, 20, 25)
  log_level: info

# Allow new devices to join
permit_join: true

# Frontend (web UI)
frontend:
  port: 8081
  host: 0.0.0.0
```

**Finding your COM port (Windows):**
1. Open Device Manager (Win+X -> Device Manager)
2. Expand "Ports (COM & LPT)"
3. Look for "USB Serial Device (COMx)" or "SONOFF Zigbee 3.0 USB Dongle Plus (COMx)"
4. Note the COM number (e.g., COM3)

**Finding your serial port (Linux):**
```bash
ls -la /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
# Usually /dev/ttyUSB0 for SONOFF dongle
```

### 6.4. Start zigbee2mqtt

```bash
cd zigbee2mqtt
npm start
```

Expected output:
```
Zigbee2MQTT:info  Starting zigbee2mqtt version 1.x.x
Zigbee2MQTT:info  Starting zigbee-herdsman...
Zigbee2MQTT:info  zigbee-herdsman started
Zigbee2MQTT:info  Coordinator firmware version: '...'
Zigbee2MQTT:info  Permitting joins
```

### 6.5. MQTT Subscription Patterns

| Topic | Description | Example |
|-------|-------------|---------|
| `zigbee2mqtt/<friendly_name>` | Device state updates | `zigbee2mqtt/humidity_1` |
| `zigbee2mqtt/bridge/devices` | Full device list | JSON array of all devices |
| `zigbee2mqtt/bridge/event` | Bridge events (join, leave) | Device join/leave events |
| `zigbee2mqtt/<name>/set` | Send commands to device | `{"state": "OFF"}` |
| `zigbee2mqtt/bridge/request/permit_join` | Enable/disable pairing | `{"value": true}` |

**Debug: subscribe to ALL messages:**
```bash
mosquitto_sub -t "zigbee2mqtt/#" -v
```

---

## 7) Device Pairing Walkthrough

### 7.1. Put Device in Pairing Mode

**Smart Plug (e.g., SONOFF S31 Lite, IKEA TRADFRI):**
- Plug in the device
- Press and hold the button for 5+ seconds until LED flashes rapidly
- Device enters pairing mode for 60 seconds

**Humidity/Temperature Sensor (e.g., SONOFF SNZB-02, Aqara):**
- Insert battery (CR2032)
- Press and hold the reset button for 5 seconds until LED blinks
- Some sensors auto-pair on battery insertion

**Water Leak Sensor (e.g., SONOFF SNZB-05):**
- Insert battery
- Press reset button once
- LED flashes to indicate pairing mode

### 7.2. Watch for Join Event

In the zigbee2mqtt terminal, look for:
```
Zigbee2MQTT:info  Device '0x00158d0001234567' joined
Zigbee2MQTT:info  Interview started for '0x00158d0001234567'
Zigbee2MQTT:info  Device '0x00158d0001234567' is supported
```

### 7.3. Verify via MQTT

```bash
# Listen for device state
mosquitto_sub -t "zigbee2mqtt/0x00158d0001234567" -v

# You should see data like:
# zigbee2mqtt/0x00158d0001234567 {"humidity":55.2,"temperature":28.5,"battery":100}
```

### 7.4. Rename Device

```bash
# Rename to a friendly name
mosquitto_pub -t "zigbee2mqtt/bridge/request/device/rename" -m '{
  "from": "0x00158d0001234567",
  "to": "humidity_sensor_1"
}'

# Verify: state now publishes to new topic
mosquitto_sub -t "zigbee2mqtt/humidity_sensor_1" -v
```

---

## 8) Hardware Wiring & Placement

### 8.1. USB Coordinator Setup

```
[SONOFF Zigbee 3.0 USB Dongle Plus]
        |
        | USB cable (1-3m recommended)
        v
[PC / Raspberry Pi]
```

**Placement tips:**
- Place coordinator USB extender away from USB 3.0 ports (RF interference)
- Position at center of monitoring area for best coverage
- Line of sight to sensors is ideal

### 8.2. Sensor Placement for Fire Detection

| Sensor | Location | Why |
|--------|----------|-----|
| **Temperature** | Near electrical panel, outlets, or wiring | Detect wiring overheat at source |
| **Smart Plug** | On the circuit being monitored | Measure actual power draw |
| **Humidity** | Near moisture-prone areas (bathroom, basement) | Detect moisture + power combo risk |

### 8.3. Power Requirements

| Device | Power Source | Battery Life |
|--------|-------------|--------------|
| Zigbee Coordinator | USB (5V from PC) | N/A |
| Temperature Sensor | CR2032 coin battery | 1-2 years |
| Humidity Sensor | CR2032 or AAA | 1-2 years |
| Smart Plug | Mains (110/220V) | N/A (always on) |
| Water Leak Sensor | CR2032 | 1-2 years |

### 8.4. Range & Routers

- Zigbee range: ~10-20m indoors, ~30-50m outdoors
- For larger areas, add **Zigbee routers** (mains-powered devices that extend the mesh):
  - IKEA TRADFRI signal repeater
  - Any Zigbee smart plug (acts as router)
  - SONOFF Zigbee smart switch
- Routers automatically join the mesh — no configuration needed

---

## 9) Connecting Real Devices to the Dashboard

### 9.1. Start the Zigbee Bridge

```bash
cd F:\P2A-Althena\Matter-to-FIWARE-Monitoring-System\zigbee-bridge
npm install
npm start
```

Expected output:
```
[ZigbeeBridge] Connecting to MQTT broker at mqtt://localhost:1883
[ZigbeeBridge] MQTT connected
[ZigbeeBridge] Subscribed to zigbee2mqtt/+
[ZigbeeBridge] API on http://localhost:3003
```

Verify: `curl http://localhost:3003/health`

### 9.2. Verify Device Appears in Orion

```bash
# List all entities
curl http://localhost:1026/v2/entities | python -m json.tool

# Check specific device
curl http://localhost:1026/v2/entities/urn:ngsi-ld:ZigbeeDevice:humidity_sensor_1
```

Expected entity:
```json
{
  "id": "urn:ngsi-ld:ZigbeeDevice:humidity_sensor_1",
  "type": "HumiditySensor",
  "measuredValue": { "type": "Number", "value": 55.2 },
  "temperature": { "type": "Number", "value": 28.5 }
}
```

### 9.3. Verify Dashboard Shows Real Data

1. Open `http://localhost:8080`
2. Device cards should update with real sensor readings
3. Map markers should show device locations

### 9.4. Send Command to Real Device

```bash
# Turn off smart plug via Zigbee Bridge
curl -X POST http://localhost:3003/devices/YOUR_PLUG_NAME/control \
  -H "Content-Type: application/json" \
  -d '{"state": "OFF"}'

# Or via MCP Agent
curl -X POST http://localhost:3002/tools/invoke_command \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "urn:ngsi-ld:ZigbeeDevice:YOUR_PLUG", "action": "TURN_OFF", "reason": "Manual test"}'
```

---

## 10) Debugging Real Device Integration

| Problem | Cause | Solution |
|---------|-------|----------|
| **MQTT connection refused** | Mosquitto not running | Start: `net start mosquitto` (Windows) or `sudo systemctl start mosquitto` (Linux) |
| **MQTT port blocked** | Firewall blocking 1883 | Allow port: `netsh advfirewall firewall add rule name="MQTT" dir=in action=allow protocol=TCP localport=1883` |
| **Device won't pair** | Not in pairing mode or too far | Hold button 5s until LED flashes. Move device closer to coordinator. |
| **Device pairs but no data** | Wrong device type or unsupported model | Check zigbee2mqtt device page for your model. Update zigbee2mqtt to latest version. |
| **Device in zigbee2mqtt but NOT in Orion** | Zigbee bridge not running or MQTT URL wrong | Check `curl http://localhost:3003/health`. Verify MQTT_URL in zigbee-bridge/.env |
| **Device in Orion but NOT on dashboard** | Proxy not running or CORS issue | Check `curl http://localhost:3001/version`. Check browser console for errors. |
| **Power reading = 0** | Plug doesn't support energy monitoring | Verify plug model supports power metering (check zigbee2mqtt supported devices page) |
| **Coordinator not detected** | USB driver issue | Install CH340/CP210x driver. Try different USB port. Check Device Manager. |
| **zigbee2mqtt crashes on start** | Wrong adapter config | Set `adapter: zstack` for SONOFF, `adapter: deconz` for ConBee, `adapter: ezsp` for Sonoff ZBDongle-E |

### Debug Commands

```bash
# Check MQTT broker is running
mosquitto_pub -t "test" -m "ping"

# Monitor all Zigbee traffic
mosquitto_sub -t "zigbee2mqtt/#" -v

# Check Zigbee bridge health
curl http://localhost:3003/health

# List registered Zigbee devices
curl http://localhost:3003/devices

# Check Orion entities (all)
curl http://localhost:1026/v2/entities

# Check specific entity
curl http://localhost:1026/v2/entities/urn:ngsi-ld:ZigbeeDevice:humidity_sensor_1

# Check MCP Agent is receiving data
curl http://localhost:3002/risk?zone=A

# Check dashboard proxy
curl http://localhost:3001/v2/entities
```
