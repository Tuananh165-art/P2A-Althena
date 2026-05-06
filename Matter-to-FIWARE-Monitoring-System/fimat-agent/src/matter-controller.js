/**
 * Matter Controller
 * Connects to Matter Emulators via shared device classes.
 * In production this would use matter.js protocol; for MVP it
 * instantiates the emulator classes directly (in-process bridge).
 */

const EventEmitter = require('events');
const path = require('path');

class MatterController extends EventEmitter {
  constructor() {
    super();
    this.connectedDevices = new Map();
    this.emulators = [];
    this.isRunning = false;
  }

  async initialize() {
    console.log('[MatterController] Initializing connection to Matter Emulators...');

    try {
      // Import emulator classes from matter-emulators directory
      const emulatorsPath = path.join(__dirname, '../../matter-emulators');
      const HumiditySensorEmulator = require(path.join(emulatorsPath, 'humidity-sensor'));
      const SmartPlugEmulator = require(path.join(emulatorsPath, 'smart-plug'));
      const TemperatureSensorEmulator = require(path.join(emulatorsPath, 'temperature-sensor'));

      // Create emulator instances
      const humiditySensor = new HumiditySensorEmulator({
        nodeId: 1,
        endpointId: 1,
        initialHumidity: 50,
        interval: 5000
      });

      const smartPlug = new SmartPlugEmulator({
        nodeId: 2,
        endpointId: 1,
        initialState: false,
        interval: 3000
      });

      const temperatureSensor = new TemperatureSensorEmulator({
        nodeId: 3,
        endpointId: 1,
        initialTemperature: 30,
        interval: 5000
      });

      // Bridge emulator events -> MatterController device_event
      humiditySensor.on('data_change', (event) => {
        this.emit('device_event', { ...event, deviceType: 'HumiditySensor' });
      });

      humiditySensor.on('flood_alert', (alert) => {
        console.log(`[MatterController] FLOOD ALERT: ${alert.message}`);
      });

      smartPlug.on('data_change', (event) => {
        this.emit('device_event', { ...event, deviceType: 'SmartPlug' });
      });

      temperatureSensor.on('data_change', (event) => {
        this.emit('device_event', { ...event, deviceType: 'TemperatureSensor' });
      });

      temperatureSensor.on('overheat_alert', (alert) => {
        console.log(`[MatterController] FIRE RISK: ${alert.message}`);
      });

      // Register devices
      this.registerDevice(1, 'HumiditySensor');
      this.registerDevice(2, 'SmartPlug');
      this.registerDevice(3, 'TemperatureSensor');

      // Start emulators
      humiditySensor.start();
      smartPlug.start();
      temperatureSensor.start();
      this.emulators.push(humiditySensor, smartPlug, temperatureSensor);

      this.isRunning = true;
      console.log('[MatterController] Connected to emulators');
      return true;
    } catch (error) {
      console.error('[MatterController] Initialization failed:', error.message);
      // Fallback: run internal simulation if emulators not available
      console.log('[MatterController] Falling back to internal simulation');
      this.registerDevice(1, 'HumiditySensor');
      this.registerDevice(2, 'SmartPlug');
      this.registerDevice(3, 'TemperatureSensor');
      this.startEventSimulation();
      this.isRunning = true;
      return true;
    }
  }

  registerDevice(nodeId, deviceType) {
    this.connectedDevices.set(String(nodeId), {
      nodeId,
      deviceType,
      lastUpdate: null
    });
    console.log(`[MatterController] Registered: ${deviceType} (NodeID: ${nodeId})`);
  }

  startEventSimulation() {
    let humidityValue = 55;
    setInterval(() => {
      humidityValue += (Math.random() - 0.5) * 3;
      humidityValue = Math.max(30, Math.min(100, humidityValue));
      this.emit('device_event', {
        type: 'attribute_change', nodeId: 1, deviceType: 'HumiditySensor',
        endpointId: 1, clusterId: 0x0405,
        attributeName: 'measuredValue',
        attributeValue: Math.round(humidityValue * 100) / 100,
        timestamp: new Date().toISOString()
      });
    }, 5000);

    let plugState = false;
    setInterval(() => {
      if (Math.random() > 0.8) plugState = !plugState;
      this.emit('device_event', {
        type: 'attribute_change', nodeId: 2, deviceType: 'SmartPlug',
        endpointId: 1, clusterId: 0x0006,
        attributeName: 'onOff', attributeValue: plugState,
        timestamp: new Date().toISOString()
      });
      const power = plugState ? Math.round(Math.random() * 950 + 50) : 0;
      this.emit('device_event', {
        type: 'attribute_change', nodeId: 2, deviceType: 'SmartPlug',
        endpointId: 1, clusterId: 0x0B04,
        attributeName: 'activePower', attributeValue: power,
        timestamp: new Date().toISOString()
      });
    }, 3000);

    let tempValue = 30;
    setInterval(() => {
      tempValue += (Math.random() - 0.45) * 3;
      tempValue = Math.max(20, Math.min(65, tempValue));
      this.emit('device_event', {
        type: 'attribute_change', nodeId: 3, deviceType: 'TemperatureSensor',
        endpointId: 1, clusterId: 0x0402,
        attributeName: 'temperature',
        attributeValue: Math.round(tempValue * 10) / 10,
        unit: '°C',
        timestamp: new Date().toISOString()
      });
    }, 5000);

    console.log('[MatterController] Internal simulation started');
  }

  getConnectedDevices() {
    return Array.from(this.connectedDevices.values());
  }

  getDeviceTypeByNodeId(nodeId) {
    const device = this.connectedDevices.get(String(nodeId));
    return device ? device.deviceType : 'Device';
  }

  disconnect() {
    this.isRunning = false;
    console.log('[MatterController] Disconnected');
  }
}

module.exports = MatterController;
