/**
 * Index.js - Khởi động tất cả Matter Emulators
 * Climate Resilience: giám sát nhiệt độ, độ ẩm, điện năng để phát hiện chập cháy
 */

const HumiditySensorEmulator = require('./humidity-sensor');
const SmartPlugEmulator = require('./smart-plug');
const TemperatureSensorEmulator = require('./temperature-sensor');

console.log('🚀 Khởi động Climate Resilience IoT Emulators...\n');

// Cảm biến độ ẩm (NodeID: 1) - phát hiện nguy cơ ngập/ẩm
const humiditySensor = new HumiditySensorEmulator({
  nodeId: 1,
  endpointId: 1,
  initialHumidity: 50,
  interval: 5000
});

// Ổ cắm thông minh (NodeID: 2) - giám sát điện năng/tải
const smartPlug = new SmartPlugEmulator({
  nodeId: 2,
  endpointId: 1,
  initialState: false,
  interval: 3000
});

// Cảm biến nhiệt độ (NodeID: 3) - phát hiện quá tải nhiệt/chập cháy
const temperatureSensor = new TemperatureSensorEmulator({
  nodeId: 3,
  endpointId: 1,
  initialTemperature: 30,
  interval: 5000
});

// Lắng nghe sự kiện từ cảm biến độ ẩm
humiditySensor.on('data_change', (event) => {
  console.log(`💧 [HUMIDITY] ${event.attributeValue}%`);
});

humiditySensor.on('flood_alert', (alert) => {
  console.log(`\n🚨 [FLOOD ALERT] ${alert.message}\n`);
});

// Lắng nghe sự kiện từ ổ cắm thông minh
smartPlug.on('data_change', (event) => {
  if (event.attributeName === 'onOff') {
    console.log(`💡 [PLUG] Status: ${event.attributeValue ? 'ON' : 'OFF'}`);
  } else if (event.attributeName === 'activePower') {
    console.log(`⚡ [PLUG] Power: ${event.attributeValue}W`);
  }
});

// Lắng nghe sự kiện từ cảm biến nhiệt độ
temperatureSensor.on('data_change', (event) => {
  const temp = event.attributeValue;
  const icon = temp >= 50 ? '🔴' : temp >= 40 ? '🟡' : '🟢';
  console.log(`${icon} [TEMP] ${temp}°C`);
});

temperatureSensor.on('overheat_alert', (alert) => {
  console.log(`\n🚨 [FIRE RISK] ${alert.message}\n`);
});

// Khởi động tất cả thiết bị
humiditySensor.start();
smartPlug.start();
temperatureSensor.start();

console.log('\n✅ Tất cả cảm biến đã khởi động.');
console.log('📍 Humidity Sensor (NodeID: 1) — giám sát nguy cơ ngập');
console.log('📍 Smart Plug (NodeID: 2) — giám sát tải điện');
console.log('📍 Temperature Sensor (NodeID: 3) — giám sát quá tải nhiệt');
console.log('\nĐang phát tín hiệu realtime...\n');

process.on('SIGINT', () => {
  console.log('\n\n🛑 Dừng Climate Resilience Emulators');
  process.exit(0);
});
