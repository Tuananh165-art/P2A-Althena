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
  'query-risk': ['rui ro', 'nguy co', 'nguy hiem', 'chay', 'an toan'],
  'get-alerts': ['canh bao', 'thong bao', 'su co', 'lich su'],
  'device-control': ['bat', 'tat', 'dieu khien', 'o cam', 'den canh bao', 'quat', 'fan'],
  'system-status': ['trang thai', 'he thong', 'suc khoe', 'kiem tra'],
  'simulate-scenario': ['mo phong', 'gia lap', 'demo', 'thu nghiem', 'kich ban']
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
    file: path.relative(SKILLS_DIR, filePath)
  };
}

function loadSkills() {
  try {
    return fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .map(entry => {
        if (entry.isFile() && entry.name.endsWith('.md') && entry.name.toLowerCase() !== 'skills.md') {
          return path.join(SKILLS_DIR, entry.name);
        }
        if (entry.isDirectory()) {
          const skillFile = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
          return fs.existsSync(skillFile) ? skillFile : null;
        }
        return null;
      })
      .filter(Boolean)
      .map(file => parseSkillFile(file))
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
    .replace(/[\u0111\u0110]/g, 'd');
}

function matchSkill(text, name) {
  const skill = getSkill(name);
  return skill && matchKeywords(text, skill.triggers);
}

function hasAny(msg, words) {
  return words.some(word => msg.includes(word));
}

function requestedControlAction(msg) {
  if (
    hasAny(msg, ['turn on', 'switch on', 'activate', 'bat']) ||
    /\b(turn|switch)\s+[\w\s-]{1,40}\s+on\b/.test(msg)
  ) {
    return 'TURN_ON';
  }
  if (
    hasAny(msg, [
      'turn off', 'switch off', 'deactivate', 'shut down', 'shutdown',
      'cut', 'isolate', 'reduce load', 'tat'
    ]) ||
    /\b(turn|switch)\s+[\w\s-]{1,40}\s+off\b/.test(msg)
  ) {
    return 'TURN_OFF';
  }
  return '';
}

function mentionsAc(msg) {
  return /\bac\b/.test(msg) || hasAny(msg, ['air conditioner', 'lanh', 'dieu hoa']);
}

function mentionsFan(msg) {
  return hasAny(msg, ['fan', 'quat']);
}

function mentionsServer(msg) {
  return hasAny(msg, ['server', 'chu']);
}

function isDeviceControlIntent(msg) {
  const hasControlAction = Boolean(requestedControlAction(msg)) ||
    hasAny(msg, ['load-control', 'tat tai', 'bat tai', 'tat o cam', 'bat o cam', 'tat quat', 'bat quat', 'tat dieu hoa', 'bat dieu hoa', 'giam tai']);
  const hasControllableTarget = hasAny(msg, [
    'plug', 'smart plug', 'load', 'controllable', 'device',
    'fan', 'server', 'o cam', 'quat', 'dieu hoa', 'air conditioner'
  ]) || mentionsAc(msg);
  return hasControlAction && hasControllableTarget;
}

function isSimulationIntent(msg) {
  return hasAny(msg, ['simulate', 'simulation', 'scenario', 'what if', 'inject', 'run critical', 'demo critical', 'mo phong', 'gia lap', 'kich ban']);
}

function isAlertIntent(msg) {
  const asksForRiskBriefing = hasAny(msg, ['threshold', 'nguong', 'risk score', 'diem rui ro', 'fire-risk briefing', 'briefing rui ro']);
  const asksForIncidentBriefing = hasAny(msg, ['incident briefing', 'briefing su co', 'lich su su co', 'show latest alerts', 'latest alerts']);
  const asksForCurrentNotification = hasAny(msg, ['gui thong bao', 'show alerts', 'alert history', 'canh bao hien tai']);
  return (asksForIncidentBriefing || asksForCurrentNotification ||
    hasAny(msg, ['alert', 'alerts', 'incident', 'incidents', 'history', 'what happened', 'canh bao', 'su co'])) &&
    !asksForRiskBriefing;
}

function isSystemStatusIntent(msg) {
  return hasAny(msg, ['mission-control', 'mission control', 'health check', 'system health', 'service health', 'services', 'pipeline', 'diagnostics', 'status he thong', 'trang thai he thong', 'kiem tra he thong']);
}

function isRiskIntent(msg) {
  return hasAny(msg, ['risk', 'fire-risk', 'fire risk', 'risk briefing', 'danger', 'safe', 'safety', 'zone a', 'rui ro', 'nguy co', 'chay dien', 'briefing rui ro']);
}

function isJudgeDemoIntent(msg) {
  return hasAny(msg, ['judge demo', 'full demo', 'demo commander', 'end-to-end demo', 'full flow', 'ban giam khao', 'giam khao']);
}

function isSeedScenarioIntent(msg) {
  return hasAny(msg, ['seed scenario', 'sim-seed', 'normal heat-wave overload noisy offline', 'giong normal', 'giong heat-wave', 'giong overload', 'giong noisy', 'giong offline', 'closer to normal', 'closer to heat-wave', 'closer to overload', 'closer to noisy', 'closer to offline']);
}

async function route(message) {
  const msg = normalizeText(message).trim();

  if (msg === '/skill' || msg === '/skills' || msg === 'skill' || msg === 'skills') {
    return {
      text: await narrateWithLLM('skill-list', message, { skills: getSkills() }),
      skill: 'skill-list'
    };
  }

  if (isJudgeDemoIntent(msg)) {
    return await skillJudgeDemoCommander(message);
  }

  if (isSeedScenarioIntent(msg)) {
    return await skillSeedScenarioInspector(message);
  }

  if (isDeviceControlIntent(msg)) {
    return await skillDeviceControl(msg);
  }

  if (isSimulationIntent(msg)) {
    return await skillSimulate(msg);
  }

  if (isSystemStatusIntent(msg)) {
    return await skillSystemStatus(msg);
  }

  if (isAlertIntent(msg)) {
    return await skillGetAlerts(msg);
  }

  if (isRiskIntent(msg)) {
    return await skillQueryRisk(msg);
  }

  return await skillAIChat(message);
}

function toTelegramHtml(text) {
  return fmt.escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/\r\n/g, '\n');
}

async function narrateWithLLM(skill, originalMessage, toolResult) {
  const compactToolResult = compactForLLM(toolResult);
  const prompt = [
    `You are OpenClaw, the Telegram incident copilot for a climate resilience IoT system.`,
    `You MUST answer using the provided TOOL_RESULT_JSON only. Do not invent values.`,
    `Skill: ${skill}`,
    `Original user request: ${originalMessage}`,
    `TOOL_RESULT_JSON: ${JSON.stringify(compactToolResult)}`,
    `Write a polished, judge-demo-ready Telegram response.`,
    `Include exact metrics, service/tool status, actions, audit IDs, and what the result proves when available.`,
    `If the user wrote Vietnamese, answer in Vietnamese. If English, answer in English.`,
    `Keep it concise but complete, using simple headings and bullet points.`
  ].join('\n');

  try {
    const { data: result } = await axios.post(`${MCP_URL}/tools/ai_chat`, {
      message: prompt,
      skills: getSkills(),
      seedData: {
        skill,
        originalMessage,
        toolResultLocation: 'TOOL_RESULT_JSON is included in the user message.',
        note: 'This OpenClaw response must be synthesized by the MCP Agent LLM using live tool/API results.'
      }
    }, { timeout: 65000 });

    if (result.source === 'ai' && result.text) {
      return toTelegramHtml(result.text);
    }

    return formatToolResultFallback(skill, compactToolResult, 'MCP Agent returned a non-AI response');
  } catch (e) {
    console.error(`[OpenClaw] LLM narration failed for ${skill}: ${e.message}`);
    const detail = e.response?.data?.error || e.message;
    return formatToolResultFallback(skill, compactToolResult, detail);
  }
}

function formatToolResultFallback(skill, toolResult, aiError) {
  const note = `<b>AI narration unavailable</b>\n${fmt.escapeHtml(aiError || 'unknown error')}\nUsing verified MCP/FIWARE tool results below.\n\n`;

  try {
    if (skill === 'query-risk') {
      return note + fmt.formatRisk(toolResult.risk || {});
    }
    if (skill === 'get-alerts') {
      return note + fmt.formatAlerts(toolResult.alerts || []);
    }
    if (skill === 'device-control') {
      if (toolResult.error) {
        return note + `<b>Device Control Check</b>\n${fmt.escapeHtml(toolResult.error)}\nSupported actions/targets are listed in the MCP tool result.`;
      }
      return note + fmt.formatDeviceControl(toolResult.command || {}, toolResult.context || toolResult.selectedDevice || {});
    }
    if (skill === 'system-status') {
      return note + fmt.formatSystemStatus(
        toolResult.services || toolResult.serviceHealth || [],
        toolResult.risks || toolResult.finalSnapshot?.risks || [],
        toolResult.deviceCount || toolResult.finalSnapshot?.metrics?.smartPlugCount,
        {
          alertCount: toolResult.alertCount || toolResult.finalSnapshot?.alerts?.length || 0,
          entities: toolResult.entities || toolResult.finalSnapshot?.entities || []
        }
      );
    }
    if (skill === 'simulate-scenario') {
      return note + fmt.formatSimulate(toolResult.scenario, toolResult.simulation, toolResult.evaluatedRisk);
    }
    if (skill === 'judge-demo-commander') {
      return note + fmt.formatSystemStatus(
        toolResult.serviceHealth || [],
        toolResult.finalSnapshot?.risks || toolResult.initialFlow?.risk || [],
        toolResult.finalSnapshot?.metrics?.smartPlugCount,
        {
          alertCount: toolResult.finalSnapshot?.alerts?.length || toolResult.initialFlow?.alertCount || 0,
          entities: toolResult.finalSnapshot?.entities || []
        }
      );
    }
    if (skill === 'seed-scenario-inspector') {
      const nearest = toolResult.nearestScenario || {};
      const current = toolResult.current || {};
      let msg = note + '<b>Seed Scenario Inspector</b>\n';
      msg += `Nearest seed profile: <b>${fmt.escapeHtml(nearest.scenario || 'n/a')}</b>\n`;
      msg += `Current max temperature: <b>${fmt.escapeHtml(current.maxTempC ?? 'n/a')} C</b>\n`;
      msg += `Current max humidity: <b>${fmt.escapeHtml(current.maxHumidityPercent ?? 'n/a')}%</b>\n`;
      msg += `Current max power: <b>${fmt.escapeHtml(current.maxPowerW ?? 'n/a')} W</b>\n\n`;
      msg += '<b>Comparison scores</b>\n';
      (toolResult.comparisons || []).slice(0, 5).forEach(item => {
        msg += `- ${fmt.escapeHtml(item.scenario)}: ${fmt.escapeHtml(item.score)}\n`;
      });
      return msg;
    }
    if (skill === 'skill-list') {
      return note + fmt.formatHelp(loadedSkills);
    }
  } catch (fallbackError) {
    console.error(`[OpenClaw] Tool fallback failed for ${skill}: ${fallbackError.message}`);
  }

  return note + `<b>${fmt.escapeHtml(skill)}</b>\nMCP tool result was collected, but no formatter exists for this skill.`;
}

function compactForLLM(input, depth = 0) {
  if (depth > 6) return '[truncated-depth]';
  if (Array.isArray(input)) {
    return input.slice(0, 8).map(item => compactForLLM(item, depth + 1));
  }
  if (input && typeof input === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(input)) {
      if (key === 'entities') {
        out.entityCount = Array.isArray(value) ? value.length : 0;
        out.entitySamples = Array.isArray(value)
          ? value.slice(0, 8).map(item => compactForLLM(item, depth + 1))
          : value;
        continue;
      }
      out[key] = compactForLLM(value, depth + 1);
    }
    return out;
  }
  if (typeof input === 'string') {
    return input.length > 700 ? `${input.slice(0, 700)}...` : input;
  }
  return input;
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

    if (!result.text) {
      return {
        text: 'AI chat returned an empty response. Check mcp-agent/.env AI_ENDPOINT, AI_API_KEY, and AI_MODEL.',
        skill: 'ai-chat'
      };
    }

    return {
      text: toTelegramHtml(result.text),
      skill: 'ai-chat'
    };
  } catch (e) {
    console.error(`[OpenClaw] AI chat failed: ${e.message}`);
    return {
      text: `<b>AI chat unavailable</b>\n${fmt.escapeHtml(e.response?.data?.error || e.message)}\n\n${fmt.formatHelp(loadedSkills)}`,
      skill: 'ai-chat'
    };
  }
}

async function skillQueryRisk(msg) {
  let zone = 'A';
  const zoneMatch = msg.match(/\bzone\s+([a-z0-9_-]+)\b/i);
  if (zoneMatch) zone = zoneMatch[1].toUpperCase();

  const { data: risk } = await axios.get(`${MCP_URL}/risk`, { params: { zone } });
  return {
    text: await narrateWithLLM('query-risk', msg, { risk }),
    skill: 'query-risk'
  };
}

async function skillGetAlerts(msg) {
  const limit = msg.includes('all') || msg.includes('history') ? 20 : 5;
  const { data: alerts } = await axios.get(`${MCP_URL}/alerts`, { params: { limit } });
  return {
    text: await narrateWithLLM('get-alerts', msg, { alerts, limit }),
    skill: 'get-alerts'
  };
}

async function skillDeviceControl(msg) {
  let action, deviceId, deviceName, selectionReason, selectedPower, selectedState;
  msg = normalizeText(msg);

  if (msg.includes('plug') || msg.includes('switch') || msg.includes('load') || msg.includes('o cam') ||
      mentionsFan(msg) || mentionsAc(msg) || mentionsServer(msg)) {
    const { data: devices } = await axios.get(`${MCP_URL}/tools/query_entities`, {
      params: { type: 'SmartPlug', zone: 'A' }
    });
    const plugs = devices.filter(d => d.type === 'SmartPlug');
    if (plugs.length === 0) {
      return {
        text: await narrateWithLLM('device-control', msg, {
          error: 'No SmartPlug entities found in Zone A',
          queriedType: 'SmartPlug',
          zone: 'A',
          devices
        }),
        skill: 'device-control'
      };
    }
    
    let targetPlug = null;
    if (plugs.length > 1) {
      if (mentionsFan(msg)) {
        targetPlug = plugs.find(p => p.id.toLowerCase().includes('fan'));
        selectionReason = 'Selected the Fan smart plug because the operator explicitly requested fan isolation.';
      } else if (mentionsAc(msg)) {
        targetPlug = plugs.find(p => p.id.toLowerCase().includes('ac'));
        selectionReason = 'Selected the AC smart plug because the operator explicitly requested AC isolation.';
      } else if (mentionsServer(msg)) {
        targetPlug = plugs.find(p => p.id.toLowerCase().includes('server'));
        selectionReason = 'Selected the Server smart plug because the operator explicitly requested server isolation.';
      } else if (msg.includes('highest') || msg.includes('risk') || msg.includes('overload')) {
        targetPlug = [...plugs]
          .filter(p => p.onOff?.value !== false)
          .sort((a, b) => (b.activePower?.value || 0) - (a.activePower?.value || 0))[0];
        selectionReason = 'Selected the active controllable load with the highest reported power in Zone A.';
      }
      
      if (!targetPlug) {
        targetPlug = [...plugs]
          .filter(p => p.onOff?.value !== false)
          .sort((a, b) => (b.activePower?.value || 0) - (a.activePower?.value || 0))[0] ||
          plugs.find(p => p.id.toLowerCase().includes('ac')) ||
          plugs[0];
        selectionReason = selectionReason || 'Selected the best available controllable load in Zone A.';
      }
    } else {
      targetPlug = plugs[0];
      selectionReason = 'Only one controllable load was available in Zone A.';
    }
    
    deviceId = targetPlug.id;
    deviceName = targetPlug.id.split(':').pop().replace(/_/g, ' ');
    selectedPower = targetPlug.activePower?.value;
    selectedState = targetPlug.onOff?.value;
  } else {
    return {
      text: await narrateWithLLM('device-control', msg, {
        error: 'Device target was not clear enough to safely invoke a command',
        supportedTargets: ['AC smart plug', 'fan smart plug', 'server smart plug', 'highest-risk controllable load']
      }),
      skill: 'device-control'
    };
  }

  action = requestedControlAction(msg);
  if (!action) {
    return {
      text: await narrateWithLLM('device-control', msg, {
        error: 'Command action was not clear enough to safely invoke a device command',
        supportedActions: ['TURN_ON', 'TURN_OFF'],
        selectedDevice: {
          id: deviceId,
          name: deviceName,
          beforeState: selectedState,
          beforePowerW: selectedPower,
          selectionReason
        }
      }),
      skill: 'device-control'
    };
  }

  const { data: result } = await axios.post(`${MCP_URL}/tools/invoke_command`, {
    deviceId,
    action,
    reason: `Operator requested ${action} for ${deviceName} via OpenClaw Telegram`,
    confirmed: true,
    requestedBy: 'openclaw-telegram'
  });

  let verifiedDevice = null;
  try {
    const { data: updatedDevices } = await axios.get(`${MCP_URL}/tools/query_entities`, {
      params: { type: 'SmartPlug', zone: 'A' }
    });
    verifiedDevice = updatedDevices.find(d => d.id === deviceId) || null;
  } catch (e) {
    verifiedDevice = { error: e.message };
  }

  const context = {
      deviceName,
      reason: `Operator requested ${action} for ${deviceName} via OpenClaw Telegram`,
      selectionReason,
      selectedPower,
      selectedState,
      verifiedState: verifiedDevice?.onOff?.value,
      verifiedPower: verifiedDevice?.activePower?.value
    };

  return {
    text: await narrateWithLLM('device-control', msg, {
      command: result,
      selectedDevice: {
        id: deviceId,
        name: deviceName,
        beforeState: selectedState,
        beforePowerW: selectedPower,
        selectionReason
      },
      verifiedDevice: verifiedDevice ? {
        id: verifiedDevice.id,
        afterState: verifiedDevice.onOff?.value,
        afterPowerW: verifiedDevice.activePower?.value,
        source: verifiedDevice.activePower?.metadata?.source?.value || verifiedDevice.onOff?.metadata?.source?.value || ''
      } : null,
      context
    }),
    skill: 'device-control'
  };
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
  let entities = [];
  try {
    const { data } = await axios.get(`${ORION_URL}/v2/entities`, { timeout: 3000 });
    entities = data;
    deviceCount = entities.filter(e =>
      e.type === 'HumiditySensor' || e.type === 'SmartPlug' || e.type === 'TemperatureSensor'
    ).length;
  } catch { /* skip */ }

  let alertCount = 0;
  try {
    const { data: alerts } = await axios.get(`${MCP_URL}/alerts`, { params: { limit: 100 }, timeout: 3000 });
    alertCount = alerts.length;
  } catch { /* skip */ }

  return {
    text: await narrateWithLLM('system-status', 'system status / mission control', {
      services: serviceResults,
      risks,
      deviceCount,
      alertCount,
      entities
    }),
    skill: 'system-status'
  };
}

async function skillSimulate(msg) {
  let mode = 'critical';
  if (msg.includes('normal')) mode = 'normal';
  else if (msg.includes('warning')) mode = 'warning';
  else if (msg.includes('critical') || msg.includes('fire')) mode = 'critical';

  const { data: result } = await axios.post(`${MCP_URL}/tools/simulate_scenario`, {
    scenario: mode,
    zone: 'A',
    requestedBy: 'openclaw-telegram',
    confirmed: true
  });

  let evaluatedRisk = null;
  try {
    const { data: evaluation } = await axios.post(`${MCP_URL}/evaluate`, {}, { timeout: 10000 });
    evaluatedRisk = Array.isArray(evaluation.results)
      ? evaluation.results.find(r => r.zone === 'A') || evaluation.results[0]
      : null;
  } catch (e) {
    console.error(`[OpenClaw] Immediate evaluation after simulation failed: ${e.message}`);
  }

  return {
    text: await narrateWithLLM('simulate-scenario', msg, {
      scenario: mode,
      simulation: result,
      evaluatedRisk
    }),
    skill: 'simulate-scenario'
  };
}

function val(attr, fallback = undefined) {
  return attr && typeof attr === 'object' && Object.prototype.hasOwnProperty.call(attr, 'value')
    ? attr.value
    : (attr ?? fallback);
}

function summarizeEntityMetrics(entities) {
  const temps = entities
    .filter(e => e.type === 'TemperatureSensor')
    .map(e => Number(val(e.temperature, 0)))
    .filter(Number.isFinite);
  const hums = entities
    .filter(e => e.type === 'HumiditySensor')
    .map(e => Number(val(e.measuredValue, 0)))
    .filter(Number.isFinite);
  const powers = entities
    .filter(e => e.type === 'SmartPlug')
    .map(e => Number(val(e.activePower, 0)))
    .filter(Number.isFinite);
  const activePlugs = entities
    .filter(e => e.type === 'SmartPlug' && val(e.onOff, false) !== false)
    .map(e => ({
      id: e.id,
      activePowerW: Number(val(e.activePower, 0)),
      onOff: val(e.onOff, false)
    }))
    .sort((a, b) => b.activePowerW - a.activePowerW);

  return {
    maxTempC: temps.length ? Math.max(...temps) : 0,
    maxHumidityPercent: hums.length ? Math.max(...hums) : 0,
    maxPowerW: powers.length ? Math.max(...powers) : 0,
    avgPowerW: powers.length ? powers.reduce((sum, p) => sum + p, 0) / powers.length : 0,
    smartPlugCount: powers.length,
    activePlugs
  };
}

async function fetchLiveSnapshot() {
  const [entitiesRes, risksRes, alertsRes, commandsRes] = await Promise.allSettled([
    axios.get(`${ORION_URL}/v2/entities`, { timeout: 5000 }),
    axios.get(`${MCP_URL}/risk/all`, { timeout: 5000 }),
    axios.get(`${MCP_URL}/alerts`, { params: { limit: 20 }, timeout: 5000 }),
    axios.get(`${MCP_URL}/commands`, { params: { limit: 10 }, timeout: 5000 })
  ]);

  const entities = entitiesRes.status === 'fulfilled' ? entitiesRes.value.data : [];
  return {
    entities,
    metrics: summarizeEntityMetrics(entities),
    risks: risksRes.status === 'fulfilled' ? risksRes.value.data : [],
    alerts: alertsRes.status === 'fulfilled' ? alertsRes.value.data : [],
    commands: commandsRes.status === 'fulfilled' ? commandsRes.value.data : [],
    errors: {
      entities: entitiesRes.status === 'rejected' ? entitiesRes.reason.message : '',
      risks: risksRes.status === 'rejected' ? risksRes.reason.message : '',
      alerts: alertsRes.status === 'rejected' ? alertsRes.reason.message : '',
      commands: commandsRes.status === 'rejected' ? commandsRes.reason.message : ''
    }
  };
}

async function skillJudgeDemoCommander(message) {
  const health = await Promise.allSettled([
    axios.get(`${ORION_URL}/version`, { timeout: 3000 }),
    axios.get(`${MCP_URL}/health`, { timeout: 3000 }),
    axios.get(`${FIMAT_URL}/health`, { timeout: 3000 }),
    axios.get(`${ZIGBEE_URL}/health`, { timeout: 3000 })
  ]);

  const serviceHealth = ['Orion', 'MCP Agent', 'FIMAT Agent', 'Zigbee Bridge'].map((name, index) => ({
    name,
    ok: health[index].status === 'fulfilled',
    status: health[index].status === 'fulfilled' ? health[index].value.status : 'error',
    error: health[index].status === 'rejected' ? health[index].reason.message : ''
  }));

  let simulation = null;
  let evaluation = null;
  let command = null;
  let commandTarget = null;

  try {
    const simRes = await axios.post(`${MCP_URL}/tools/simulate_scenario`, {
      scenario: 'critical',
      zone: 'A',
      requestedBy: 'openclaw-judge-demo',
      confirmed: true
    }, { timeout: 10000 });
    simulation = simRes.data;
  } catch (e) {
    simulation = { error: e.message };
  }

  try {
    const evalRes = await axios.post(`${MCP_URL}/evaluate`, {}, { timeout: 10000 });
    evaluation = evalRes.data;
  } catch (e) {
    evaluation = { error: e.message };
  }

  const snapshot = await fetchLiveSnapshot();
  const target = snapshot.metrics.activePlugs[0];
  if (target) {
    commandTarget = target;
    try {
      const commandRes = await axios.post(`${MCP_URL}/tools/invoke_command`, {
        deviceId: target.id,
        action: 'TURN_OFF',
        reason: 'Judge demo commander selected highest-power active load after critical simulation',
        confirmed: true,
        requestedBy: 'openclaw-judge-demo'
      }, { timeout: 10000 });
      command = commandRes.data;
    } catch (e) {
      command = { error: e.message };
    }
  }

  const finalSnapshot = await fetchLiveSnapshot();
  const toolResult = {
    serviceHealth,
    initialFlow: {
      health: 'checked',
      risk: snapshot.risks,
      simulation,
      evaluation,
      alertCount: snapshot.alerts.length,
      selectedLoad: commandTarget,
      command
    },
    finalSnapshot,
    proof: 'FIWARE Orion provides live context, MCP evaluates risk and executes tools, OpenClaw routes skills and Telegram receives the final LLM narrative.'
  };

  return {
    text: await narrateWithLLM('judge-demo-commander', message, toolResult),
    skill: 'judge-demo-commander'
  };
}

function summarizeSeedFile(filePath) {
  const entities = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const metrics = summarizeEntityMetrics(Array.isArray(entities) ? entities : [entities]);
  const { activePlugs, ...metricSummary } = metrics;
  return {
    file: path.basename(filePath),
    entityCount: Array.isArray(entities) ? entities.length : 1,
    ...metricSummary,
    activePlugCount: activePlugs.length,
    activePlugSamples: activePlugs.slice(0, 5)
  };
}

async function skillSeedScenarioInspector(message) {
  const seedDir = path.resolve(__dirname, '..', '..', '..', 'sim-seed');
  const seedFiles = ['normal.json', 'heat-wave.json', 'overload.json', 'noisy.json', 'offline.json']
    .map(file => path.join(seedDir, file))
    .filter(file => fs.existsSync(file));
  const profiles = seedFiles.map(summarizeSeedFile);
  const snapshot = await fetchLiveSnapshot();
  const { activePlugs, ...currentMetricSummary } = snapshot.metrics;
  const current = {
    ...currentMetricSummary,
    activePlugCount: activePlugs.length,
    activePlugSamples: activePlugs.slice(0, 5)
  };

  const comparisons = profiles.map(profile => {
    const score =
      Math.abs(current.maxTempC - profile.maxTempC) / 60 +
      Math.abs(current.maxHumidityPercent - profile.maxHumidityPercent) / 100 +
      Math.abs(current.maxPowerW - profile.maxPowerW) / 1200 +
      Math.abs(current.avgPowerW - profile.avgPowerW) / 1200;
    return {
      scenario: profile.file.replace('.json', ''),
      score: Number(score.toFixed(4)),
      profile
    };
  }).sort((a, b) => a.score - b.score);

  const toolResult = {
    current,
    nearestScenario: comparisons[0] || null,
    comparisons,
    profiles,
    liveRisk: snapshot.risks,
    alerts: snapshot.alerts.slice(0, 5)
  };

  return {
    text: await narrateWithLLM('seed-scenario-inspector', message, toolResult),
    skill: 'seed-scenario-inspector'
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
