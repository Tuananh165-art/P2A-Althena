/**
 * Temperature Sensor Emulator
 * Giả lập cảm biến nhiệt độ - phát hiện quá tải/nóng cục bộ
 * Định dạng: Matter Temperature Measurement Cluster (0x0402)
 * Ứng dụng: Phát hiện rủi ro chập cháy do nắng nóng cực đoan
 */

const EventEmitter = require('events');

class TemperatureSensorEmulator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.nodeId = config.nodeId || 3;
    this.endpointId = config.endpointId || 1;
    this.clusterId = 0x0402; // Temperature Measurement Cluster
    this.temperature = config.initialTemperature || 30; // °C
    this.interval = config.interval || 5000;
    this.attrName = 'temperature';
    this.manualOverrideUntil = 0;
    this.overheatThreshold = config.overheatThreshold || 50; // °C
  }

  start() {
    console.log(`[TemperatureSensor] Khởi động cảm biến nhiệt độ (NodeID: ${this.nodeId})`);
    this.startSimulation();
  }

  startSimulation() {
    setInterval(() => {
      // Random walk nhiệt độ, bias tăng nhẹ (mô phỏng nắng nóng)
      if (Date.now() > this.manualOverrideUntil) {
        this.temperature += (Math.random() - 0.45) * 3;
      }
      if (this.temperature > 65) this.temperature = 65;
      if (this.temperature < 20) this.temperature = 20;
      this.temperature = Math.round(this.temperature * 10) / 10;

      const event = {
        type: 'attribute_change',
        nodeId: this.nodeId,
        endpointId: this.endpointId,
        clusterId: this.clusterId,
        attributeName: this.attrName,
        attributeValue: this.temperature,
        unit: '°C',
        timestamp: new Date().toISOString()
      };

      this.emit('data_change', event);

      // Overheat alert
      if (this.temperature >= this.overheatThreshold) {
        this.emit('overheat_alert', {
          type: 'alert',
          severity: 'critical',
          message: `Temperature ${this.temperature}°C — electrical fire risk!`,
          timestamp: new Date().toISOString()
        });
      }
    }, this.interval);
  }

  simulateOverheat() {
    console.log('[TemperatureSensor] ⚠️ Kích hoạt mô phỏng: QUÁ TẢI NHIỆT');
    this.temperature = 55;
    this.emit('overheat_alert', {
      type: 'alert',
      severity: 'critical',
      message: `Temperature ${this.temperature}°C — critical electrical fire risk from heat wave overload!`,
      timestamp: new Date().toISOString()
    });
  }

  setTemperature(value, options = {}) {
    this.temperature = Math.max(20, Math.min(65, Number(value)));
    this.manualOverrideUntil = Date.now() + (options.holdMs || 60000);
    this.temperature = Math.round(this.temperature * 10) / 10;
    const event = {
      type: 'attribute_change',
      nodeId: this.nodeId,
      endpointId: this.endpointId,
      clusterId: this.clusterId,
      attributeName: this.attrName,
      attributeValue: this.temperature,
      unit: 'degC',
      timestamp: new Date().toISOString()
    };
    this.emit('data_change', event);
    if (this.temperature >= this.overheatThreshold) {
      this.emit('overheat_alert', {
        type: 'alert',
        severity: 'critical',
        message: `Temperature ${this.temperature} degC - electrical fire risk!`,
        timestamp: new Date().toISOString()
      });
    }
    return this.getStatus();
  }

  getStatus() {
    return {
      nodeId: this.nodeId,
      endpointId: this.endpointId,
      sensorType: 'TemperatureSensor',
      temperature: this.temperature,
      unit: '°C'
    };
  }
}

module.exports = TemperatureSensorEmulator;

if (require.main === module) {
  const sensor = new TemperatureSensorEmulator({ nodeId: 3, endpointId: 1 });

  sensor.on('data_change', (event) => {
    console.log(`🌡️ [TEMP] ${event.attributeValue}°C`);
  });

  sensor.on('overheat_alert', (alert) => {
    console.log(`\n🚨 [ALERT] ${alert.message}\n`);
  });

  sensor.start();

  setTimeout(() => {
    sensor.simulateOverheat();
  }, 30000);
}
