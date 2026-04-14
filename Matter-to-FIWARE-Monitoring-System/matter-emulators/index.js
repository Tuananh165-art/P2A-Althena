/**
 * Index.js - Khởi động tất cả Matter Emulators
 */

const HumiditySensorEmulator = require('./humidity-sensor');
const SmartPlugEmulator = require('./smart-plug');

console.log('🚀 Khởi động Matter Device Emulators...\n');

// Khởi tạo các thiết bị
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

// Lắng nghe sự kiện từ cảm biến độ ẩm
humiditySensor.on('data_change', (event) => {
  console.log(`📊 [HUMIDITY EVENT] ${event.attributeName}: ${event.attributeValue}%`);
});

humiditySensor.on('flood_alert', (alert) => {
  console.log(`\n🚨 [ALERT] ${alert.message}\n`);
});

// Lắng nghe sự kiện từ ổ cắm thông minh
smartPlug.on('data_change', (event) => {
  if (event.attributeName === 'onOff') {
    console.log(`💡 [PLUG EVENT] Status: ${event.attributeValue ? 'ON' : 'OFF'}`);
  } else if (event.attributeName === 'activePower') {
    console.log(`⚡ [PLUG EVENT] Power: ${event.attributeValue}W`);
  }
});

// Khởi động thiết bị
humiditySensor.start();
smartPlug.start();

console.log('\n✅ Tất cả thiết bị đã khởi động.');
console.log('📍 Humidity Sensor (NodeID: 1)');
console.log('📍 Smart Plug (NodeID: 2)');
console.log('\nĐang phát tín hiệu...\n');

// Giữ lại tiến trình chạy
process.on('SIGINT', () => {
  console.log('\n\n🛑 Dừng Matter Emulators');
  process.exit(0);
});
