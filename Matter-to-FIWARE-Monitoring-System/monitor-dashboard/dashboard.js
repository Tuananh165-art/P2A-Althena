/* Operations dashboard page logic */
const dashboardHistory = {
  temperature: [],
  humidity: []
};

document.addEventListener('DOMContentLoaded', () => {
  window.deviceControlResults = window.deviceControlResults || {};
  checkOrionConnection();
  checkMCPConnection();
  bindDashboardControls();
  bindDashboardDeviceControls();
  refreshDashboard();

  setInterval(refreshDashboard, REFRESH_INTERVAL);
});

function bindDashboardDeviceControls() {
  const grid = document.getElementById('devices-grid');
  grid?.addEventListener('click', async event => {
    const button = event.target.closest('.device-power-button');
    if (!button || button.disabled) return;

    const deviceId = decodeURIComponent(button.dataset.deviceId);
    const action = button.dataset.action;
    const result = button.parentElement.querySelector('.device-control-result');
    const label = button.querySelector('span:last-child');
    const originalLabel = label.textContent;

    button.disabled = true;
    button.classList.add('is-pending');
    label.textContent = 'Sending...';
    window.deviceControlResults[deviceId] = {
      text: 'Waiting for device state',
      className: 'pending'
    };
    if (result) {
      result.textContent = 'Waiting for device state';
      result.className = 'device-control-result pending';
    }

    try {
      const response = await fetch(`${MCP_URL}/tools/invoke_command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          action,
          reason: 'Manual operator control from Overview',
          requestedBy: 'dashboard',
          confirmed: true
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

      const status = payload.status?.value || payload.status || 'PENDING';
      const error = payload.error?.value || payload.error || '';
      window.deviceControlResults[deviceId] = {
        text: error ? `${status}: ${error}` : status,
        className: String(status).toLowerCase()
      };
      refreshDashboard();
    } catch (error) {
      window.deviceControlResults[deviceId] = {
        text: `FAILED: ${error.message}`,
        className: 'failed'
      };
      label.textContent = originalLabel;
      refreshDashboard();
    } finally {
      button.disabled = false;
      button.classList.remove('is-pending');
    }
  });
}

function refreshDashboard() {
  fetchEntities(entities => {
    processEntities(entities);
    updateDashboardMetrics(entities);
  });
  fetchRisk(risk => {
    updateRiskUI(risk);
    updateDashboardRisk(risk);
  });
  fetchAlerts(5, updateAlertsUI);
  fetchCommands(4, updateCommandsUI);
}

function updateDashboardMetrics(entities) {
  const metrics = getLiveZoneMetrics(entities, 'A');
  const tempValue = metrics.maxTemperature;
  const humidityValue = metrics.maxHumidity;
  const powerValue = metrics.maxPower;
  const poweredLoads = metrics.poweredLoads;
  const controlledLoads = metrics.controlledLoads;

  setDashboardText('summary-temp', formatMetric(tempValue, 1));
  setDashboardText('summary-humidity', formatMetric(humidityValue, 1));
  setDashboardText('summary-power', formatMetric(powerValue, 0));
  setDashboardText('summary-temp-state', metricState(tempValue, 40, 50));
  setDashboardText('summary-humidity-state', metricState(humidityValue, 75, 90));
  setDashboardText(
    'summary-plug-state',
    controlledLoads.length ? `${poweredLoads}/${controlledLoads.length} loads on` : 'No loads'
  );

  const powerLine = document.getElementById('summary-power-line');
  if (powerLine) {
    powerLine.style.width = `${Math.min(100, Math.max(0, Number(powerValue || 0) / 10))}%`;
    powerLine.style.background = poweredLoads > 0 ? '#43c7cc' : '#667386';
  }

  pushHistory(dashboardHistory.temperature, tempValue);
  pushHistory(dashboardHistory.humidity, humidityValue);
  renderSparkline('temp-sparkline', dashboardHistory.temperature, 65);
  renderSparkline('humidity-sparkline', dashboardHistory.humidity, 100);
}

function updateDashboardRisk(risk) {
  const score = Number(risk.riskScore ?? 0);
  const level = String(risk.riskLevel || 'normal').toLowerCase();
  const color = level === 'critical' ? '#d94b58' : level === 'warning' ? '#d3911f' : '#46c87a';

  setDashboardText('summary-risk-score', risk.riskScore ?? '--');
  setDashboardText('summary-risk-level', level.toUpperCase());

  const meter = document.getElementById('summary-risk-meter');
  if (meter) {
    meter.style.width = `${Math.min(100, Math.max(0, score))}%`;
    meter.style.background = color;
  }

  const levelEl = document.getElementById('summary-risk-level');
  if (levelEl) levelEl.style.color = color;
}

function bindDashboardControls() {
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', async () => {
      await runDashboardAction(button, () => simulateScenario(button.dataset.mode));
    });
  });

  const evaluateButton = document.getElementById('evaluate-action');
  evaluateButton?.addEventListener('click', async () => {
    await runDashboardAction(evaluateButton, triggerEvaluate);
  });
}

async function runDashboardAction(button, action) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Running...';
  try {
    await action();
    await delayDashboard(500);
    refreshDashboard();
  } catch (error) {
    console.error('[Dashboard] action failed:', error);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function getEntityValue(entity, attribute) {
  if (!entity) return undefined;
  return ngsiValue(entity[attribute]);
}

function maxEntityValue(entities, attribute) {
  const values = entities
    .map(entity => Number(getEntityValue(entity, attribute)))
    .filter(value => Number.isFinite(value));
  return values.length ? Math.max(...values) : undefined;
}

function metricState(value, warning, critical) {
  if (value === undefined || value === null) return 'Waiting';
  if (Number(value) >= critical) return 'Critical';
  if (Number(value) >= warning) return 'Warning';
  return 'Normal';
}

function formatMetric(value, decimals) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(decimals);
}

function pushHistory(series, value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return;
  series.push(Number(value));
  if (series.length > 16) series.shift();
}

function renderSparkline(id, series, max) {
  const container = document.getElementById(id);
  if (!container) return;
  const values = series.length ? series : [0, 0, 0, 0, 0, 0, 0, 0];
  container.innerHTML = values.map(value => {
    const height = Math.max(8, Math.min(100, (Number(value) / max) * 100));
    return `<i style="height:${height}%"></i>`;
  }).join('');
}

function setDashboardText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function delayDashboard(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
