/* Simulator page logic */
document.addEventListener('DOMContentLoaded', () => {
  renderNav('simulator');
  checkOrionConnection();
  checkMCPConnection();

  setInterval(() => fetchEntities((entities) => {
    document.getElementById('debug-json').textContent = JSON.stringify(entities, null, 2);
  }), REFRESH_INTERVAL);

  setInterval(() => fetchRisk((risk) => {
    document.getElementById('risk-json').textContent = JSON.stringify(risk, null, 2);
  }), REFRESH_INTERVAL);

  const panels = document.getElementById('info-panels');
  if (panels) {
    panels.innerHTML = createInfoPanel('Risk Score Calculation Algorithm', `
      <p style="margin-bottom:12px;color:var(--text-secondary);font-size:13px;">The MCP Agent's RiskEngine computes a fire risk score (0&ndash;100) per zone using these rules:</p>
      <table>
        <tr><th>Condition</th><th>Points</th><th>Category</th></tr>
        <tr><td>Temperature &gt;= 50&deg;C</td><td><strong>+40</strong></td><td>Critical fire risk &mdash; wiring overheat</td></tr>
        <tr><td>Temperature &gt;= 40&deg;C</td><td><strong>+20</strong></td><td>Warning &mdash; heat stress on insulation</td></tr>
        <tr><td>Power &gt;= 950W</td><td><strong>+30</strong></td><td>Critical &mdash; near circuit capacity</td></tr>
        <tr><td>Power &gt;= 800W</td><td><strong>+15</strong></td><td>Warning &mdash; elevated load</td></tr>
        <tr><td>Temp &gt;= 40&deg;C + Power &gt;= 800W</td><td><strong>+25</strong></td><td>Compound &mdash; heat wave overload</td></tr>
        <tr><td>Temp &gt;= 50&deg;C + Power &gt;= 950W</td><td><strong>+10</strong></td><td>Critical combo &mdash; imminent fire</td></tr>
        <tr><td>Humidity &gt;= 90% + Power &gt;= 800W</td><td><strong>+15</strong></td><td>Moisture short circuit risk</td></tr>
        <tr><td>Humidity &gt;= 75%</td><td><strong>+5</strong></td><td>Elevated moisture</td></tr>
      </table>
      <h4 style="margin-top:16px;color:var(--accent-bright);font-size:13px;font-weight:600;">Threshold Classification</h4>
      <table>
        <tr><th>Score Range</th><th>Level</th><th>Response</th></tr>
        <tr><td>70&ndash;100</td><td style="color:var(--danger);font-weight:700">CRITICAL</td><td>CUT_POWER + ALERT_LAMP + NOTIFY + EVACUATE</td></tr>
        <tr><td>35&ndash;69</td><td style="color:var(--warning);font-weight:700">WARNING</td><td>REDUCE_LOAD + NOTIFY_OPERATOR</td></tr>
        <tr><td>0&ndash;34</td><td style="color:var(--success);font-weight:700">NORMAL</td><td>No action required</td></tr>
      </table>
    `) + createInfoPanel('Simulation Scenarios', `
      <table>
        <tr><th>Scenario</th><th>Temperature</th><th>Power</th><th>Humidity</th><th>Expected Result</th></tr>
        <tr><td style="color:var(--success)">Normal</td><td>25&ndash;33&deg;C</td><td>50&ndash;150W</td><td>45&ndash;65%</td><td>Score ~5, NORMAL</td></tr>
        <tr><td style="color:var(--warning)">Warning</td><td>41&ndash;47&deg;C</td><td>810&ndash;910W</td><td>76&ndash;86%</td><td>Score ~55, WARNING</td></tr>
        <tr><td style="color:var(--danger)">Critical</td><td>51&ndash;59&deg;C</td><td>960&ndash;1000W</td><td>91&ndash;99%</td><td>Score ~100, CRITICAL</td></tr>
      </table>
    `);
  }
});
