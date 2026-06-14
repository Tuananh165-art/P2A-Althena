const LEVEL_EMOJI = { normal: '✅', warning: '⚠️', critical: '🔴' };

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatRisk(risk) {
  const emoji = LEVEL_EMOJI[risk.riskLevel] || '❓';
  const level = escapeHtml((risk.riskLevel || 'unknown').toUpperCase());
  const zone = escapeHtml(risk.zone || 'A');
  const score = risk.riskScore ?? '--';
  const rationale = escapeHtml(risk.rationale || 'No data');
  const source = escapeHtml(risk.reasoningSource || 'rules');
  const confidence = risk.confidence ? `${(risk.confidence * 100).toFixed(0)}%` : '';

  let msg = `${emoji} <b>Zone ${zone}: ${level}</b>\n`;
  msg += `Fire Risk Score: <b>${score}/100</b>\n\n`;
  msg += `${rationale}\n`;

  if (risk.recommendedActions?.length) {
    msg += `\n<b>Actions:</b> ${escapeHtml(risk.recommendedActions.join(', '))}`;
  }
  if (confidence) {
    msg += `\n<b>Confidence:</b> ${confidence}`;
  }
  msg += `\n<b>Source:</b> ${source}`;
  return msg;
}

function formatAlerts(alerts) {
  if (!alerts.length) {
    return '✅ No active alerts. System operating normally.';
  }

  let msg = `<b>Recent Alerts (${alerts.length})</b>\n\n`;
  alerts.forEach(a => {
    const level = a.level?.value || 'warning';
    const emoji = LEVEL_EMOJI[level] || '❓';
    const zone = escapeHtml(a.zone?.value || '?');
    const text = escapeHtml(a.message?.value || 'No message');
    const ts = a.timestamp?.value
      ? new Date(a.timestamp.value).toLocaleTimeString('vi-VN')
      : '';
    msg += `${emoji} <b>[${escapeHtml(level.toUpperCase())}]</b> Zone ${zone}: ${text}\n`;
    msg += `   <i>${escapeHtml(ts)}</i>\n\n`;
  });

  return msg.trim();
}

function formatAlertPush(alert) {
  const level = alert.level?.value || alert.level || 'warning';
  const emoji = LEVEL_EMOJI[level] || '❓';
  const zone = escapeHtml(alert.zone?.value || alert.zone || '?');
  const text = escapeHtml(alert.message?.value || alert.message || 'Alert');
  const rationale = escapeHtml(alert.rationale?.value || alert.rationale || '');
  const ts = new Date().toLocaleTimeString('vi-VN');

  let msg = `⚠️ <b>ALERT NOTIFICATION</b> ⚠️\n\n`;
  msg += `${emoji} <b>${escapeHtml(level.toUpperCase())}</b> - Zone ${zone}\n`;
  msg += `${text}\n`;
  if (rationale) msg += `\n${rationale}\n`;
  msg += `\n<i>${escapeHtml(ts)}</i>`;
  return msg;
}

function formatDeviceControl(result) {
  const value = v => (v && typeof v === 'object' && 'value' in v) ? v.value : v;
  const statusValue = value(result.status);
  const ok = statusValue === 'ACK' || statusValue === 'SIMULATED_ACK';
  const emoji = ok ? '✅' : '❌';
  const action = escapeHtml(value(result.action) || '');
  const deviceId = escapeHtml(value(result.deviceId) || '');
  const status = escapeHtml(statusValue || '');
  const cmdId = escapeHtml(value(result.commandId) || 'N/A');

  return `${emoji} <b>Device Control</b>\n` +
    `Action: ${action}\n` +
    `Device: ${deviceId}\n` +
    `Status: ${status}\n` +
    `Command ID: ${cmdId}`;
}

function formatSystemStatus(services, risks, deviceCount) {
  let msg = `<b>🌍 Climate Resilience Copilot Status</b>\n`;
  msg += `${'='.repeat(32)}\n\n`;
  msg += `<b>Services:</b>\n`;

  for (const svc of services) {
    const emoji = svc.ok ? '✅' : '❌';
    const detail = svc.ok ? 'Connected' : `Error ${svc.status || 'timeout'}`;
    msg += `${emoji} ${escapeHtml(svc.name)}: ${detail}\n`;
  }

  if (risks?.length) {
    msg += `\n<b>Risk Assessment:</b>\n`;
    risks.forEach(r => {
      const emoji = LEVEL_EMOJI[r.riskLevel] || '❓';
      msg += `${emoji} Zone ${escapeHtml(r.zone)}: ${escapeHtml((r.riskLevel || 'unknown').toUpperCase())} (${r.riskScore ?? '--'}/100)\n`;
    });
  }

  if (deviceCount !== undefined) {
    msg += `\n<b>Devices Online:</b> ${deviceCount}`;
  }

  return msg;
}

function formatSimulate(mode, injected) {
  const modeEmoji = { normal: '✅', warning: '⚠️', critical: '🔴' };
  const emoji = modeEmoji[mode] || '❓';
  const scenarioDesc = {
    normal: 'Normal conditions — all sensors within safe range',
    warning: 'Heat wave warning — temperature rising, electrical load increasing',
    critical: 'CRITICAL fire risk — extreme heat + electrical overload detected'
  };

  let msg = `${emoji} <b>${escapeHtml(scenarioDesc[mode] || 'Scenario triggered')}</b>\n\n`;
  if (injected) {
    msg += `Injected: ${escapeHtml(injected)}\n`;
  }
  msg += `MCP Agent will evaluate fire risk on next poll cycle.\n`;
  msg += `Watch the dashboard for real-time risk assessment.`;
  return msg;
}

function formatHelp() {
  return `<b>🔥 Climate Resilience Copilot — OpenClaw</b>\n\n` +
    `I detect electrical fire risk from climate-driven heat waves.\n\n` +
    `<b>Available commands:</b>\n` +
    `• <b>Fire risk:</b> "What's the fire risk level?"\n` +
    `• <b>Alerts:</b> "Show recent alerts"\n` +
    `• <b>Device control:</b> "Turn off the smart plug"\n` +
    `• <b>System health:</b> "Check system status"\n` +
    `• <b>Simulation:</b> "Simulate critical fire scenario"\n\n` +
    `<i>Try: risk, alerts, status, simulate, turn on/off</i>`;
}

function formatSkillHelp(skills = []) {
  if (skills.length) {
    let msg = `<b>Climate Resilience Copilot - OpenClaw</b>\n\n`;
    msg += `Loaded skills: <b>${skills.length}</b>\n\n`;
    msg += `<b>Available commands:</b>\n`;
    skills.forEach(skill => {
      const trigger = skill.triggers?.slice(0, 4).join(', ') || skill.trigger || '';
      msg += `- <b>${escapeHtml(skill.name)}:</b> ${escapeHtml(trigger)}\n`;
    });
    msg += `\n<i>Thu: rui ro, canh bao, trang thai, mo phong, bat/tat o cam</i>`;
    return msg;
  }

  return formatHelp();
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
  LEVEL_EMOJI
};
