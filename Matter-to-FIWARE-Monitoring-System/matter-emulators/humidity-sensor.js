/**
 * Humidity Sensor Emulator
 * Giả lập cảm biến độ ẩm - phát sự kiện định kỳ
 * Định dạng: Matter Humidity Measurement Cluster
 */

const net = require('net');
const EventEmitter = require('events');

class HumiditySensorEmulator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.nodeId = config.nodeId || 1;
    this.endpointId = config.endpointId || 1;
    this.clusterId = 0x0405; // Humidity Measurement Cluster
    this.humidity = config.initialHumidity || 50;
    this.interval = config.interval || 5000;
    this.humidityKey = 'measuredValue'; // NGSI Attribute name
  }

  start() {
    console.log(`[HumiditySensor] Khởi động cảm biến độ ẩm (NodeID: ${this.nodeId})`);
    
    // Giả lập sự thay đổi độ ẩm
    this.startSimulation();
  }

  startSimulation() {
    // Phát tín hiệu định kỳ - độ ẩm tăng từ 50% đến 95% (mô phỏng tình huống ngập)
    setInterval(() => {
      this.humidity += Math.random() * 5;
      
      // Cap mức độ ẩm từ 0-100
      if (this.humidity > 100) this.humidity = 100;
      if (this.humidity < 30) this.humidity = 30;

      const event = {
        type: 'attribute_change',
        nodeId: this.nodeId,
        endpointId: this.endpointId,
        clusterId: this.clusterId,
        attributeName: this.humidityKey,
        attributeValue: Math.round(this.humidity * 100) / 100,
        timestamp: new Date().toISOString()
      };

      console.log(`[HumiditySensor] Sự kiện phát hành:`, JSON.stringify(event, null, 2));
      this.emit('data_change', event);
    }, this.interval);
  }

  // Phương thức kích hoạt sự cố (Simulate flood)
  simulateFlood() {
    console.log('[HumiditySensor] ⚠️ Kích hoạt mô phỏng sự cố: NGẬP LỤT');
    this.humidity = 95;
    this.emit('flood_alert', {
      type: 'alert',
      severity: 'high',
      message: 'Humidity exceeds 90% - Flood detected!',
      timestamp: new Date().toISOString()
    });
  }

  getStatus() {
    return {
      nodeId: this.nodeId,
      endpointId: this.endpointId,
      sensorType: 'HumiditySensor',
      currentHumidity: this.humidity,
      unit: '%RH'
    };
  }
}

module.exports = HumiditySensorEmulator;

// Nếu chạy trực tiếp
if (require.main === module) {
  const sensor = new HumiditySensorEmulator({ nodeId: 1, endpointId: 1 });
  
  sensor.on('data_change', (event) => {
    // Log mỗi sự thay đổi
  });

  sensor.on('flood_alert', (alert) => {
    console.log('\n🚨 CẢNH BÁO:', alert.message, '\n');
  });

  sensor.start();

  // Mô phỏng kích hoạt sự cố sau 30 giây
  setTimeout(() => {
    sensor.simulateFlood();
  }, 30000);
}
