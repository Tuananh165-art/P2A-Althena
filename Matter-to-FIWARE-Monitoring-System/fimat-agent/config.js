/**
 * Config.js
 * Cấu hình giá trị IP/Port cho các services
 */

module.exports = {
  // FIWARE Orion Context Broker
  orion: {
    host: process.env.ORION_HOST || 'localhost',
    port: process.env.ORION_PORT || 1026,
    baseUrl: () => `http://${module.exports.orion.host}:${module.exports.orion.port}`
  },

  // Matter Emulators
  matterEmulators: {
    humidityHost: process.env.HUMIDITY_HOST || 'localhost',
    humidityPort: process.env.HUMIDITY_PORT || 4001,
    plugHost: process.env.PLUG_HOST || 'localhost',
    plugPort: process.env.PLUG_PORT || 4002
  },

  // FIMAT Agent
  agent: {
    port: process.env.AGENT_PORT || 3000,
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Mapping chuẩn Matter sang NGSI-v2
  matterToNGSI: {
    // Humidity Measurement Cluster (0x0405)
    'measuredValue': {
      type: 'Number',
      unit: '%RH'
    },
    // On/Off Cluster (0x0006)
    'onOff': {
      type: 'Boolean'
    },
    // Electrical Measurement Cluster (0x0B04)
    'activePower': {
      type: 'Number',
      unit: 'W'
    },
    'apparentPower': {
      type: 'Number',
      unit: 'VA'
    },
    'reactivePower': {
      type: 'Number',
      unit: 'VAr'
    }
  }
};
