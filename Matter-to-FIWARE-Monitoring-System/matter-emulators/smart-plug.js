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
    this.manualOverrideUntil = 0;
    this.randomToggle = config.randomToggle === true;
    this.randomToggleChance = config.randomToggleChance ?? 0.03;
    this.minRandomToggleIntervalMs = config.minRandomToggleIntervalMs ?? 60000;
    this.lastRandomToggleAt = Date.now();
    this.powerRange = config.powerRange || { min: 80, max: 650 };
  }

  start() {
    console.log(`[SmartPlug] Khởi động ổ cắm thông minh (NodeID: ${this.nodeId})`);
    this.startSimulation();
  }

  startSimulation() {
    // Phát sự kiện thay đổi trạng thái và công suất định kỳ
    setInterval(() => {
      const now = Date.now();
      // Ngẫu nhiên bật/tắt hoặc đổi công suất
      // Keep demo state stable by default. Commands/scenarios should own ON/OFF.
      this.maybeRandomToggle(now);

      // Nếu đang bật, công suất ngẫu nhiên từ 50-1000W
      if (now > this.manualOverrideUntil) {
        this.power = this.onOff ? this.randomPowerDraw() : 0;
      }

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
  maybeRandomToggle(now = Date.now()) {
    const commandHoldDone = now > this.manualOverrideUntil;
    const cooldownDone = now - this.lastRandomToggleAt >= this.minRandomToggleIntervalMs;
    if (!this.randomToggle || !commandHoldDone || !cooldownDone) return false;
    if (Math.random() >= this.randomToggleChance) return false;

    this.onOff = !this.onOff;
    this.lastRandomToggleAt = now;
    console.log(`[SmartPlug] Random user-like toggle: ${this.onOff ? 'ON' : 'OFF'}`);
    return true;
  }

  randomPowerDraw() {
    const min = this.powerRange.min ?? 80;
    const max = this.powerRange.max ?? 650;
    return Math.round(Math.random() * (max - min) + min);
  }

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

  setOnOff(value, options = {}) {
    this.onOff = Boolean(value);
    this.manualOverrideUntil = Date.now() + (options.holdMs || 30000);
    console.log(`[SmartPlug] State: ${this.onOff ? 'ON' : 'OFF'}`);
    this.power = this.onOff ? (options.power || 500) : 0;

    const timestamp = new Date().toISOString();
    this.emit('data_change', {
      type: 'attribute_change',
      nodeId: this.nodeId,
      endpointId: this.endpointId,
      clusterId: this.onOffClusterId,
      attributeName: 'onOff',
      attributeValue: this.onOff,
      timestamp
    });
    this.emit('data_change', {
      type: 'attribute_change',
      nodeId: this.nodeId,
      endpointId: this.endpointId,
      clusterId: this.electricalClusterId,
      attributeName: 'activePower',
      attributeValue: this.power,
      unit: 'W',
      timestamp
    });
    return this.getStatus();
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
