/* Devices page logic */
document.addEventListener('DOMContentLoaded', () => {
  renderNav('devices');
  checkOrionConnection();
  setInterval(() => fetchEntities(processEntities), REFRESH_INTERVAL);

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
