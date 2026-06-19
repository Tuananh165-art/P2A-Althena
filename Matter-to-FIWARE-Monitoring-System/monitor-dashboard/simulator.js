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
        <tr><th>Scenario</th><th>Source</th><th>Injected Zone A Metrics</th><th>Purpose</th></tr>
        <tr><td style="color:var(--success)">normal</td><td><code>sim-seed/normal.json</code></td><td>max temp 24.3&deg;C, max power 91W, max humidity 49.9%</td><td>Seed baseline</td></tr>
        <tr><td style="color:var(--warning)">heat-wave</td><td><code>sim-seed/heat-wave.json</code></td><td>max temp 32.1&deg;C, max power 135.2W, max humidity 49.7%</td><td>Climate stress seed</td></tr>
        <tr><td style="color:var(--danger)">overload</td><td><code>sim-seed/overload.json</code></td><td>max temp 27.9&deg;C, max power 1053.6W, max humidity 49.4%</td><td>Electrical load seed</td></tr>
        <tr><td>noisy</td><td><code>sim-seed/noisy.json</code></td><td>max temp 26.2&deg;C, max power 92.7W, max humidity 53.6%</td><td>Noisy sensor seed</td></tr>
        <tr><td>offline</td><td><code>sim-seed/offline.json</code></td><td>max temp 24.3&deg;C, max power 82.1W, max humidity 51.8%</td><td>Offline/degraded seed</td></tr>
        <tr><td style="color:var(--danger)">critical</td><td>built-in demo fallback</td><td>temp 55&deg;C, power 980W, humidity 95%</td><td>Judge demo critical fire-risk injection</td></tr>
      </table>
    `);
  }
});
