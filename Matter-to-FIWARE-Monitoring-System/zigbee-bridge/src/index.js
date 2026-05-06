/**
 * Zigbee Bridge
 * Connects to zigbee2mqtt via MQTT, translates Zigbee device states
 * to NGSI-v2 entities in FIWARE Orion.
 *
 * Architecture:
 *   Zigbee Device -> zigbee2mqtt -> MQTT -> THIS BRIDGE -> Orion
 *
 * Also supports sending commands back to devices:
 *   MCP Agent -> THIS BRIDGE -> MQTT -> zigbee2mqtt -> Zigbee Device
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const mqtt = require('mqtt');
const config = require('../config');
const OrionClient = require('./orion-client');
const DeviceRegistry = require('./device-registry');
const ZigbeeAdapter = require('./zigbee-adapter');

class ZigbeeBridge {
  constructor() {
    this.orion = new OrionClient();
    this.registry = new DeviceRegistry();
    this.adapter = new ZigbeeAdapter(this.registry);
    this.mqttClient = null;
    this.connected = false;
    this.messageCount = 0;
  }

  async start() {
    console.log('[ZigbeeBridge] Starting...');
    console.log(`[ZigbeeBridge] MQTT: ${config.mqtt.url}`);
    console.log(`[ZigbeeBridge] Orion: ${config.orion.baseUrl()}`);

    // Check Orion
    const health = await this.orion.checkHealth();
    if (health) {
      console.log(`[ZigbeeBridge] Orion connected (v${health.orion?.version || '?'})`);
    } else {
      console.warn('[ZigbeeBridge] Orion not available - will retry on publish');
    }

    // Connect to MQTT
    this.connectMQTT();
  }

  connectMQTT() {
    const baseTopic = config.mqtt.baseTopic;

    console.log(`[ZigbeeBridge] Connecting to MQTT: ${config.mqtt.url}`);

    this.mqttClient = mqtt.connect(config.mqtt.url, {
      clientId: `zigbee-bridge-${Date.now()}`,
      reconnectPeriod: 5000
    });

    this.mqttClient.on('connect', () => {
      this.connected = true;
      console.log('[ZigbeeBridge] MQTT connected');

      // Subscribe to all zigbee2mqtt topics
      this.mqttClient.subscribe(`${baseTopic}/+`, (err) => {
        if (err) console.error('[ZigbeeBridge] Subscribe error:', err.message);
        else console.log(`[ZigbeeBridge] Subscribed to ${baseTopic}/+`);
      });

      // Subscribe to bridge topics
      this.mqttClient.subscribe(`${baseTopic}/bridge/+`, (err) => {
        if (err) console.error('[ZigbeeBridge] Subscribe error:', err.message);
        else console.log(`[ZigbeeBridge] Subscribed to ${baseTopic}/bridge/+`);
      });
    });

    this.mqttClient.on('message', (topic, payload) => {
      this.handleMessage(topic, payload);
    });

    this.mqttClient.on('error', (err) => {
      console.error('[ZigbeeBridge] MQTT error:', err.message);
    });

    this.mqttClient.on('offline', () => {
      this.connected = false;
      console.warn('[ZigbeeBridge] MQTT offline');
    });

    this.mqttClient.on('reconnect', () => {
      console.log('[ZigbeeBridge] MQTT reconnecting...');
    });
  }

  async handleMessage(topic, payload) {
    const baseTopic = config.mqtt.baseTopic;
    const relative = topic.replace(`${baseTopic}/`, '');

    try {
      const data = JSON.parse(payload.toString());

      // Device list from bridge
      if (relative === 'bridge/devices') {
        console.log(`[ZigbeeBridge] Received device list: ${data.length} devices`);
        this.adapter.processDeviceList(data);
        return;
      }

      // Bridge event (device join/leave)
      if (relative.startsWith('bridge/event')) {
        console.log(`[ZigbeeBridge] Bridge event: ${data.type || 'unknown'}`);
        return;
      }

      // Bridge state
      if (relative === 'bridge/state') {
        console.log(`[ZigbeeBridge] Bridge state: ${data.state}`);
        return;
      }

      // Skip bridge info topics
      if (relative.startsWith('bridge/')) return;

      // Device state message
      const friendlyName = relative;
      this.messageCount++;

      const ngsiData = this.adapter.processStateMessage(friendlyName, data);
      if (!ngsiData) {
        console.log(`[ZigbeeBridge] Skipped unmapped device: ${friendlyName}`);
        return;
      }

      console.log(`[ZigbeeBridge] ${friendlyName} -> ${ngsiData.type} (${Object.keys(ngsiData.attrs).join(', ')})`);

      // Upsert to Orion
      await this.orion.upsertEntity(ngsiData.entityId, ngsiData.type, ngsiData.attrs);

    } catch (e) {
      // Not JSON or parse error - skip
      if (e instanceof SyntaxError) return;
      console.error(`[ZigbeeBridge] Error processing ${topic}: ${e.message}`);
    }
  }

  /**
   * Send a command to a Zigbee device via MQTT
   */
  sendCommand(friendlyName, payload) {
    if (!this.connected || !this.mqttClient) {
      throw new Error('MQTT not connected');
    }

    const topic = `${config.mqtt.baseTopic}/${friendlyName}/set`;
    this.mqttClient.publish(topic, JSON.stringify(payload));
    console.log(`[ZigbeeBridge] Command sent: ${friendlyName} -> ${JSON.stringify(payload)}`);
    return { status: 'sent', topic, payload };
  }

  getStatus() {
    return {
      mqttConnected: this.connected,
      devicesRegistered: this.registry.getAll().length,
      messagesProcessed: this.messageCount,
      devices: this.registry.getAll().map(d => ({
        name: d.friendlyName,
        type: d.deviceType,
        lastSeen: d.lastSeen
      }))
    };
  }
}

// Main
if (require.main === module) {
  const bridge = new ZigbeeBridge();
  const app = express();
  app.use(express.json());

  // CORS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', ...bridge.getStatus() });
  });

  app.get('/devices', (req, res) => {
    res.json(bridge.registry.getAll());
  });

  // Send command to Zigbee device
  app.post('/command', (req, res) => {
    try {
      const { device, payload } = req.body;
      const result = bridge.sendCommand(device, payload);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Proxy endpoint for MCP agent to control Zigbee devices
  app.post('/devices/:name/control', (req, res) => {
    try {
      const { name } = req.params;
      const result = bridge.sendCommand(name, req.body);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  const PORT = process.env.ZIGBEE_BRIDGE_PORT || 3003;
  app.listen(PORT, () => {
    console.log(`[ZigbeeBridge] API on http://localhost:${PORT}`);
    bridge.start();
  });

  process.on('SIGINT', () => {
    console.log('\n[ZigbeeBridge] Shutting down...');
    if (bridge.mqttClient) bridge.mqttClient.end();
    process.exit(0);
  });
}

module.exports = ZigbeeBridge;
