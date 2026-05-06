module.exports = {
  gateway: {
    port: parseInt(process.env.OPENCLAW_PORT) || 3004
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedChatIds: process.env.TELEGRAM_ALLOWED_CHAT_IDS
      ? process.env.TELEGRAM_ALLOWED_CHAT_IDS.split(',').map(id => id.trim())
      : []
  },
  mcp: {
    url: process.env.MCP_URL || 'http://localhost:3002'
  },
  orion: {
    url: process.env.ORION_URL || 'http://localhost:1026'
  },
  zigbee: {
    url: process.env.ZIGBEE_URL || 'http://localhost:3003'
  },
  fimat: {
    url: process.env.FIMAT_URL || 'http://localhost:3000'
  },
  alert: {
    pollInterval: parseInt(process.env.ALERT_POLL_INTERVAL) || 5000,
    cooldownMs: parseInt(process.env.ALERT_COOLDOWN_MS) || 30000
  }
};
