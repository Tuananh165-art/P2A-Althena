/* AI operations chat */
const chatState = { isProcessing: false };

document.addEventListener('DOMContentLoaded', () => {
  checkOrionConnection();
  checkMCPConnection();
  document.getElementById('chat-input')?.focus();
});

function sendQuickAction(text) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value = text;
  sendChatMessage();
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text || chatState.isProcessing) return;

  input.value = '';
  appendChatMessage('user', text);
  chatState.isProcessing = true;
  const typing = showTypingIndicator();

  try {
    const response = await routeChatRequest(text);
    removeTypingIndicator(typing);
    appendChatMessage('bot', response.text, response.skill);
  } catch (error) {
    removeTypingIndicator(typing);
    appendChatMessage('bot', `Request failed: ${error.message}`, 'error');
  } finally {
    chatState.isProcessing = false;
  }
}

function appendChatMessage(role, text, skill) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const message = document.createElement('div');
  message.className = `chat-msg ${role}`;
  const tag = role === 'bot' && skill
    ? `<div class="msg-skill-tag"${skill === 'ai-reasoning' ? ' data-src="ai"' : ''}>${escapeHtml(skillLabel(skill))}</div>`
    : '';
  const safeText = escapeHtml(String(text || '')).replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
  message.innerHTML = `<div class="chat-msg-content">${tag}${safeText}</div>`;
  container.appendChild(message);
  container.scrollTop = container.scrollHeight;
}

function skillLabel(skill) {
  if (skill === 'ai-reasoning') return 'AI';
  if (skill === 'device-control') return 'Control';
  if (skill === 'simulate-scenario') return 'Simulation';
  if (skill === 'error') return 'Error';
  return 'Rules';
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  if (!container) return null;
  const indicator = document.createElement('div');
  indicator.className = 'chat-typing';
  indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
  return indicator;
}

function removeTypingIndicator(indicator) {
  indicator?.remove();
}

async function routeChatRequest(message) {
  const normalized = normalizeVietnamese(message);
  const controlIntent = [
    'turn on', 'turn off', 'switch on', 'switch off',
    'activate', 'deactivate', 'bat ', 'tat ', 'ngat dien'
  ].some(keyword => normalized.includes(keyword));
  const simulationIntent = [
    'simulate', 'simulation', 'test scenario', 'run demo',
    'mo phong', 'gia lap'
  ].some(keyword => normalized.includes(keyword));

  if (controlIntent) return controlDevice(normalized);
  if (simulationIntent) return simulateFromChat(normalized);
  return askAI(message);
}

function normalizeVietnamese(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

async function askAI(message) {
  const response = await fetch(`${MCP_URL}/tools/ai_chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `MCP returned ${response.status}`);
  return {
    text: payload.text || 'The AI endpoint returned no response.',
    skill: payload.source === 'ai' ? 'ai-reasoning' : 'rule-based'
  };
}

async function controlDevice(message) {
  const response = await fetch(`${MCP_URL}/tools/query_entities?zone=A&type=SmartPlug`);
  if (!response.ok) throw new Error(`Device lookup returned ${response.status}`);
  const devices = (await response.json()).filter(device => device.type === 'SmartPlug');
  if (!devices.length) {
    return { text: 'No controllable SmartPlug entities were found in Zone A.', skill: 'device-control' };
  }

  const target = selectTargetDevice(devices, message);
  const action = isTurnOnIntent(message) ? 'TURN_ON' : 'TURN_OFF';
  const commandResponse = await fetch(`${MCP_URL}/tools/invoke_command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: target.id,
      action,
      reason: 'User requested via dashboard chat',
      requestedBy: 'dashboard-chat',
      confirmed: true
    })
  });
  const result = await commandResponse.json().catch(() => ({}));
  if (!commandResponse.ok) throw new Error(result.error || `MCP returned ${commandResponse.status}`);

  const status = ngsiChatValue(result.status) || 'PENDING';
  const error = ngsiChatValue(result.error);
  const deviceName = target.id.split(':').pop().replace(/_/g, ' ');
  return {
    text: error
      ? `${deviceName}: ${action}\nStatus: ${status}\n${error}`
      : `${deviceName}: ${action}\nStatus: ${status}`,
    skill: 'device-control'
  };
}

function selectTargetDevice(devices, message) {
  const aliases = [
    { words: ['air conditioner', 'dieu hoa', ' ac '], token: 'ac' },
    { words: ['fan', 'quat'], token: 'fan' },
    { words: ['server', 'may chu'], token: 'server' },
    { words: ['lamp', 'light', 'den'], token: 'light' },
    { words: ['outlet', 'socket', 'o cam', 'badplug'], token: 'badplug' }
  ];
  const match = aliases.find(alias => alias.words.some(word => message.includes(word)));
  if (match) {
    const selected = devices.find(device => device.id.toLowerCase().includes(match.token));
    if (selected) return selected;
  }
  return devices[0];
}

function isTurnOnIntent(message) {
  return ['turn on', 'switch on', 'activate', 'bat '].some(keyword => message.includes(keyword));
}

async function simulateFromChat(message) {
  const scenario = message.includes('normal')
    ? 'normal'
    : message.includes('warning') || message.includes('canh bao')
      ? 'warning'
      : 'critical';
  const result = await simulateScenario(scenario);
  return {
    text: `Scenario ${scenario.toUpperCase()} requested.\nStatus: ${result.status || 'SIMULATED'}`,
    skill: 'simulate-scenario'
  };
}

function ngsiChatValue(value) {
  return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')
    ? value.value
    : value;
}
