/**
 * Matter Controller
 * Interface để kết nối với Matter Emulators và lắng nghe sự kiện
 * Subscribe sự thay đổi và phát tín hiệu thay đổi
 */

const EventEmitter = require('events');
const { exec } = require('child_process');
const path = require('path');

class MatterController extends EventEmitter {
  constructor() {
    super();
    this.connectedDevices = new Map();
    this.isRunning = false;
  }

  /**
   * Khởi tạo kết nối với Matter Emulators
   * Lắng nghe sự kiện từ từng thiết bị
   */
  async initialize() {
    console.log('[MatterController] Khởi tạo kết nối với Matter Emulators...');

    try {
      // Trong thực tế, đây sẽ sử dụng matter.js để kết nối thực tế
      // Hiện tại, chúng tôi sẽ mô phỏng bằng cách follow stdout của child process

      // Khởi động matter-emulators process
      const matterEmulatorPath = path.join(__dirname, '../../matter-emulators');
      
      // Tuy nhiên, để đơn giản, chúng ta sẽ sử dụng một số lượng thiết bị giả lập trực tiếp

      this.registerDevice(1, 'HumiditySensor');
      this.registerDevice(2, 'SmartPlug');

      console.log('[MatterController] ✅ Kết nối thành công');
      this.isRunning = true;

      // Bắt đầu mô phỏng sự kiện từ các thiết bị
      this.startEventSimulation();

      return true;
    } catch (error) {
      console.error('[MatterController] ❌ Lỗi khởi tạo:', error.message);
      return false;
    }
  }

  /**
   * Đăng ký một thiết bị Matter
   */
  registerDevice(nodeId, deviceType) {
    const deviceKey = `${nodeId}`;
    this.connectedDevices.set(deviceKey, {
      nodeId,
      deviceType,
      lastUpdate: null
    });
    console.log(`[MatterController] 📍 Đăng ký thiết bị: ${deviceType} (NodeID: ${nodeId})`);
  }

  /**
   * Mô phỏng sự kiện từ Matter Emulators
   * Trong thực tế, đây sẽ là listener từ matter.js
   */
  startEventSimulation() {
    // Humidity Sensor: phát sự kiện mỗi 5 giây
    let humidityValue = 55;
    setInterval(() => {
      humidityValue += (Math.random() - 0.5) * 3;
      if (humidityValue > 100) humidityValue = 100;
      if (humidityValue < 30) humidityValue = 30;

      const event = {
        type: 'attribute_change',
        nodeId: 1,
        deviceType: 'HumiditySensor',
        endpointId: 1,
        clusterId: 0x0405,
        attributeName: 'measuredValue',
        attributeValue: Math.round(humidityValue * 100) / 100,
        timestamp: new Date().toISOString()
      };

      this.emit('device_event', event);
    }, 5000);

    // Smart Plug: phát sự kiện mỗi 3 giây
    let plugState = false;
    let powerValue = 0;
    setInterval(() => {
      if (Math.random() > 0.8) {
        plugState = !plugState;
      }

      const onOffEvent = {
        type: 'attribute_change',
        nodeId: 2,
        deviceType: 'SmartPlug',
        endpointId: 1,
        clusterId: 0x0006,
        attributeName: 'onOff',
        attributeValue: plugState,
        timestamp: new Date().toISOString()
      };

      this.emit('device_event', onOffEvent);

      if (plugState) {
        powerValue = Math.round(Math.random() * 950 + 50);
      } else {
        powerValue = 0;
      }

      const powerEvent = {
        type: 'attribute_change',
        nodeId: 2,
        deviceType: 'SmartPlug',
        endpointId: 1,
        clusterId: 0x0B04,
        attributeName: 'activePower',
        attributeValue: powerValue,
        timestamp: new Date().toISOString()
      };

      this.emit('device_event', powerEvent);
    }, 3000);

    console.log('[MatterController] ✅ Bắt đầu phát tín hiệu từ thiết bị');
  }

  /**
   * Lấy danh sách các thiết bị đang kết nối
   */
  getConnectedDevices() {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Lấy Device Type từ NodeID
   */
  getDeviceTypeByNodeId(nodeId) {
    const device = this.connectedDevices.get(String(nodeId));
    return device ? device.deviceType : 'Device';
  }

  /**
   * Tìm kiếm thiết bị theo NodeID
   */
  getDeviceByNodeId(nodeId) {
    return this.connectedDevices.get(String(nodeId));
  }

  /**
   * Ngừng kết nối
   */
  disconnect() {
    this.isRunning = false;
    console.log('[MatterController] 🛑 Ngắt kết nối');
  }
}

module.exports = MatterController;
