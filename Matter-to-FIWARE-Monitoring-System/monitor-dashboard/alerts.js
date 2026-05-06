/* Alerts page logic */
let allAlerts = [];
let allCommands = [];

document.addEventListener('DOMContentLoaded', () => {
  renderNav('alerts');
  checkOrionConnection();
  checkMCPConnection();

  setInterval(() => fetchAlerts(50, (alerts) => { allAlerts = alerts; filterAlerts(); }), REFRESH_INTERVAL);
  setInterval(() => fetchCommands(50, (cmds) => { allCommands = cmds; updateCommandsUI(cmds); }), REFRESH_INTERVAL);

  const panels = document.getElementById('info-panels');
  if (panels) {
    panels.innerHTML = createInfoPanel('Alert Levels Reference', `
      <table>
        <tr><th>Level</th><th>Score Range</th><th>Meaning</th><th>Auto-Actions</th></tr>
        <tr><td><code style="color:var(--success)">normal</code></td><td>0&ndash;34</td><td>All indicators safe</td><td>None</td></tr>
        <tr><td><code style="color:var(--warning)">warning</code></td><td>35&ndash;69</td><td>Elevated risk, monitor closely</td><td>REDUCE_LOAD, NOTIFY_OPERATOR</td></tr>
        <tr><td><code style="color:var(--danger)">critical</code></td><td>70&ndash;100</td><td>Imminent fire risk</td><td>CUT_POWER, ALERT_LAMP, EVACUATE</td></tr>
      </table>
    `) + createInfoPanel('Command Execution Flow', `
      <pre>1. Risk Engine detects critical/warning level
   &darr;
2. MCP Agent creates command: { deviceId, action, reason }
   &darr;
3. CommandExecutor processes command
   &darr;
4. Status recorded: ACK (success) or ERROR (failure)
   &darr;
5. CommandExecution entity upserted to Orion
   &darr;
6. Dashboard displays command with status badge</pre>
      <table style="margin-top:12px">
        <tr><th>Action</th><th>Target Device</th><th>Description</th></tr>
        <tr><td><code>CUT_POWER_IMMEDIATELY</code></td><td>Smart Plug (2_1)</td><td>Emergency power cut</td></tr>
        <tr><td><code>REDUCE_LOAD</code></td><td>Smart Plug (2_1)</td><td>Reduce electrical load</td></tr>
        <tr><td><code>TURN_ON_ALERT_LAMP</code></td><td>Lamp (1_1)</td><td>Activate visual alarm</td></tr>
        <tr><td><code>NOTIFY_OPERATOR</code></td><td>System</td><td>Send notification</td></tr>
        <tr><td><code>EVACUATE_ZONE</code></td><td>Zone</td><td>Trigger evacuation protocol</td></tr>
      </table>
    `);
  }
});

function filterAlerts() {
  const level = document.getElementById('alert-filter').value;
  const search = document.getElementById('alert-search').value.toLowerCase();
  let filtered = allAlerts;
  if (level !== 'all') filtered = filtered.filter(a => (a.level?.value || '') === level);
  if (search) filtered = filtered.filter(a => {
    const msg = (a.message?.value || '').toLowerCase();
    const rationale = (a.rationale?.value || '').toLowerCase();
    return msg.includes(search) || rationale.includes(search);
  });
  updateAlertsUI(filtered);
}
