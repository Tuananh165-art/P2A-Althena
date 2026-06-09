/* Chat page logic — OpenClaw skill router */
const chatState = { isOpen: true, messages: [], isProcessing: false };

document.addEventListener('DOMContentLoaded', () => {
  renderNav('chat');
  checkOrionConnection();
  checkMCPConnection();
  document.getElementById('chat-input').focus();
});

function sendQuickAction(text) {
  document.getElementById('chat-input').value = text;
  sendChatMessage();
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || chatState.isProcessing) return;
  input.value = '';
  appendChatMessage('user', text);
  chatState.isProcessing = true;
  const typingEl = showTypingIndicator();
  try {
    const response = await routeSkill(text);
    removeTypingIndicator(typingEl);
    appendChatMessage('bot', response.text, response.skill);
  } catch (e) {
    removeTypingIndicator(typingEl);
    appendChatMessage('bot', `Error: ${e.message}. Make sure the MCP Agent is running.`);
  }
  chatState.isProcessing = false;
}

function appendChatMessage(role, text, skill) {
  const container = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;
  let content = '';
  if (role === 'bot' && skill) {
    const srcAttr = skill === 'ai-reasoning' ? ' data-src="ai"' : skill === 'rule-based' ? ' data-src="rules"' : '';
    const label = skill === 'ai-reasoning' ? 'AI' : skill === 'rule-based' ? 'Rules' : skill;
    content = `<div class="msg-skill-tag"${srcAttr}>${label}</div>`;
  }
  // Normalize \r\n -> \n, then convert newlines to <br>
  const safeText = escapeHtml(text).replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
  content += safeText;
  msg.innerHTML = `<div class="chat-msg-content">${content}</div>`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'chat-typing';
  el.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

function removeTypingIndicator(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// === Skill Router ===

async function routeSkill(message) {
  const msg = message.toLowerCase();
  // Device control and simulation are action-based — keep as direct API calls
  if (matchKeywords(msg, ['turn on', 'turn off', 'switch', 'activate', 'deactivate', 'control', 'plug on', 'plug off'])) return await skillDeviceControl(msg);
  if (matchKeywords(msg, ['simulate', 'demo', 'test scenario', 'run demo', 'what if'])) return await skillSimulate(msg);
  // Everything else goes to the AI endpoint for real reasoning
  return await skillAIChat(message);
}

function matchKeywords(text, keywords) {
  return keywords.some(k => text.includes(k));
}

async function skillAIChat(message) {
  try {
    const res = await fetch(`${MCP_URL}/tools/ai_chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    if (!res.ok) throw new Error(`MCP returned ${res.status}`);
    const result = await res.json();
    const sourceTag = result.source === 'ai' ? 'ai-reasoning' : 'rule-based';
    return { text: result.text, skill: sourceTag };
  } catch (e) {
    return { text: `AI unavailable: ${e.message}. Make sure MCP Agent is running.`, skill: 'error' };
  }
}

async function skillQueryRisk(msg) {
  let zone = 'A';
  const m = msg.match(/zone\s+(\w)/);
  if (m) zone = m[1].toUpperCase();
  const res = await fetch(`${MCP_URL}/risk?zone=${zone}`);
  if (!res.ok) throw new Error(`MCP returned ${res.status}`);
  const risk = await res.json();
  const emoji = { normal: '✅', warning: '⚠️', critical: '🔴' }[risk.riskLevel] || '❓';
  let text = `${emoji} Zone ${risk.zone}: ${(risk.riskLevel || 'UNKNOWN').toUpperCase()}\nFire Risk Score: ${risk.riskScore ?? '--'}/100\n\n${risk.rationale || 'No data'}\n\n`;
  if (risk.recommendedActions?.length) text += `Actions: ${risk.recommendedActions.join(', ')}`;
  if (risk.confidence) text += `\nConfidence: ${(risk.confidence * 100).toFixed(0)}%`;
  text += `\nSource: ${risk.reasoningSource || 'rules'}`;
  return { text, skill: 'query-risk' };
}

async function skillGetAlerts(msg) {
  const limit = msg.includes('all') || msg.includes('history') ? 20 : 5;
  const res = await fetch(`${MCP_URL}/alerts?limit=${limit}`);
  if (!res.ok) throw new Error(`MCP returned ${res.status}`);
  const alerts = await res.json();
  if (!alerts.length) return { text: '✅ No active alerts. System operating normally.', skill: 'get-alerts' };
  const levelEmoji = { critical: '🔴', warning: '⚠️', normal: '✅' };
  let text = `Recent Alerts (${alerts.length}):\n\n`;
  alerts.reverse().forEach(a => {
    const level = a.level?.value || 'warning';
    const emoji = levelEmoji[level] || '❓';
    const zone = a.zone?.value || '?';
    const msg = a.message?.value || 'No message';
    const ts = a.timestamp?.value ? new Date(a.timestamp.value).toLocaleTimeString('vi-VN') : '';
    text += `${emoji} [${level.toUpperCase()}] Zone ${zone}: ${msg}\n   ${ts}\n\n`;
  });
  return { text: text.trim(), skill: 'get-alerts' };
}

async function skillDeviceControl(msg) {
  let action, deviceId, deviceName;
  if (msg.includes('plug') || msg.includes('switch')) {
    deviceId = 'urn:ngsi-ld:MatterDevice:2_1';
    deviceName = 'Smart Plug';
  } else {
    return { text: 'Which device? I can control the Smart Plug. Try: "Turn on the smart plug"', skill: 'device-control' };
  }
  if (msg.includes('turn on') || msg.includes('switch on') || msg.includes('activate')) action = 'TURN_ON';
  else if (msg.includes('turn off') || msg.includes('switch off') || msg.includes('deactivate')) action = 'TURN_OFF';
  else return { text: 'What action? Try "Turn on the smart plug" or "Turn off the smart plug"', skill: 'device-control' };

  const res = await fetch(`${MCP_URL}/tools/invoke_command`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, action, reason: 'User requested via OpenClaw chat' })
  });
  if (!res.ok) throw new Error(`MCP returned ${res.status}`);
  const result = await res.json();
  const statusEmoji = result.status === 'ACK' ? '✅' : '❌';
  return { text: `${statusEmoji} ${deviceName}: ${action}\nStatus: ${result.status}\nCommand ID: ${result.commandId || 'N/A'}`, skill: 'device-control' };
}

async function skillDeviceControl(msg) {
  let action, deviceId, deviceName;
  if (msg.includes('plug') || msg.includes('switch')) {
    const lookup = await fetch(`${MCP_URL}/tools/query_entities?zone=A&type=SmartPlug`);
    if (!lookup.ok) throw new Error(`MCP returned ${lookup.status}`);
    const devices = (await lookup.json()).filter(d => d.type === 'SmartPlug');
    if (devices.length !== 1) {
      return { text: `Found ${devices.length} smart plugs. Please specify the device before control.`, skill: 'device-control' };
    }
    deviceId = devices[0].id;
    deviceName = 'Smart Plug';
  } else {
    return { text: 'Which device? I can control the Smart Plug. Try: "Turn on the smart plug"', skill: 'device-control' };
  }
  if (msg.includes('turn on') || msg.includes('switch on') || msg.includes('activate')) action = 'TURN_ON';
  else if (msg.includes('turn off') || msg.includes('switch off') || msg.includes('deactivate')) action = 'TURN_OFF';
  else return { text: 'What action? Try "Turn on the smart plug" or "Turn off the smart plug"', skill: 'device-control' };

  const res = await fetch(`${MCP_URL}/tools/invoke_command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      action,
      reason: 'User requested via OpenClaw chat',
      confirmed: true,
      requestedBy: 'dashboard-chat'
    })
  });
  if (!res.ok) throw new Error(`MCP returned ${res.status}`);
  const result = await res.json();
  const value = v => (v && typeof v === 'object' && 'value' in v) ? v.value : v;
  const status = value(result.status);
  const statusLabel = status === 'ACK' || status === 'SIMULATED_ACK' ? 'OK' : 'ERROR';
  return { text: `${statusLabel} ${deviceName}: ${action}\nStatus: ${status}\nCommand ID: ${value(result.commandId) || 'N/A'}`, skill: 'device-control' };
}

async function skillSystemStatus() {
  const services = [
    { name: 'Orion', url: `${ORION_URL}/version` },
    { name: 'FIMAT Agent', url: `${FIMAT_URL}/health` },
    { name: 'MCP Agent', url: `${MCP_URL}/health` }
  ];
  let text = 'Climate Resilience Copilot Status\n================================\n\nServices:\n';
  for (const svc of services) {
    try {
      const res = await fetch(svc.url);
      text += res.ok ? `✅ ${svc.name}: Connected\n` : `❌ ${svc.name}: Error ${res.status}\n`;
    } catch { text += `❌ ${svc.name}: Disconnected\n`; }
  }
  try {
    const res = await fetch(`${MCP_URL}/risk/all`);
    if (res.ok) {
      const risks = await res.json();
      text += '\nRisk Assessment:\n';
      risks.forEach(r => {
        const emoji = { normal: '✅', warning: '⚠️', critical: '🔴' }[r.riskLevel] || '❓';
        text += `${emoji} Zone ${r.zone}: ${(r.riskLevel || 'unknown').toUpperCase()} (${r.riskScore ?? '--'}/100)\n`;
      });
    }
  } catch {}
  try {
    const res = await fetch(`${ORION_URL}/v2/entities`);
    if (res.ok) {
      const entities = await res.json();
      text += `\nDevices Online: ${entities.filter(e => ['HumiditySensor','SmartPlug','TemperatureSensor'].includes(e.type)).length}`;
    }
  } catch {}
  return { text, skill: 'system-status' };
}

async function skillSimulate(msg) {
  let mode = 'critical';
  if (msg.includes('normal')) mode = 'normal';
  else if (msg.includes('warning')) mode = 'warning';
  else if (msg.includes('critical') || msg.includes('fire')) mode = 'critical';
  await simulateScenario(mode);
  const emoji = { normal: '✅', warning: '⚠️', critical: '🔴' }[mode] || '❓';
  const desc = {
    normal: 'Normal conditions — all sensors within safe range',
    warning: 'Heat wave warning — temperature rising, electrical load increasing',
    critical: 'CRITICAL fire risk — extreme heat + electrical overload detected'
  };
  return {
    text: `${emoji} ${desc[mode]}\n\nScenario injected: Temperature, Power, Humidity updated.\nMCP Agent will evaluate fire risk on next poll cycle.\n\nWatch the dashboard for real-time risk assessment.`,
    skill: 'simulate-scenario'
  };
}
