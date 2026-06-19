/* ============================================
   Climate Resilience Copilot — Common JS
   Shared logic across all dashboard pages
   ============================================ */

const host = window.location.hostname || '127.0.0.1';
const ORION_URL = `http://${host}:3001`;
const MCP_URL = `http://${host}:3002`;
const FIMAT_URL = `http://${host}:3000`;

window.ORION_URL = ORION_URL;
window.MCP_URL = MCP_URL;
window.FIMAT_URL = FIMAT_URL;
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
    const res = await fetch(`${ORION_URL}/v2/entities?limit=100`, {
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

function updateDeviceUI(entityId, attr, value, attrObj, entityType) {
  if (entityType === 'TemperatureSensor' && attr === 'temperature') {
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
  if (entityType === 'HumiditySensor' && attr === 'measuredValue') {
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
  if (entityType === 'SmartPlug') {
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

function renderDeviceCards(entities) {
  const grid = document.getElementById('devices-grid');
  if (!grid) return;
  const controlsEnabled = grid.dataset.deviceControls === 'true';

  const devices = entities.filter(e =>
    ['TemperatureSensor', 'HumiditySensor', 'SmartPlug'].includes(e.type) &&
    !isLegacyMatterEntity(e)
  );
  if (devices.length === 0) {
    grid.innerHTML = '<p class="no-data">No devices discovered in Orion</p>';
    return;
  }

  devices.sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));

  let html = '';
  devices.forEach(d => {
    const zone = d.zone?.value || d.zone || 'A';
    const shortId = d.id.split(':').pop();
    const presentation = getDevicePresentation(d, shortId);

    if (d.type === 'TemperatureSensor') {
      const temp = d.temperature?.value ?? 0;
      let status = 'Normal — No thermal risk detected';
      let statusColor = '#4caf50';
      let cardClass = '';
      if (temp >= 50) {
        status = 'CRITICAL — Overheat! Fire risk!';
        statusColor = '#f44336';
        cardClass = 'fire-risk';
      } else if (temp >= 40) {
        status = 'WARNING — Heat stress';
        statusColor = '#ff9800';
      }
      html += `
        <div class="device-card ${cardClass}">
          <div class="device-header">
            <h2>${presentation.name}</h2>
            <span class="device-id">${shortId} (Zone ${zone})</span>
          </div>
          <div class="device-content">
            <div class="metric">
              <span class="metric-label">Ambient</span>
              <span class="metric-value">${temp.toFixed(1)}</span>
              <span class="metric-unit">&deg;C</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, (temp / 65) * 100)}%"></div></div>
            <div class="status-info" style="color:${statusColor}">${status}</div>
          </div>
        </div>`;
    }

    if (d.type === 'HumiditySensor') {
      const humidity = d.measuredValue?.value ?? 0;
      let status = 'Normal — No moisture risk';
      let statusColor = '#4caf50';
      if (humidity >= 90) {
        status = 'CRITICAL — Short circuit risk!';
        statusColor = '#f44336';
      } else if (humidity >= 75) {
        status = 'WARNING — High moisture';
        statusColor = '#ff9800';
      }
      html += `
        <div class="device-card">
          <div class="device-header">
            <h2>${presentation.name}</h2>
            <span class="device-id">${shortId} (Zone ${zone})</span>
          </div>
          <div class="device-content">
            <div class="metric">
              <span class="metric-label">Humidity</span>
              <span class="metric-value">${humidity.toFixed(1)}</span>
              <span class="metric-unit">%RH</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, humidity)}%"></div></div>
            <div class="status-info" style="color:${statusColor}">${status}</div>
          </div>
        </div>`;
    }

    if (d.type === 'SmartPlug') {
      const activePower = d.activePower?.value ?? 0;
      const rawOnOff = d.onOff?.value;
      const onOff = rawOnOff === true || rawOnOff === 'true' || rawOnOff === 'ON' || rawOnOff === 'on' || rawOnOff === 1 || rawOnOff === '1';
      const badgeText = onOff ? 'ON' : 'OFF';
      const badgeClass = onOff ? 'on' : 'off';
      const controlAction = onOff ? 'TURN_OFF' : 'TURN_ON';
      const controlLabel = onOff ? 'Turn off' : 'Turn on';
      const encodedDeviceId = encodeURIComponent(d.id);
      const commandResult = window.deviceControlResults?.[d.id];
      html += `
        <div class="device-card" data-device-card="${encodedDeviceId}">
          <div class="device-header">
            <h2>${presentation.name}</h2>
            <span class="device-id">${shortId} (Zone ${zone})</span>
          </div>
          <div class="device-content">
            <div class="metric">
              <span class="metric-label">${presentation.kind}</span>
              <span class="status-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Power</span>
              <span class="metric-value">${activePower}</span>
              <span class="metric-unit">W</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, (activePower / 1000) * 100)}%"></div></div>
            ${controlsEnabled ? `
              <div class="device-control">
                <button
                  class="device-power-button ${onOff ? 'is-on' : 'is-off'}"
                  type="button"
                  data-device-id="${encodedDeviceId}"
                  data-action="${controlAction}"
                  aria-label="${controlLabel} ${presentation.name}"
                >
                  <span class="power-symbol" aria-hidden="true"></span>
                  <span>${controlLabel}</span>
                </button>
                <span class="device-control-result ${commandResult?.className || ''}" aria-live="polite">${escapeHtml(commandResult?.text || '')}</span>
              </div>
            ` : ''}
          </div>
        </div>`;
    }
  });

  grid.innerHTML = html;
}

function getDevicePresentation(device, shortId) {
  const explicitName = device.displayName?.value || device.displayName || device.name?.value || device.name;
  const genericNames = ['smart plug', 'smartplug', 'matter device', 'device'];
  const hasSpecificName = explicitName && !genericNames.includes(String(explicitName).trim().toLowerCase());
  if (hasSpecificName) {
    return {
      name: escapeHtml(String(explicitName)),
      kind: device.type === 'SmartPlug' ? 'Controlled load' : 'Sensor'
    };
  }

  const normalizedId = String(shortId || '').replace(/[_-]+/g, ' ');
  const idLower = normalizedId.toLowerCase();
  if (device.type === 'SmartPlug') {
    if (idLower.includes('ac') || idLower.includes('air conditioner')) return { name: 'Air Conditioner', kind: 'HVAC load' };
    if (idLower.includes('fan')) return { name: 'Ventilation Fan', kind: 'Fan load' };
    if (idLower.includes('server')) return { name: 'Server Rack', kind: 'IT load' };
    if (idLower.includes('lamp') || idLower.includes('light')) return { name: 'Room Lighting', kind: 'Lighting load' };
    if (idLower.includes('heater')) return { name: 'Electric Heater', kind: 'Heating load' };
    return { name: `Controlled Outlet ${escapeHtml(normalizedId)}`, kind: 'Outlet load' };
  }
  if (device.type === 'TemperatureSensor') return { name: 'Temperature Sensor', kind: 'Sensor' };
  if (device.type === 'HumiditySensor') return { name: 'Humidity Sensor', kind: 'Sensor' };
  return { name: escapeHtml(normalizedId || device.type), kind: 'Device' };
}

function processEntities(entities) {
  entities = entities.filter(entity => !isLegacyMatterEntity(entity));
  let entriesHTML = '';
  entities.forEach(entity => {
    let attrs = [];
    for (const key in entity) {
      if (key === 'id' || key === 'type') continue;
      const attr = entity[key];
      const value = attr.value !== undefined ? attr.value : attr;
      const type = attr.type || typeof value;
      attrs.push(`${key}: ${formatVal(value)} (${type})`);
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

  // Render device cards dynamically
  renderDeviceCards(entities);
}

function isLegacyMatterEntity(entity) {
  return /^urn:ngsi-ld:MatterDevice:[123]_1$/.test(String(entity?.id || ''));
}

function ngsiValue(attr, fallback = undefined) {
  return attr && typeof attr === 'object' && Object.prototype.hasOwnProperty.call(attr, 'value')
    ? attr.value
    : (attr ?? fallback);
}

function normalizeOnOffValue(value) {
  return value === true || value === 'true' || value === 'ON' || value === 'on' || value === 1 || value === '1';
}

function entityZoneValue(entity) {
  return ngsiValue(entity?.zone, 'A');
}

function getLiveZoneMetrics(entities, zone = 'A') {
  const zoneEntities = (entities || [])
    .filter(entity => !isLegacyMatterEntity(entity))
    .filter(entity => entityZoneValue(entity) === zone);
  const temperatureSensors = zoneEntities.filter(entity => entity.type === 'TemperatureSensor');
  const humiditySensors = zoneEntities.filter(entity => entity.type === 'HumiditySensor');
  const controlledLoads = zoneEntities.filter(entity => entity.type === 'SmartPlug');
  const maxTemperature = maxNgsiNumber(temperatureSensors, 'temperature');
  const maxHumidity = maxNgsiNumber(humiditySensors, 'measuredValue');
  const maxPower = maxNgsiNumber(controlledLoads, 'activePower');
  const poweredLoads = controlledLoads.filter(entity => normalizeOnOffValue(ngsiValue(entity.onOff))).length;
  const highestPowerLoad = [...controlledLoads]
    .sort((a, b) => Number(ngsiValue(b.activePower, 0)) - Number(ngsiValue(a.activePower, 0)))[0] || null;

  return {
    zone,
    maxTemperature,
    maxHumidity,
    maxPower,
    poweredLoads,
    loadCount: controlledLoads.length,
    highestPowerLoad,
    temperatureSensors,
    humiditySensors,
    controlledLoads
  };
}

function maxNgsiNumber(entities, attribute) {
  const values = entities
    .map(entity => Number(ngsiValue(entity?.[attribute])))
    .filter(value => Number.isFinite(value));
  return values.length ? Math.max(...values) : undefined;
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

  const policyCopy = document.getElementById('safety-policy-copy');
  if (policyCopy && risk.safetyPolicy) {
    const policy = risk.safetyPolicy;
    policyCopy.textContent = policy.autoCriticalActionsEnabled
      ? 'Critical mode is configured for auto simulation; all actions are still logged with ACK/ERROR.'
      : `Critical mode creates an approval request, reminds after ${policy.firstReminderSec}s, and escalates after ${policy.backupEscalationSec}s.`;
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
    const requestedBy = c.requestedBy?.value || '';
    const approvalRequired = c.approvalRequired?.value === true;
    const policy = c.policy?.value || '';
    const shortDevice = device.split(':').pop();
    const meta = [
      requestedBy ? `by ${escapeHtml(requestedBy)}` : '',
      approvalRequired ? 'human approval required' : '',
      policy ? escapeHtml(policy) : ''
    ].filter(Boolean).join(' | ');
    return `
      <div class="command-item">
        <span>
          <strong>${escapeHtml(action)} -> ${escapeHtml(shortDevice)}</strong>
          <small>${escapeHtml(reason)}</small>
          ${meta ? `<em>${meta}</em>` : ''}
        </span>
        <span class="command-status ${(status || '').toLowerCase()}">${escapeHtml(status)}</span>
      </div>`;
  }).join('');
}

// === Simulation ===

async function simulateScenario(mode) {
  const res = await fetch(`${MCP_URL}/tools/simulate_scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario: mode,
      zone: 'A',
      requestedBy: 'dashboard',
      confirmed: true
    })
  });
  if (!res.ok) throw new Error(`MCP returned ${res.status}`);
  const result = await res.json();
  console.log(`[Sim] ${mode}: ${result.status}, audit=${result.auditId || 'N/A'}`);
  return result;
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
