module.exports = {
  mqtt: {
    url: process.env.MQTT_URL || 'mqtt://localhost:1883',
    baseTopic: process.env.Z2M_BASE_TOPIC || 'zigbee2mqtt'
  },
  orion: {
    host: process.env.ORION_HOST || 'localhost',
    port: process.env.ORION_PORT || 1026,
    baseUrl: () => `http://${module.exports.orion.host}:${module.exports.orion.port}`
  },
  mcp: {
    host: process.env.MCP_HOST || 'localhost',
    port: process.env.MCP_PORT || 3002,
    baseUrl: () => `http://${module.exports.mcp.host}:${module.exports.mcp.port}`
  },
  // Map Zigbee device types to NGSI entity types
  deviceMap: {
    'humidity': { type: 'HumiditySensor', attrs: { humidity: 'measuredValue' } },
    'temperature_humidity': { type: 'HumiditySensor', attrs: { humidity: 'measuredValue' } },
    'smart_plug': { type: 'SmartPlug', attrs: { state: 'onOff', power: 'activePower' } },
    'light': { type: 'AlertLamp', attrs: { state: 'onOff', brightness: 'brightness' } },
    'occupancy': { type: 'MotionSensor', attrs: { occupancy: 'detected' } },
    'water_leak': { type: 'WaterLeakSensor', attrs: { water_leak: 'detected' } }
  }
};
