const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const fmt = require('./telegram-formatter');

const MCP_URL = config.mcp.url;
const ORION_URL = config.orion.url;
const FIMAT_URL = config.fimat.url;
const ZIGBEE_URL = config.zigbee.url;
const SKILLS_DIR = process.env.OPENCLAW_SKILLS_DIR ||
  path.resolve(__dirname, '..', '..', '..', 'openclaw-skills');

const VIETNAMESE_TRIGGERS = {
  'query-risk': ['rủi ro', 'rui ro', 'nguy cơ', 'nguy co', 'nguy hiểm', 'nguy hiem', 'cháy', 'chay', 'an toàn', 'an toan'],
  'get-alerts': ['cảnh báo', 'canh bao', 'thông báo', 'thong bao', 'sự cố', 'su co', 'lịch sử', 'lich su'],
  'device-control': ['bật', 'bat', 'tắt', 'tat', 'điều khiển', 'dieu khien', 'ổ cắm', 'o cam', 'đèn cảnh báo', 'den canh bao'],
  'system-status': ['trạng thái', 'trang thai', 'hệ thống', 'he thong', 'sức khỏe', 'suc khoe', 'kiểm tra', 'kiem tra'],
  'simulate-scenario': ['mô phỏng', 'mo phong', 'giả lập', 'gia lap', 'demo', 'thử nghiệm', 'thu nghiem', 'kịch bản', 'kich ban']
};

function parseSkillFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    meta[key] = value;
  }

  if (!meta.name) return null;
  const triggers = (meta.trigger || '')
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  return {
    name: meta.name,
    description: meta.description || '',
    triggers: [...triggers, ...(VIETNAMESE_TRIGGERS[meta.name] || [])],
    file: path.basename(filePath)
  };
}

function loadSkills() {
  try {
    return fs.readdirSync(SKILLS_DIR)
      .filter(file => file.endsWith('.md') && file.toLowerCase() !== 'skills.md')
      .map(file => parseSkillFile(path.join(SKILLS_DIR, file)))
      .filter(Boolean);
  } catch (e) {
    console.warn(`[OpenClaw] Could not load external skills from ${SKILLS_DIR}: ${e.message}`);
    return [];
  }
}

const loadedSkills = loadSkills();
console.log(`[OpenClaw] Loaded ${loadedSkills.length} external skill(s) from ${SKILLS_DIR}`);

function getSkill(name) {
  return loadedSkills.find(skill => skill.name === name);
}

function matchKeywords(text, keywords) {
  const normalizedText = normalizeText(text);
  return keywords.some(k => normalizedText.includes(normalizeText(k)));
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function matchSkill(text, name) {
  const skill = getSkill(name);
  return skill && matchKeywords(text, skill.triggers);
}

async function route(message) {
  const msg = normalizeText(message).trim();

  if (matchSkill(msg, 'device-control')) {
    return await skillDeviceControl(msg);
  }

  if (matchSkill(msg, 'simulate-scenario')) {
    return await skillSimulate(msg);
  }

  return await skillAIChat(message);
}

function toTelegramHtml(text) {
  return fmt.escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/\r\n/g, '\n');
}

async function skillAIChat(message) {
  try {
    const { data: result } = await axios.post(`${MCP_URL}/tools/ai_chat`, {
      message,
      skills: getSkills(),
      seedData: {
        zone: 'A',
        scenario: 'demo-building-main-area',
        sensors: {
          temperatureC: 36.8,
          humidityPercent: 68,
          activePowerW: 620,
          smartPlug: 'ON'
        },
        actions: ['risk check', 'alerts', 'system status', 'simulation', 'smart plug control']
      }
    }, { timeout: 65000 });

    return {
      text: toTelegramHtml(result.text || fmt.formatHelp(loadedSkills)),
      skill: result.source === 'ai' ? 'ai-chat' : 'rules-chat'
    };
  } catch (e) {
    console.error(`[OpenClaw] AI chat failed: ${e.message}`);
    return {
      text: 'Mình nghe được, nhưng kênh AI đang chậm. Bạn có thể hỏi nhanh: "rui ro", "canh bao", "trang thai he thong", "mo phong critical", hoặc "tat o cam".',
      skill: 'help'
    };
  }
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
  msg = normalizeText(msg);

  if (msg.includes('plug') || msg.includes('switch') || msg.includes('o cam')) {
    deviceId = 'urn:ngsi-ld:MatterDevice:2_1';
    deviceName = 'Smart Plug';
  } else {
    return {
      text: 'Which device? I can control the Smart Plug.\nTry: "Turn on the smart plug"',
      skill: 'device-control'
    };
  }

  if (msg.includes('turn on') || msg.includes('switch on') || msg.includes('activate') || msg.includes('bat')) {
    action = 'TURN_ON';
  } else if (msg.includes('turn off') || msg.includes('switch off') || msg.includes('deactivate') || msg.includes('tat')) {
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

function getSkills() {
  return loadedSkills.map(skill => ({
    name: skill.name,
    description: skill.description,
    trigger: skill.triggers.join(', '),
    file: skill.file
  }));
}

module.exports = { route, getSkills };
