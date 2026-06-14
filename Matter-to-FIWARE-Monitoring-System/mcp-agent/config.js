module.exports = {
  orion: {
    host: process.env.ORION_HOST || 'localhost',
    port: process.env.ORION_PORT || 1026,
    baseUrl: () => `http://${module.exports.orion.host}:${module.exports.orion.port}`
  },
  agent: {
    port: process.env.MCP_PORT || 3002,
    pollInterval: parseInt(process.env.MCP_POLL_INTERVAL) || 5000
  },
  fimat: {
    host: process.env.FIMAT_HOST || 'localhost',
    port: process.env.FIMAT_PORT || 3000,
    baseUrl: () => `http://${module.exports.fimat.host}:${module.exports.fimat.port}`
  },
  zigbee: {
    host: process.env.ZIGBEE_BRIDGE_HOST || 'localhost',
    port: process.env.ZIGBEE_BRIDGE_PORT || 3003,
    baseUrl: () => `http://${module.exports.zigbee.host}:${module.exports.zigbee.port}`
  },
  control: {
    mode: process.env.DEVICE_CONTROL_MODE || 'live',
    confirmationTimeoutMs: parseInt(process.env.DEVICE_CONFIRMATION_TIMEOUT_MS) || 8000,
    confirmationPollMs: parseInt(process.env.DEVICE_CONFIRMATION_POLL_MS) || 400
  },
  risk: {
    thresholds: {
      humidity: { warning: 75, critical: 90 },
      activePower: { warning: 800, critical: 950 },
      temperature: { warning: 40, critical: 50 }
    },
    cooldownMs: parseInt(process.env.RISK_COOLDOWN_MS) || 30000
  },
  ai: {
    endpoint: process.env.AI_ENDPOINT || '',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4o-mini'
  }
};
