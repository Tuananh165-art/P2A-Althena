const LEVEL_LABEL = {
  normal: '[OK]',
  warning: '[WARNING]',
  critical: '[CRITICAL]'
};

const LEVEL_RANK = { critical: 3, warning: 2, normal: 1 };

function escapeHtml(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function valueOf(v, fallback = '') {
  if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'value')) {
    return v.value ?? fallback;
  }
  return v ?? fallback;
}

function fmtNumber(value, suffix = '') {
  if (value === undefined || value === null || value === '') return 'n/a';
  const n = Number(value);
  if (!Number.isFinite(n)) return escapeHtml(value);
  return `${Number.isInteger(n) ? n : n.toFixed(1)}${suffix}`;
}

function formatActions(actions = []) {
  if (!actions.length) return 'Continue monitoring';
  return actions.map(a => escapeHtml(String(a).replace(/_/g, ' '))).join(', ');
}

function formatRisk(risk) {
  const levelValue = risk.riskLevel || 'normal';
  const label = LEVEL_LABEL[levelValue] || '[UNKNOWN]';
  const level = escapeHtml(String(levelValue).toUpperCase());
  const zone = escapeHtml(risk.zone || 'A');
  const score = risk.riskScore ?? '--';
  const rationale = escapeHtml(risk.rationale || 'No live risk rationale available yet.');
  const source = escapeHtml(risk.reasoningSource || 'rules');
  const confidence = risk.confidence ? `${(risk.confidence * 100).toFixed(0)}%` : 'n/a';
  const metrics = risk.metrics || {};

  let msg = `<b>${label} Zone ${zone}: ${level}</b>\n`;
  msg += `Fire risk score: <b>${score}/100</b> | Confidence: <b>${confidence}</b>\n`;
  msg += `Reasoning source: <b>${source}</b>\n\n`;

  msg += `<b>Live evidence</b>\n`;
  msg += `- Temperature: ${fmtNumber(metrics.maxTemp, ' C')} (warning 40 C, critical 50 C)\n`;
  msg += `- Power load: ${fmtNumber(metrics.maxPower, ' W')} (warning 800 W, critical 950 W)\n`;
  msg += `- Humidity: ${fmtNumber(metrics.maxHumidity, '%')} (warning 75%, critical 90%)\n`;
  msg += `- Load active: ${metrics.hasPlugOn === undefined ? 'n/a' : escapeHtml(metrics.hasPlugOn ? 'yes' : 'no')}\n\n`;

  msg += `<b>Assessment</b>\n${rationale}\n\n`;
  msg += `<b>Recommended response</b>\n${formatActions(risk.recommendedActions)}\n`;

  if (risk.safetyPolicy) {
    const policy = risk.safetyPolicy;
    msg += `\n<b>Safety policy</b>\n`;
    msg += `- Critical action mode: ${escapeHtml(policy.criticalActionMode || 'n/a')}\n`;
    msg += `- Operator approval required: ${escapeHtml(String(policy.sensitiveActionsRequireApproval ?? 'n/a'))}`;
  }

  return msg;
}

function summarizeAlerts(alerts) {
  const counts = { critical: 0, warning: 0, normal: 0 };
  for (const alert of alerts) {
    const level = valueOf(alert.level, 'warning');
    counts[level] = (counts[level] || 0) + 1;
  }
  return counts;
}

function alertKey(alert) {
  return [
    valueOf(alert.level, 'warning'),
    valueOf(alert.zone, 'A'),
    normalizeAlertText(valueOf(alert.message, ''))
  ].join('|');
}

function normalizeAlertText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\d{1,2}:\d{2}:\d{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatAlerts(alerts) {
  if (!alerts.length) {
    return '<b>[OK] No active alerts</b>\nSystem is operating normally. No incident history was returned by MCP.';
  }

  const unique = [];
  const seen = new Set();
  for (const alert of alerts) {
    const key = alertKey(alert);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(alert);
  }

  unique.sort((a, b) => {
    const levelDelta = (LEVEL_RANK[valueOf(b.level, 'warning')] || 0) - (LEVEL_RANK[valueOf(a.level, 'warning')] || 0);
    if (levelDelta) return levelDelta;
    return new Date(valueOf(b.timestamp, 0)).getTime() - new Date(valueOf(a.timestamp, 0)).getTime();
  });

  const counts = summarizeAlerts(unique);
  let msg = `<b>Incident Briefing</b>\n`;
  msg += `Critical: <b>${counts.critical || 0}</b> | Warning: <b>${counts.warning || 0}</b> | Total unique: <b>${unique.length}</b>\n\n`;

  msg += `<b>Most important events</b>\n`;
  unique.slice(0, 6).forEach((a, index) => {
    const level = valueOf(a.level, 'warning');
    const label = LEVEL_LABEL[level] || '[ALERT]';
    const zone = escapeHtml(valueOf(a.zone, '?'));
    const text = escapeHtml(valueOf(a.message, 'No message'));
    const rationale = escapeHtml(valueOf(a.rationale, ''));
    const tsRaw = valueOf(a.timestamp, '');
    const ts = tsRaw ? new Date(tsRaw).toLocaleTimeString('vi-VN') : 'n/a';

    msg += `${index + 1}. <b>${label}</b> Zone ${zone} - ${text}\n`;
    msg += `   Time: ${escapeHtml(ts)}\n`;
    if (rationale) msg += `   Cause: ${rationale.slice(0, 220)}${rationale.length > 220 ? '...' : ''}\n`;
  });

  msg += `\n<b>Operator takeaway</b>\n`;
  if (counts.critical) {
    msg += 'Critical hazard is present. Prioritize load isolation, operator notification, and continuous monitoring.';
  } else if (counts.warning) {
    msg += 'Elevated risk trend detected. Reduce non-essential loads and watch for escalation.';
  } else {
    msg += 'No severe incident in the returned history.';
  }

  return msg;
}

function formatAlertPush(alert) {
  const level = valueOf(alert.level, 'warning');
  const label = LEVEL_LABEL[level] || '[ALERT]';
  const zone = escapeHtml(valueOf(alert.zone, '?'));
  const text = escapeHtml(valueOf(alert.message, 'Alert'));
  const rationale = escapeHtml(valueOf(alert.rationale, ''));
  const ts = new Date().toLocaleTimeString('vi-VN');

  let msg = `<b>${label} REAL-TIME ALERT</b>\n`;
  msg += `Zone: <b>${zone}</b> | Time: <b>${escapeHtml(ts)}</b>\n\n`;
  msg += `<b>What happened</b>\n${text}\n`;
  if (rationale) msg += `\n<b>Why it matters</b>\n${rationale}\n`;
  msg += `\n<b>Suggested response</b>\n`;
  msg += level === 'critical'
    ? 'Isolate risky loads, notify the operator, and verify the dashboard/audit trail.'
    : 'Monitor closely and reduce non-essential electrical load.';
  return msg;
}

function formatDeviceControl(result, context = {}) {
  const statusValue = valueOf(result.status, '');
  const ok = statusValue === 'ACK' || statusValue === 'SIMULATED_ACK' || statusValue === 'CONFIRMED';
  const label = ok ? '[ACTION CONFIRMED]' : '[ACTION FAILED]';
  const action = escapeHtml(valueOf(result.action, ''));
  const deviceId = escapeHtml(valueOf(result.deviceId, ''));
  const status = escapeHtml(statusValue || '');
  const cmdId = escapeHtml(valueOf(result.commandId, 'N/A'));
  const source = escapeHtml(valueOf(result.source, context.source || 'n/a'));
  const requestedBy = escapeHtml(valueOf(result.requestedBy, 'openclaw-telegram'));
  const deviceName = escapeHtml(context.deviceName || deviceId.split(':').pop() || deviceId);
  const reason = escapeHtml(valueOf(result.reason, context.reason || 'Operator requested via OpenClaw'));

  let msg = `<b>${label} Device Control</b>\n`;
  msg += `Target: <b>${deviceName}</b>\n`;
  msg += `Action: <b>${action}</b>\n`;
  msg += `Status: <b>${status}</b> | Source: <b>${source}</b>\n`;
  if (context.selectionReason) {
    msg += `Selection: ${escapeHtml(context.selectionReason)}\n`;
  }
  if (context.selectedPower !== undefined || context.selectedState !== undefined) {
    msg += `Before command: ${escapeHtml(context.selectedState ? 'ON' : 'OFF')}, ${fmtNumber(context.selectedPower, ' W')}\n`;
  }
  if (context.verifiedPower !== undefined || context.verifiedState !== undefined) {
    msg += `Verified after command: ${escapeHtml(context.verifiedState ? 'ON' : 'OFF')}, ${fmtNumber(context.verifiedPower, ' W')}\n`;
  }
  msg += `Reason: ${reason}\n`;
  msg += `Audit ID: <code>${cmdId}</code>\n`;
  msg += `Requested by: ${requestedBy}\n\n`;
  msg += ok
    ? 'Risk reduction: turning this load off removes electrical demand from the hottest/riskier zone and is recorded in MCP/Orion for traceability.'
    : 'The command did not complete. Check device bridge connectivity and retry.';
  return msg;
}

function formatSystemStatus(services, risks, deviceCount, options = {}) {
  const okCount = services.filter(s => s.ok).length;
  const alertCount = options.alertCount ?? 0;
  const entities = options.entities || [];
  const smartPlugs = entities.filter(e => e.type === 'SmartPlug');
  const sensors = entities.filter(e => e.type === 'HumiditySensor' || e.type === 'TemperatureSensor');

  let msg = `<b>OpenClaw Mission Control</b>\n`;
  msg += `Services: <b>${okCount}/${services.length}</b> online | Devices: <b>${deviceCount ?? 'n/a'}</b> | Active alerts: <b>${alertCount}</b>\n\n`;

  msg += `<b>Service health</b>\n`;
  for (const svc of services) {
    const state = svc.ok ? '[OK]' : '[DOWN]';
    const detail = svc.ok ? `HTTP ${svc.status || 200}` : `Error ${svc.status || 'timeout'}`;
    msg += `- ${state} ${escapeHtml(svc.name)}: ${escapeHtml(detail)}\n`;
  }

  if (risks?.length) {
    msg += `\n<b>Zone risk snapshot</b>\n`;
    risks.forEach(r => {
      const label = LEVEL_LABEL[r.riskLevel] || '[UNKNOWN]';
      const metrics = r.metrics || {};
      msg += `- ${label} Zone ${escapeHtml(r.zone)}: ${escapeHtml((r.riskLevel || 'unknown').toUpperCase())} (${r.riskScore ?? '--'}/100)`;
      if (metrics.maxTemp !== undefined || metrics.maxPower !== undefined) {
        msg += ` | ${fmtNumber(metrics.maxTemp, ' C')}, ${fmtNumber(metrics.maxPower, ' W')}`;
      }
      msg += '\n';
    });
  }

  if (smartPlugs.length || sensors.length) {
    msg += `\n<b>Device inventory</b>\n`;
    msg += `- Sensors: ${sensors.length}\n`;
    msg += `- Smart plugs / controllable loads: ${smartPlugs.length}\n`;
    smartPlugs.slice(0, 4).forEach(plug => {
      const name = escapeHtml(plug.id.split(':').pop());
      const onOff = valueOf(plug.onOff, false) ? 'ON' : 'OFF';
      const power = fmtNumber(valueOf(plug.activePower, 0), ' W');
      msg += `  - ${name}: ${onOff}, ${power}\n`;
    });
  }

  msg += `\n<b>Demo value</b>\nThis confirms live telemetry, risk scoring, alerts, and controllable IoT loads are connected through OpenClaw -> MCP -> FIWARE Orion.`;
  return msg;
}

function formatSimulate(mode, result = {}, evaluatedRisk = null) {
  const scenarioDesc = {
    normal: 'Normal operating conditions',
    warning: 'Heat-wave warning with elevated load',
    critical: 'Critical electrical fire-risk scenario'
  };

  let msg = `<b>Simulation Started: ${escapeHtml(String(mode).toUpperCase())}</b>\n`;
  msg += `${escapeHtml(scenarioDesc[mode] || 'Scenario triggered')}\n\n`;

  if (result.values) {
    msg += `<b>Injected telemetry</b>\n`;
    msg += `- Temperature: ${fmtNumber(result.values.temperature, ' C')}\n`;
    msg += `- Humidity: ${fmtNumber(result.values.humidity, '%')}\n`;
    msg += `- Power: ${fmtNumber(result.values.power, ' W')}\n`;
    msg += `- Plug state: ${escapeHtml(result.values.plugOn ? 'ON' : 'OFF')}\n\n`;
  }

  msg += `<b>Audit trail</b>\n`;
  msg += `SimulationRun: <code>${escapeHtml(result.auditId || 'N/A')}</code>\n`;
  msg += `Source: ${escapeHtml(result.source || 'simulator')}\n\n`;

  if (evaluatedRisk) {
    msg += `<b>Immediate MCP evaluation</b>\n`;
    msg += `Zone ${escapeHtml(evaluatedRisk.zone || 'A')}: <b>${escapeHtml(String(evaluatedRisk.riskLevel || 'unknown').toUpperCase())}</b> (${evaluatedRisk.riskScore ?? '--'}/100)\n`;
    msg += `${escapeHtml(evaluatedRisk.rationale || '')}\n`;
    if (evaluatedRisk.recommendedActions?.length) {
      msg += `Actions: ${formatActions(evaluatedRisk.recommendedActions)}\n`;
    }
  } else {
    msg += '<b>Next</b>\nMCP will evaluate this on the next poll cycle and push alerts to Telegram when thresholds are crossed.';
  }

  return msg;
}

function formatSkillHelp(skills = []) {
  let msg = `<b>Climate Resilience Copilot - OpenClaw</b>\n`;
  msg += 'I monitor climate-driven electrical fire risk using IoT telemetry, FIWARE context, MCP tools, alerts, simulation, and device control.\n\n';
  if (skills.length) {
    msg += `<b>Loaded skills: ${skills.length}</b>\n`;
    skills.forEach(skill => {
      const trigger = skill.triggers?.slice(0, 4).join(', ') || skill.trigger || '';
      msg += `- <b>${escapeHtml(skill.name)}</b>: ${escapeHtml(skill.description || trigger)}\n`;
    });
  }
  msg += '\n<b>Try</b>\n';
  msg += '- Run a full system health check\n';
  msg += '- What is the current fire risk in Zone A?\n';
  msg += '- Simulate a critical fire-risk scenario\n';
  msg += '- Show latest critical alerts\n';
  msg += '- Turn off the highest-risk load in Zone A';
  return msg;
}

module.exports = {
  formatRisk,
  formatAlerts,
  formatAlertPush,
  formatDeviceControl,
  formatSystemStatus,
  formatSimulate,
  formatHelp: formatSkillHelp,
  escapeHtml,
  LEVEL_LABEL
};
