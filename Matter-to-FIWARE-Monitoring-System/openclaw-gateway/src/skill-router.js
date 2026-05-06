const axios = require('axios');
const config = require('../config');
const fmt = require('./telegram-formatter');

const MCP_URL = config.mcp.url;
const ORION_URL = config.orion.url;
const FIMAT_URL = config.fimat.url;
const ZIGBEE_URL = config.zigbee.url;

function matchKeywords(text, keywords) {
  return keywords.some(k => text.includes(k));
}

async function route(message) {
  const msg = message.toLowerCase().trim();

  if (matchKeywords(msg, ['risk', 'danger', 'safety', 'fire', 'zone status', 'how safe'])) {
    return await skillQueryRisk(msg);
  }

  if (matchKeywords(msg, ['alert', 'warning', 'incident', 'notification', 'what happened'])) {
    return await skillGetAlerts(msg);
  }

  if (matchKeywords(msg, ['turn on', 'turn off', 'switch on', 'switch off', 'activate', 'deactivate', 'control', 'plug on', 'plug off'])) {
    return await skillDeviceControl(msg);
  }

  if (matchKeywords(msg, ['status', 'health', 'system check', 'diagnostics', 'how is everything'])) {
    return await skillSystemStatus();
  }

  if (matchKeywords(msg, ['simulate', 'demo', 'test scenario', 'run demo', 'what if'])) {
    return await skillSimulate(msg);
  }

  return { text: fmt.formatHelp(), skill: 'help' };
}

async function skillQueryRisk(msg) {
  let zone = 'A';
  const zoneMatch = msg.match(/zone\s+(\w)/);
  if (zoneMatch) zone = zoneMatch[1].toUpperCase();

  const { data: risk } = await axios.get(`${MCP_URL}/risk`, { params: { zone } });
  return { text: fmt.formatRisk(risk), skill: 'query-risk' };
}

async function skillGetAlerts(msg) {
  const limit = msg.includes('all') || msg.includes('history') ? 20 : 5;
  const { data: alerts } = await axios.get(`${MCP_URL}/alerts`, { params: { limit } });
  return { text: fmt.formatAlerts(alerts), skill: 'get-alerts' };
}

async function skillDeviceControl(msg) {
  let action, deviceId, deviceName;

  if (msg.includes('plug') || msg.includes('switch')) {
    deviceId = 'urn:ngsi-ld:MatterDevice:2_1';
    deviceName = 'Smart Plug';
  } else {
    return {
      text: 'Which device? I can control the Smart Plug.\nTry: "Turn on the smart plug"',
      skill: 'device-control'
    };
  }

  if (msg.includes('turn on') || msg.includes('switch on') || msg.includes('activate')) {
    action = 'TURN_ON';
  } else if (msg.includes('turn off') || msg.includes('switch off') || msg.includes('deactivate')) {
    action = 'TURN_OFF';
  } else {
    return {
      text: 'What action? Try "Turn on the smart plug" or "Turn off the smart plug"',
      skill: 'device-control'
    };
  }

  const { data: result } = await axios.post(`${MCP_URL}/tools/invoke_command`, {
    deviceId, action, reason: 'User requested via OpenClaw Telegram'
  });

  return { text: fmt.formatDeviceControl(result), skill: 'device-control' };
}

async function skillSystemStatus() {
  const services = [
    { name: 'Orion', url: `${ORION_URL}/version` },
    { name: 'FIMAT Agent', url: `${FIMAT_URL}/health` },
    { name: 'MCP Agent', url: `${MCP_URL}/health` },
    { name: 'Zigbee Bridge', url: `${ZIGBEE_URL}/health` }
  ];

  const results = await Promise.allSettled(
    services.map(async svc => {
      try {
        const res = await axios.get(svc.url, { timeout: 3000 });
        return { ...svc, ok: res.status === 200, status: res.status };
      } catch (e) {
        return { ...svc, ok: false, status: e.response?.status || 'timeout' };
      }
    })
  );

  const serviceResults = results.map(r => r.value || { ok: false, status: 'error' });

  let risks = [];
  try {
    const { data } = await axios.get(`${MCP_URL}/risk/all`, { timeout: 3000 });
    risks = data;
  } catch { /* skip */ }

  let deviceCount;
  try {
    const { data: entities } = await axios.get(`${ORION_URL}/v2/entities`, { timeout: 3000 });
    deviceCount = entities.filter(e =>
      e.type === 'HumiditySensor' || e.type === 'SmartPlug' || e.type === 'TemperatureSensor'
    ).length;
  } catch { /* skip */ }

  return { text: fmt.formatSystemStatus(serviceResults, risks, deviceCount), skill: 'system-status' };
}

async function skillSimulate(msg) {
  let mode = 'critical';
  if (msg.includes('normal')) mode = 'normal';
  else if (msg.includes('warning')) mode = 'warning';
  else if (msg.includes('critical') || msg.includes('fire')) mode = 'critical';

  const { data: result } = await axios.post(`${MCP_URL}/evaluate`);

  return {
    text: fmt.formatSimulate(mode, `Mode: ${mode}`),
    skill: 'simulate-scenario'
  };
}

module.exports = { route };
