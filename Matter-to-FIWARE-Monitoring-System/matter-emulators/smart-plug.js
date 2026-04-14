/**
 * Smart Plug Emulator
 * Giả lập ổ cắm thông minh - giám sát điện năng
 * Định dạng: Matter On/Off Switch Cluster + Electrical Measurement
 */

const EventEmitter = require('events');

class SmartPlugEmulator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.nodeId = config.nodeId || 2;
    this.endpointId = config.endpointId || 1;
    this.onOffClusterId = 0x0006; // On/Off Cluster
    this.electricalClusterId = 0x0B04; // Electrical Measurement Cluster
    this.onOff = config.initialState || false;
    this.power = config.initialPower || 0;
    this.interval = config.interval || 3000;
  }

  start() {
    console.log(`[SmartPlug] Khởi động ổ cắm thông minh (NodeID: ${this.nodeId})`);
    this.startSimulation();
  }

  startSimulation() {
    // Phát sự kiện thay đổi trạng thái và công suất định kỳ
    setInterval(() => {
      // Ngẫu nhiên bật/tắt hoặc đổi công suất
      if (Math.random() > 0.7) {
        this.onOff = !this.onOff;
      }

      // Nếu đang bật, công suất ngẫu nhiên từ 50-1000W
      this.power = this.onOff ? Math.round(Math.random() * 950 + 50) : 0;

      const events = [
        {
          type: 'attribute_change',
          nodeId: this.nodeId,
          endpointId: this.endpointId,
          clusterId: this.onOffClusterId,
          attributeName: 'onOff',
          attributeValue: this.onOff,
          timestamp: new Date().toISOString()
        },
        {
          type: 'attribute_change',
          nodeId: this.nodeId,
          endpointId: this.endpointId,
          clusterId: this.electricalClusterId,
          attributeName: 'activePower',
          attributeValue: this.power,
          unit: 'W',
          timestamp: new Date().toISOString()
        }
      ];

      events.forEach(event => {
        console.log(`[SmartPlug] Sự kiện phát hành:`, JSON.stringify(event, null, 2));
        this.emit('data_change', event);
      });
    }, this.interval);
  }

  // Bật/tắt ổ cắm
  toggle() {
    this.onOff = !this.onOff;
    console.log(`[SmartPlug] Trạng thái ổ cắm: ${this.onOff ? 'BẬT' : 'TẮT'}`);
    this.power = this.onOff ? 500 : 0;
    
    this.emit('data_change', {
      type: 'attribute_change',
      nodeId: this.nodeId,
      endpointId: this.endpointId,
      clusterId: this.onOffClusterId,
      attributeName: 'onOff',
      attributeValue: this.onOff,
      timestamp: new Date().toISOString()
    });
  }

  getStatus() {
    return {
      nodeId: this.nodeId,
      endpointId: this.endpointId,
      sensorType: 'SmartPlug',
      onOff: this.onOff,
      activePower: this.power,
      unit: 'W'
    };
  }
}

module.exports = SmartPlugEmulator;

// Nếu chạy trực tiếp
if (require.main === module) {
  const plug = new SmartPlugEmulator({ nodeId: 2, endpointId: 1 });
  
  plug.on('data_change', (event) => {
    // Log mỗi sự thay đổi
  });

  plug.start();

  // Mô phỏng toggle sau 45 giây
  setTimeout(() => {
    plug.toggle();
  }, 45000);
}
