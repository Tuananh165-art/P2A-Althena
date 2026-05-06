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
