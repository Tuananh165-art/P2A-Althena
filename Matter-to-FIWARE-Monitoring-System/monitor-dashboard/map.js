/* Map page logic — Leaflet.js smart city map */
let cityMap = null;
const deviceMarkers = {};
const deviceTrails = {};
const devicePositions = {};

const DEFAULT_POSITIONS = {
  'urn:ngsi-ld:HumiditySensor:ZoneA_Room102_Sensor1': { lat: 10.8231, lng: 106.6297, name: 'Humidity Sensor', type: 'sensor' },
  'urn:ngsi-ld:SmartPlug:ZoneA_Room102_AC': { lat: 10.8245, lng: 106.6310, name: 'Smart Plug (AC)', type: 'plug' },
  'urn:ngsi-ld:SmartPlug:ZoneA_Room102_Server': { lat: 10.8250, lng: 106.6320, name: 'Smart Plug (Server)', type: 'plug' },
  'urn:ngsi-ld:SmartPlug:ZoneA_Room102_Fan': { lat: 10.8240, lng: 106.6300, name: 'Smart Plug (Fan)', type: 'plug' },
  'urn:ngsi-ld:TemperatureSensor:ZoneA_Room102_Wiring': { lat: 10.8220, lng: 106.6285, name: 'Temperature Sensor', type: 'temp' },
  'urn:ngsi-ld:TemperatureSensor:ZoneA_Outdoor_Ambient': { lat: 10.8260, lng: 106.6330, name: 'Ambient Temp', type: 'temp' }
};

const ZONE_A_COORDS = [
  [10.820, 106.626], [10.820, 106.634],
  [10.828, 106.634], [10.828, 106.626]
];

document.addEventListener('DOMContentLoaded', () => {
  renderNav('map');
  checkOrionConnection();
  setInterval(() => fetchEntities(() => {}), REFRESH_INTERVAL);
  setTimeout(initMap, 300);
});

function initMap() {
  cityMap = L.map('city-map', { zoomControl: true, scrollWheelZoom: true })
    .setView([10.8231, 106.6297], 15);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM &copy; CARTO',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(cityMap);

  L.polygon(ZONE_A_COORDS, {
    color: '#8b7cf7', fillColor: '#4a4090', fillOpacity: 0.12, weight: 2, dashArray: '6, 4'
  }).addTo(cityMap).bindPopup('<div class="popup-title">Zone A</div><div class="popup-attr">Main monitoring area</div>');

  L.marker([10.824, 106.630], {
    icon: L.divIcon({
      className: 'zone-label',
      html: '<div style="color:#a599ff;font-weight:700;font-size:13px;letter-spacing:1px;text-shadow:0 0 12px rgba(0,0,0,0.9);">ZONE A</div>',
      iconSize: [80, 20], iconAnchor: [40, 10]
    })
  }).addTo(cityMap);

  Object.entries(DEFAULT_POSITIONS).forEach(([entityId, pos]) => {
    devicePositions[entityId] = { ...pos, history: [] };
    createDeviceMarker(entityId, pos);
  });

  cityMap.on('click', function(e) {
    document.getElementById('map-coords').textContent =
      `Lat: ${e.latlng.lat.toFixed(4)}, Lng: ${e.latlng.lng.toFixed(4)}`;
  });

  setInterval(updateMapFromEntities, 5000);
  updateLocationDisplay();
}

function createDeviceMarker(entityId, pos) {
  const colors = { sensor: '#7c8dff', plug: '#c2ef4e', temp: '#fa7faa' };
  const labels = { sensor: 'H', plug: 'P', temp: 'T' };
  const color = colors[pos.type] || '#8b7cf7';
  const label = labels[pos.type] || '?';

  const icon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 12px ${color}80;display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:bold;">${label}</div>`,
    iconSize: [24, 24], iconAnchor: [12, 12]
  });

  const marker = L.marker([pos.lat, pos.lng], { icon, draggable: true })
    .addTo(cityMap)
    .bindPopup(`<div class="popup-title">${pos.name}</div><div class="popup-attr">${entityId}</div>`);

  deviceTrails[entityId] = L.polyline([], { color, weight: 2, opacity: 0.6, dashArray: '4, 4' }).addTo(cityMap);

  marker.on('dragend', function(e) {
    const newPos = e.target.getLatLng();
    devicePositions[entityId].lat = newPos.lat;
    devicePositions[entityId].lng = newPos.lng;
    updateLocationDisplay();
    document.getElementById('map-coords').textContent = `Lat: ${newPos.lat.toFixed(4)}, Lng: ${newPos.lng.toFixed(4)}`;
  });

  deviceMarkers[entityId] = marker;
}

function updateMapFromEntities() {
  Object.entries(state.entities).forEach(([entityId, entity]) => {
    if (!['HumiditySensor', 'SmartPlug', 'TemperatureSensor'].includes(entity.type)) return;
    if (isLegacyMatterEntity(entity)) return;

    if (!devicePositions[entityId]) {
      // Dynamic placement inside Zone A if no coordinates exist
      let lat = 10.8231 + (Math.random() - 0.5) * 0.003;
      let lng = 106.6297 + (Math.random() - 0.5) * 0.003;
      if (entity.location?.value?.coordinates) {
        const [elng, elat] = entity.location.value.coordinates;
        lat = elat;
        lng = elng;
      }
      const typeMap = { HumiditySensor: 'sensor', SmartPlug: 'plug', TemperatureSensor: 'temp' };
      const shortId = entityId.split(':').pop().replace(/_/g, ' ');

      devicePositions[entityId] = {
        lat,
        lng,
        name: shortId,
        type: typeMap[entity.type] || 'sensor',
        history: []
      };
      createDeviceMarker(entityId, devicePositions[entityId]);
    } else if (entity.location?.value?.coordinates) {
      const [lng, lat] = entity.location.value.coordinates;
      devicePositions[entityId].lat = lat;
      devicePositions[entityId].lng = lng;
      updateMarkerPosition(entityId);
    }

    const marker = deviceMarkers[entityId];
    if (marker) {
      let popup = `<div class="popup-title">${devicePositions[entityId].name}</div>`;
      for (const key in entity) {
        if (key === 'id' || key === 'type' || key === 'location' || key === 'zone') continue;
        const val = entity[key].value !== undefined ? entity[key].value : entity[key];
        popup += `<div class="popup-attr">${key}: ${typeof val === 'number' ? val.toFixed(1) : val}</div>`;
      }
      marker.setPopupContent(popup);
    }
  });
  updateLocationDisplay();
}

function updateMarkerPosition(entityId) {
  const pos = devicePositions[entityId];
  const marker = deviceMarkers[entityId];
  if (!marker || !pos) return;
  marker.setLatLng([pos.lat, pos.lng]);
  pos.history.push([pos.lat, pos.lng]);
  if (pos.history.length > 20) pos.history.shift();
  if (deviceTrails[entityId]) deviceTrails[entityId].setLatLngs(pos.history);
}

function updateLocationDisplay() {
  const container = document.getElementById('device-locations');
  let html = '';
  Object.entries(devicePositions).forEach(([entityId, pos]) => {
    const shortId = entityId.split(':').pop();
    const online = !!state.entities[entityId];
    html += `<div class="device-location-card">
      <div class="device-name">${pos.name} (${shortId})</div>
      <div class="device-coords">${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}</div>
      <div class="device-status" style="color:${online ? 'var(--success)' : 'var(--text-muted)'}">${online ? 'Online' : 'Offline'}</div>
    </div>`;
  });
  container.innerHTML = html || '<p class="no-data">No devices</p>';
}

function simulateDeviceMovement() {
  Object.keys(devicePositions).forEach((entityId, i) => {
    const pos = devicePositions[entityId];
    let steps = 10;
    let lat = pos.lat, lng = pos.lng;
    const interval = setInterval(() => {
      lat += (Math.random() - 0.5) * 0.001;
      lng += (Math.random() - 0.5) * 0.001;
      lat = Math.max(10.820, Math.min(10.828, lat));
      lng = Math.max(106.626, Math.min(106.634, lng));
      devicePositions[entityId].lat = lat;
      devicePositions[entityId].lng = lng;
      updateMarkerPosition(entityId);
      updateLocationDisplay();
      if (--steps <= 0) clearInterval(interval);
    }, 500 + i * 200);
  });
}

function resetDevicePositions() {
  Object.entries(DEFAULT_POSITIONS).forEach(([entityId, pos]) => {
    if (devicePositions[entityId]) {
      devicePositions[entityId].lat = pos.lat;
      devicePositions[entityId].lng = pos.lng;
      devicePositions[entityId].history = [];
      updateMarkerPosition(entityId);
      if (deviceTrails[entityId]) deviceTrails[entityId].setLatLngs([]);
    }
  });
  updateLocationDisplay();
  cityMap.setView([10.8231, 106.6297], 15);
}
