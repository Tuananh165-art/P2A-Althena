/* ============================================
   Climate Resilience Copilot — Common JS
   Shared logic across all dashboard pages
   ============================================ */

const ORION_URL = 'http://localhost:3001';
const MCP_URL = 'http://localhost:3002';
const FIMAT_URL = 'http://localhost:3000';
const REFRESH_INTERVAL = 3000;

const state = {
  orionConnected: false,
  mcpConnected: false,
  entities: {},
  lastUpdate: null
};

// === Connection checks ===

async function checkOrionConnection() {
  try {
    const res = await fetch(`${ORION_URL}/version`);
    if (res.ok) {
      state.orionConnected = true;
      setConnectionStatus('orion', true, 'Connected');
    } else {
      setConnectionStatus('orion', false, `Error ${res.status}`);
    }
  } catch {
    setConnectionStatus('orion', false, 'Disconnected');
  }
}

async function checkMCPConnection() {
  try {
    const res = await fetch(`${MCP_URL}/health`);
    if (res.ok) {
      state.mcpConnected = true;
      setConnectionStatus('mcp', true, 'Running');
    } else {
      setConnectionStatus('mcp', false, `Error ${res.status}`);
    }
  } catch {
    setConnectionStatus('mcp', false, 'Disconnected');
  }
}

function setConnectionStatus(service, connected, text) {
  const dot = document.getElementById(`${service}-status`);
  const label = document.getElementById(`${service}-text`);
  if (dot) dot.className = `status-dot ${connected ? '' : 'disconnected'}`;
  if (label) label.textContent = text;
}

// === Fetch data ===

async function fetchEntities(callback) {
  try {
    const res = await fetch(`${ORION_URL}/v2/entities`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const entities = await res.json();

    state.lastUpdate = new Date().toLocaleTimeString('vi-VN');
    const el = document.getElementById('last-update');
    if (el) el.textContent = state.lastUpdate;

    if (!state.orionConnected) {
      state.orionConnected = true;
      setConnectionStatus('orion', true, 'Connected');
    }

    state.entities = {};
    entities.forEach(e => { state.entities[e.id] = e; });

    if (callback) callback(entities);
  } catch (e) {
    console.error('[Common] fetchEntities error:', e.message);
    setConnectionStatus('orion', false, `Error: ${e.message}`);
  }
}

async function fetchRisk(callback) {
  try {
    const res = await fetch(`${MCP_URL}/risk?zone=A`);
    if (!res.ok) return;
    const risk = await res.json();
    if (callback) callback(risk);
    if (!state.mcpConnected) {
      state.mcpConnected = true;
      setConnectionStatus('mcp', true, 'Running');
    }
  } catch {}
}

async function fetchAlerts(limit, callback) {
  try {
    const res = await fetch(`${MCP_URL}/alerts?limit=${limit || 20}`);
    if (!res.ok) return;
    const alerts = await res.json();
    if (callback) callback(alerts);
  } catch {}
}

async function fetchCommands(limit, callback) {
  try {
    const res = await fetch(`${MCP_URL}/commands?limit=${limit || 20}`);
    if (!res.ok) return;
    const commands = await res.json();
    if (callback) callback(commands);
  } catch {}
}

// === UI Updates ===

function updateDeviceUI(entityId, attr, value, attrObj) {
  if (entityId.includes('3_1') && attr === 'temperature') {
    const v = document.getElementById('temp-value');
    const p = document.getElementById('temp-progress');
    const s = document.getElementById('temp-status');
    if (v) v.textContent = value.toFixed(1);
    if (p) p.style.width = `${(value / 65) * 100}%`;
    if (s) {
      if (value >= 50) { s.textContent = 'CRITICAL — Wiring overheat! Fire risk imminent!'; s.style.color = '#f44336'; }
      else if (value >= 40) { s.textContent = 'WARNING — Heat stress on electrical insulation'; s.style.color = '#ff9800'; }
      else { s.textContent = 'Normal — No thermal risk detected'; s.style.color = '#4caf50'; }
    }
  }
  if (entityId.includes('1_1') && attr === 'measuredValue') {
    const v = document.getElementById('humidity-value');
    const p = document.getElementById('humidity-progress');
    const s = document.getElementById('humidity-status');
    if (v) v.textContent = value.toFixed(1);
    if (p) p.style.width = `${value}%`;
    if (s) {
      if (value >= 90) { s.textContent = 'CRITICAL — Moisture + power = short circuit risk!'; s.style.color = '#f44336'; }
      else if (value >= 75) { s.textContent = 'WARNING — Elevated moisture, monitor insulation'; s.style.color = '#ff9800'; }
      else { s.textContent = 'Normal — No moisture risk'; s.style.color = '#4caf50'; }
    }
  }
  if (entityId.includes('2_1')) {
    if (attr === 'onOff') {
      const badge = document.getElementById('plug-status');
      if (badge) { badge.textContent = value ? 'ON' : 'OFF'; badge.className = `status-badge ${value ? 'on' : 'off'}`; }
    }
    if (attr === 'activePower') {
      const v = document.getElementById('power-value');
      const p = document.getElementById('power-progress');
      if (v) v.textContent = value;
      if (p) p.style.width = `${(value / 1000) * 100}%`;
    }
  }
}

function processEntities(entities) {
  let entriesHTML = '';
  entities.forEach(entity => {
    let attrs = [];
    for (const key in entity) {
      if (key === 'id' || key === 'type') continue;
      const attr = entity[key];
      const value = attr.value !== undefined ? attr.value : attr;
      const type = attr.type || typeof value;
      attrs.push(`${key}: ${formatVal(value)} (${type})`);
      updateDeviceUI(entity.id, key, value, attr);
    }
    entriesHTML += `
      <div class="entity-item">
        <div class="entity-header">
          <span class="entity-type">${entity.type}</span>
          <span class="entity-id">${entity.id}</span>
        </div>
        <div class="entity-attributes">
          ${attrs.map(a => `<div class="attribute">${a}</div>`).join('')}
        </div>
      </div>`;
  });
  const el = document.getElementById('entities-list');
  if (el) el.innerHTML = entriesHTML || '<p class="no-data">No entities</p>';
}

function updateRiskUI(risk) {
  const card = document.getElementById('risk-zone-card');
  if (!card) return;
  card.className = `risk-zone-card ${risk.riskLevel || 'normal'}`;
  document.getElementById('risk-score-value').textContent = risk.riskScore ?? '--';
  document.getElementById('risk-level').textContent = (risk.riskLevel || 'NO DATA').toUpperCase();
  const source = risk.reasoningSource || 'rules';
  const confidence = risk.confidence ? ` (${(risk.confidence * 100).toFixed(0)}% conf)` : '';
  const badge = source === 'ai' ? '<span class="ai-badge">AI</span>' : '<span class="rule-badge">RULE</span>';
  document.getElementById('risk-rationale').innerHTML = `${badge} ${risk.rationale || 'No data'}${confidence}`;
  const actionsEl = document.getElementById('risk-actions');
  if (actionsEl) {
    actionsEl.innerHTML = risk.recommendedActions?.length
      ? risk.recommendedActions.map(a => `<span class="risk-action-tag">${a}</span>`).join('')
      : '';
  }
}

function updateAlertsUI(alerts) {
  const container = document.getElementById('alerts-container');
  if (!container) return;
  if (!alerts.length) { container.innerHTML = '<p class="no-alerts">No alerts</p>'; return; }
  container.innerHTML = alerts.reverse().map(a => {
    const level = a.level?.value || 'warning';
    const msg = a.message?.value || '';
    const zone = a.zone?.value || '';
    const ts = a.timestamp?.value || '';
    const time = ts ? new Date(ts).toLocaleTimeString('vi-VN') : '';
    return `<div class="alert-item ${level}"><span>[${level.toUpperCase()}] Zone ${zone}: ${msg}</span><span class="alert-time">${time}</span></div>`;
  }).join('');
}

function updateCommandsUI(commands) {
  const container = document.getElementById('commands-container');
  if (!container) return;
  if (!commands.length) { container.innerHTML = '<p class="no-data">No commands executed</p>'; return; }
  container.innerHTML = commands.reverse().map(c => {
    const action = c.action?.value || '';
    const device = c.deviceId?.value || '';
    const status = c.status?.value || '';
    const reason = c.reason?.value || '';
    const shortDevice = device.split(':').pop();
    return `<div class="command-item"><span>${action} -> ${shortDevice} (${reason})</span><span class="command-status ${(status||'').toLowerCase()}">${status}</span></div>`;
  }).join('');
}

// === Simulation ===

async function simulateScenario(mode) {
  let humidity, power, plugOn, temperature;
  switch (mode) {
    case 'normal': humidity = 45 + Math.random()*20; power = 50 + Math.random()*100; temperature = 25 + Math.random()*8; plugOn = true; break;
    case 'warning': humidity = 76 + Math.random()*10; power = 810 + Math.random()*100; temperature = 41 + Math.random()*6; plugOn = true; break;
    case 'critical': humidity = 91 + Math.random()*8; power = 960 + Math.random()*40; temperature = 51 + Math.random()*8; plugOn = true; break;
  }
  const timestamp = new Date().toISOString();
  async function updateEntity(entityId, body) {
    try {
      const res = await fetch(`${ORION_URL}/v2/entities/${entityId}/attrs`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`${res.status}`);
    } catch {
      try { await fetch(`${ORION_URL}/v2/entities/${entityId}/attrs?options=append`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
      catch (e) { console.error(`Error updating ${entityId}:`, e); }
    }
  }
  await Promise.all([
    updateEntity('urn:ngsi-ld:MatterDevice:3_1', { temperature: { type: 'Number', value: temperature, metadata: { unit: { type: 'string', value: '°C' }, timestamp: { type: 'string', value: timestamp } } } }),
    updateEntity('urn:ngsi-ld:MatterDevice:1_1', { measuredValue: { type: 'Number', value: humidity, metadata: { unit: { type: 'string', value: '%RH' }, timestamp: { type: 'string', value: timestamp } } } }),
    updateEntity('urn:ngsi-ld:MatterDevice:2_1', { onOff: { type: 'Boolean', value: plugOn }, activePower: { type: 'Number', value: power, metadata: { unit: { type: 'string', value: 'W' }, timestamp: { type: 'string', value: timestamp } } } })
  ]);
  try { await fetch(`${MCP_URL}/evaluate`, { method: 'POST' }); } catch {}
  console.log(`[Sim] ${mode}: temp=${temperature.toFixed(1)}°C, humidity=${humidity.toFixed(1)}%, power=${power.toFixed(0)}W`);
}

async function triggerEvaluate() {
  try {
    const res = await fetch(`${MCP_URL}/evaluate`, { method: 'POST' });
    if (res.ok) { const data = await res.json(); console.log('[Eval] Triggered:', data); }
  } catch { alert('MCP Agent is not running'); }
}

// === Utilities ===

function formatVal(v) {
  if (typeof v === 'number') return v.toFixed(2);
  if (typeof v === 'boolean') return v ? 'ON' : 'OFF';
  return String(v);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function createInfoPanel(title, contentHtml) {
  return `<details class="info-panel"><summary>${title}</summary><div class="info-content">${contentHtml}</div></details>`;
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('vi-VN');
}
