/* Devices page logic */
document.addEventListener('DOMContentLoaded', () => {
  window.deviceControlResults = window.deviceControlResults || {};
  checkOrionConnection();
  setInterval(() => fetchEntities(processEntities), REFRESH_INTERVAL);
  fetchEntities(processEntities);

  const grid = document.getElementById('devices-grid');
  grid?.addEventListener('click', async event => {
    const button = event.target.closest('.device-power-button');
    if (!button || button.disabled) return;

    const deviceId = decodeURIComponent(button.dataset.deviceId);
    const action = button.dataset.action;
    const result = button.parentElement.querySelector('.device-control-result');
    const originalLabel = button.querySelector('span:last-child').textContent;

    button.disabled = true;
    button.classList.add('is-pending');
    button.querySelector('span:last-child').textContent = 'Sending...';
    if (result) {
      result.textContent = 'Waiting for device state';
      result.className = 'device-control-result pending';
    }
    window.deviceControlResults[deviceId] = {
      text: 'Waiting for device state',
      className: 'pending'
    };

    try {
      const response = await fetch(`${MCP_URL}/tools/invoke_command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          action,
          reason: 'Manual operator control from Devices page',
          requestedBy: 'dashboard',
          confirmed: true
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

      const status = payload.status?.value || payload.status || 'PENDING';
      const error = payload.error?.value || payload.error || '';
      if (result) {
        result.textContent = error ? `${status}: ${error}` : status;
        result.className = `device-control-result ${String(status).toLowerCase()}`;
      }
      window.deviceControlResults[deviceId] = {
        text: error ? `${status}: ${error}` : status,
        className: String(status).toLowerCase()
      };

      await fetchEntities(processEntities);
    } catch (error) {
      if (result) {
        result.textContent = `FAILED: ${error.message}`;
        result.className = 'device-control-result failed';
      }
      window.deviceControlResults[deviceId] = {
        text: `FAILED: ${error.message}`,
        className: 'failed'
      };
      button.querySelector('span:last-child').textContent = originalLabel;
    } finally {
      button.disabled = false;
      button.classList.remove('is-pending');
    }
  });

  const panels = document.getElementById('info-panels');
  if (panels) {
    panels.innerHTML = createInfoPanel('Matter Event Fields Reference', `
      <table>
        <tr><th>Field</th><th>Description</th><th>Example</th></tr>
        <tr><td><code>nodeId</code></td><td>Device identifier</td><td>3 (Temperature Sensor)</td></tr>
        <tr><td><code>endpointId</code></td><td>Endpoint on device (usually 1)</td><td>1</td></tr>
        <tr><td><code>clusterId</code></td><td>Matter cluster ID (hex)</td><td>0x0402 (Temperature)</td></tr>
        <tr><td><code>attributeName</code></td><td>The attribute being reported</td><td>temperature</td></tr>
        <tr><td><code>attributeValue</code></td><td>Current sensor value</td><td>42.5</td></tr>
        <tr><td><code>timestamp</code></td><td>ISO 8601 timestamp</td><td>2026-05-06T10:30:00Z</td></tr>
      </table>
    `) + createInfoPanel('Matter Cluster ID Reference', `
      <table>
        <tr><th>Cluster ID</th><th>Name</th><th>Attributes</th></tr>
        <tr><td><code>0x0006</code></td><td>On/Off</td><td>onOff (Boolean)</td></tr>
        <tr><td><code>0x0402</code></td><td>Temperature Measurement</td><td>temperature (Number, &deg;C)</td></tr>
        <tr><td><code>0x0405</code></td><td>Humidity Measurement</td><td>measuredValue (Number, %RH)</td></tr>
        <tr><td><code>0x0B04</code></td><td>Electrical Measurement</td><td>activePower (Number, W)</td></tr>
      </table>
    `) + createInfoPanel('NGSI-v2 Entity Structure', `
      <p style="margin-bottom:8px;color:var(--text-secondary);font-size:13px;">Each IoT device is represented as an NGSI-v2 entity in FIWARE Orion:</p>
<pre>{
  "id": "urn:ngsi-ld:MatterDevice:3_1",
  "type": "TemperatureSensor",
  "temperature": {
    "type": "Number",
    "value": 42.5,
    "metadata": {
      "unit": { "type": "string", "value": "&deg;C" },
      "timestamp": { "type": "string", "value": "..." }
    }
  }
}</pre>
      <p style="margin-top:10px;color:var(--text-tertiary);font-size:12px;">
        <strong>Entity ID format:</strong> <code>urn:ngsi-ld:MatterDevice:{nodeId}_{endpointId}</code><br>
        <strong>Data flow:</strong> Device &rarr; Matter Event &rarr; FIMAT Agent &rarr; NGSI-v2 &rarr; Orion &rarr; Dashboard
      </p>
    `);
  }
});
