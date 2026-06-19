import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('city3d-canvas');
const labelLayer = document.getElementById('city-label-layer');
const requestBubbleEl = document.getElementById('city-request-bubble');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8eef4);
scene.fog = new THREE.Fog(0xe8eef4, 34, 70);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

const ORION_URL = window.ORION_URL || `http://${window.location.hostname || '127.0.0.1'}:3001`;
const MCP_URL = window.MCP_URL || `http://${window.location.hostname || '127.0.0.1'}:3002`;

const colors = {
  sky: 0xe8eef4,
  ground: 0xd7e1ea,
  road: 0xb9c5d1,
  edge: 0x77879a,
  wall: 0xf7f9fb,
  wallDark: 0xd8dee8,
  glass: 0xbfd4ec,
  normal: 0x3fa968,
  warning: 0xd3911f,
  critical: 0xc93646,
  off: 0x566274,
  offRoom: 0x9ca7b5,
  plugOn: 0x43a85f,
  warmLight: 0xffe5a3,
  cable: 0x2b3542,
  mcp: 0x31527e,
  command: 0x2368bd,
  sensor: 0x2f78c7,
  humidity: 0x3da6d6,
  dark: 0x1d2633,
  // New colors
  tree: 0x5a3825,
  foliage: 0x4a9e5e,
  foliageDark: 0x367a44,
  lampPost: 0x8a8a8a,
  lampGlow: 0xffd98a,
  baseboard: 0x8a929e,
  acUnit: 0x334155,
  acDisplay: 0x2dd4bf,
  serverRack: 0x2c3340,
  serverLed: 0x3aef6f,
  desk: 0xc49a6c,
  chair: 0x3c3c3c,
  fireOrange: 0xff6b22,
  fireRed: 0xff2222
};

const sourceMeta = {
  'dashboard-chat': { label: 'Dashboard chat', color: 0x2368bd },
  'openclaw-telegram': { label: 'Telegram / OpenClaw', color: 0x229ed9 },
  openclaw: { label: 'OpenClaw', color: 0x6d5bd6 },
  'mcp-auto-critical': { label: 'Auto critical rule', color: colors.critical },
  dashboard: { label: 'Dashboard control', color: 0x2368bd },
  unknown: { label: 'Operator request', color: 0x667386 }
};

const zones = [
  { id: 'A', label: 'Zone A', center: [-9, 0, 0], size: [10.5, 7.2], buildings: 3, devices: 3 },
  { id: 'B', label: 'Zone B', center: [6.8, 0, -4.2], size: [9.2, 6.4], buildings: 2, devices: 0 },
  { id: 'C', label: 'Zone C', center: [8.2, 0, 5.6], size: [8.4, 5.8], buildings: 2, devices: 0 }
];

const floorPlan = [
  { id: 'living', label: 'Living room', roomIndex: 0, x: -3.8, z: 0.35, w: 3.2, d: 3.6 },
  { id: 'utility', label: 'Utility room', roomIndex: 1, x: 0, z: 0.35, w: 3.2, d: 3.6 },
  { id: 'bedroom', label: 'Bedroom', roomIndex: 2, x: 3.8, z: 0.35, w: 3.2, d: 3.6 }
];

const affected = {
  zone: 'A',
  building: 'A1',
  floor: 2,
  room: 'utility'
};

const fallbackLayout = {};

const live = {
  entities: [],
  risk: null,
  commands: [],
  commandsInitialized: false,
  lastCommandId: null,
  animation: null,
  requestBubble: null,
  replay: { active: false, stage: '' }
};

const ui = {
  view: 'zones',
  selectedZone: 'A',
  selectedFloor: 2,
  selectedRoom: 'utility',
  hover: null,
  cameraTarget: new THREE.Vector3(0, 15, 23),
  lookTarget: new THREE.Vector3(0, 0, 0)
};

const objects = {
  zones: new THREE.Group(),
  building: new THREE.Group(),
  room: new THREE.Group(),
  flow: new THREE.Group(),
  zoneMeshes: new Map(),
  zoneBadges: new Map(),
  floorMeshes: new Map(),
  floorRooms: new Map(),
  floorRoomLabels: new Map(),
  labels: [],
  roomParts: {},
  commandPath: null,
  commandOrb: null
};

scene.add(objects.zones, objects.building, objects.room, objects.flow);

function mat(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.02,
    transparent: options.transparent || false,
    opacity: options.opacity ?? 1,
    emissive: options.emissive || 0x000000,
    emissiveIntensity: options.emissiveIntensity || 0
  });
}

function matPBR(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.5,
    metalness: options.metalness ?? 0.1,
    clearcoat: options.clearcoat ?? 0,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.1,
    transparent: options.transparent || false,
    opacity: options.opacity ?? 1,
    emissive: options.emissive || 0x000000,
    emissiveIntensity: options.emissiveIntensity || 0
  });
}

function ngsiValue(value) {
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
    return value.value;
  }
  return value;
}

function deviceSearchText(device) {
  return [
    device.id,
    device.type,
    device.name,
    device.displayName,
    device.deviceClass,
    device.category,
    device.controlledAsset,
    device.loadType,
    device.location,
    device.room,
    device.zone
  ]
    .map(value => String(ngsiValue(value) ?? '').toLowerCase())
    .join(' ');
}

function getRoomLoads() {
  const zone = String(ui.selectedZone || affected.zone).toLowerCase();
  const allPlugs = live.entities
    .filter(entity => {
      if (/^urn:ngsi-ld:MatterDevice:[123]_1$/.test(entity.id || '')) return false;
      const hasSwitchState = entity.onOff !== undefined || entity.state !== undefined;
      const hasElectricalLoad = entity.activePower !== undefined || entity.power !== undefined;
      const type = String(entity.type || '').toLowerCase();
      return type === 'smartplug' ||
        type === 'controlledoutlet' ||
        type === 'zigbeedevice' ||
        type === 'matterdevice' ||
        hasSwitchState ||
        hasElectricalLoad;
    })
    .map(entity => ({
      ...entity,
      onOff: ngsiValue(entity.onOff ?? entity.state),
      activePower: ngsiValue(entity.activePower ?? entity.power),
      name: ngsiValue(entity.name),
      displayName: ngsiValue(entity.displayName),
      deviceClass: ngsiValue(entity.deviceClass),
      category: ngsiValue(entity.category),
      controlledAsset: ngsiValue(entity.controlledAsset),
      loadType: ngsiValue(entity.loadType),
      location: ngsiValue(entity.location),
      room: ngsiValue(entity.room),
      zone: ngsiValue(entity.zone),
      online: ngsiValue(entity.online),
      status: ngsiValue(entity.status),
      connectionStatus: ngsiValue(entity.connectionStatus)
    }));
  const zonePlugs = allPlugs.filter(device => {
    const explicitZone = String(ngsiValue(device.zone) ?? '').toLowerCase();
    if (explicitZone) return explicitZone === zone || explicitZone === `zone ${zone}`;
    return deviceSearchText(device).includes(`zone${zone}`);
  });

  const candidates = zonePlugs.length ? zonePlugs : allPlugs;
  const explicitRoomLoads = candidates.filter(device => {
    const room = String(ngsiValue(device.room) ?? ngsiValue(device.location) ?? '').toLowerCase();
    if (!room) return false;
    return room.includes(String(ui.selectedRoom).toLowerCase()) ||
      room.includes(`room${ui.selectedFloor}02`) ||
      room.includes(`room ${ui.selectedFloor}02`);
  });
  return explicitRoomLoads.length ? explicitRoomLoads : candidates;
}

function classifyLoad(device) {
  const text = deviceSearchText(device).replace(/[_-]+/g, ' ');
  if (/\b(light|lighting|lamp|bulb)\b/.test(text)) return 'light';
  if (/\b(fan|ventilation|exhaust)\b/.test(text)) return 'fan';
  if (/\b(server|rack|ups|it load)\b/.test(text)) return 'server';
  if (/\b(ac|hvac|air conditioner|aircondition|cooling)\b/.test(text)) return 'ac';
  if (/\b(badplug|overload|hazard|outlet|socket)\b/.test(text)) return 'outlet';
  return 'other';
}

function getRoomLoad(role) {
  const loads = getRoomLoads();
  if (role === 'primary') {
    return loads.find(device => classifyLoad(device) === 'light') ||
      loads.find(device => classifyLoad(device) === 'outlet') ||
      loads[0] ||
      null;
  }
  return loads.find(device => classifyLoad(device) === role) || null;
}

function normalizeOnOff(value) {
  const raw = ngsiValue(value);
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;

  const normalized = String(raw ?? '').trim().toLowerCase();
  if (['on', 'true', '1', 'enabled', 'active', 'powered'].includes(normalized)) return true;
  if (['off', 'false', '0', 'disabled', 'inactive', 'isolated'].includes(normalized)) return false;
  return null;
}

function isDeviceOnline(device) {
  if (!device) return false;
  const raw = device.online ?? device.connectionStatus ?? device.status;
  if (raw === undefined || raw === null || raw === '') return true;
  const normalized = String(ngsiValue(raw)).trim().toLowerCase();
  return !['offline', 'disconnected', 'unavailable', 'false', '0', 'error'].includes(normalized);
}

function isLoadOn(key) {
  const load = getRoomLoad(key);
  if (!load) return null;
  const state = normalizeOnOff(load.onOff);
  return state;
}

function loadVisualState(role) {
  const device = getRoomLoad(role);
  return {
    device,
    online: isDeviceOnline(device),
    on: normalizeOnOff(device?.onOff) === true
  };
}

function stateLabel(state) {
  if (!state.device) return 'NOT MAPPED';
  if (!state.online) return 'OFFLINE';
  return state.on ? 'ON' : 'OFF';
}

function updateDeviceLabel(label, title, state) {
  if (!label?.element) return;
  label.element.textContent = `${title} - ${stateLabel(state)}`;
  label.element.dataset.state = stateLabel(state).toLowerCase().replace(' ', '-');
}

function ensureDeviceBeacon(object) {
  if (!object || object.userData.deviceBeacon) return object?.userData.deviceBeacon;

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    mat(colors.warning, {
      emissive: colors.warning,
      emissiveIntensity: 1.8
    })
  );
  beacon.position.set(0, 0.32, 0.12);
  object.add(beacon);
  object.userData.deviceBeacon = beacon;
  return beacon;
}

function setDeviceBeacon(object, state) {
  const beacon = ensureDeviceBeacon(object);
  if (!beacon) return;
  const color = !state.device || !state.online
    ? colors.off
    : state.on
      ? colors.plugOn
      : colors.command;
  beacon.material.color.setHex(color);
  beacon.material.emissive.setHex(color);
  beacon.material.emissiveIntensity = state.on ? 2.2 : 0.45;
}

function ensureAcAirflow(object) {
  if (!object || object.userData.airflow) return object?.userData.airflow || [];
  const airflow = [];
  for (let index = 0; index < 3; index += 1) {
    const stream = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.045, 0.55),
      mat(0x69c8ed, {
        emissive: 0x69c8ed,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.62
      })
    );
    stream.position.set((index - 1) * 0.18, -0.18, 0.45 + index * 0.12);
    object.add(stream);
    airflow.push(stream);
  }
  object.userData.airflow = airflow;
  return airflow;
}

function syncAllDeviceVisuals(time) {
  const fanState = loadVisualState('fan');
  const serverState = loadVisualState('server');
  const acState = loadVisualState('ac');
  const outletState = loadVisualState('primary');

  const fanObject = objects.roomParts.fanBlades?.parent || objects.roomParts.fan;
  const serverObject = objects.roomParts.serverRack;
  const acObject = objects.roomParts.acUnit || objects.roomParts.airConditioner || objects.roomParts.ac;

  setDeviceBeacon(fanObject, fanState);
  setDeviceBeacon(serverObject, serverState);
  setDeviceBeacon(acObject, acState);
  setDeviceBeacon(objects.roomParts.plug, outletState);
  updateDeviceLabel(objects.roomParts.deviceLabels?.plug, 'Outlet', outletState);
  updateDeviceLabel(objects.roomParts.deviceLabels?.ac, 'AC', acState);
  updateDeviceLabel(objects.roomParts.deviceLabels?.fan, 'Fan', fanState);
  updateDeviceLabel(objects.roomParts.deviceLabels?.server, 'Server', serverState);

  const acDisplay = acObject?.getObjectByName('acDisplay');
  const acLed = acObject?.getObjectByName('acLed');
  const acColor = acState.online && acState.on ? colors.acDisplay : colors.off;
  [acDisplay, acLed].forEach(part => {
    if (!part?.material) return;
    part.material.color.setHex(acColor);
    part.material.emissive.setHex(acState.online && acState.on ? acColor : 0x000000);
    part.material.emissiveIntensity = acState.online && acState.on ? 1.35 : 0;
  });

  const plugColor = outletState.online && outletState.on ? colors.plugOn : colors.off;
  ['ledStrip', 'led', 'button'].forEach(name => {
    const part = objects.roomParts.plug?.getObjectByName(name);
    if (!part?.material) return;
    part.material.color.setHex(plugColor);
    if (part.material.emissive) {
      part.material.emissive.setHex(outletState.online && outletState.on ? plugColor : 0x000000);
      part.material.emissiveIntensity = outletState.online && outletState.on ? 1.4 : 0;
    }
  });

  const airflow = ensureAcAirflow(acObject);
  airflow.forEach((stream, index) => {
    stream.visible = acState.online && acState.on;
    if (stream.visible) {
      stream.position.z = 0.35 + ((time * 0.75 + index * 0.24) % 0.85);
      stream.material.opacity = 0.35 + Math.sin(time * 4 + index) * 0.18;
    }
  });
}

function syncRoomLoadVisuals() {
  const primaryLoad = getRoomLoad('primary');
  const primaryState = normalizeOnOff(primaryLoad?.onOff);
  const primaryOnline = isDeviceOnline(primaryLoad);
  const primaryOn = primaryOnline && primaryState === true;
  const lamp = objects.roomParts.lamp;
  const roomLight = objects.roomParts.roomLight;
  const plug = objects.roomParts.plug;

  if (plug && !plug.userData.statusRing) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.34, 32),
      mat(colors.plugOn, {
        emissive: colors.plugOn,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.95
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    plug.add(ring);
    plug.userData.statusRing = ring;

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 12),
      mat(colors.plugOn, { emissive: colors.plugOn, emissiveIntensity: 2.2 })
    );
    led.position.set(0.22, 0.18, 0.2);
    plug.add(led);
    plug.userData.statusLed = led;
  }

  const statusColor = !primaryOnline
    ? colors.off
    : primaryState === null
      ? colors.warning
      : primaryOn
        ? colors.plugOn
        : colors.command;
  if (plug?.userData.statusRing) {
    plug.userData.statusRing.material.color.setHex(statusColor);
    plug.userData.statusRing.material.emissive.setHex(statusColor);
  }
  if (plug?.userData.statusLed) {
    plug.userData.statusLed.material.color.setHex(statusColor);
    plug.userData.statusLed.material.emissive.setHex(statusColor);
    plug.userData.statusLed.material.emissiveIntensity = primaryOn ? 2.2 : 0.2;
  }

  if (lamp?.bulb?.material) {
    if (!lamp.bulb.userData.fixtureShade && lamp.bulb.parent) {
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.5, 0.32, 32, 1, true),
        matPBR(0xf5f7fa, {
          roughness: 0.32,
          metalness: 0.08,
          clearcoat: 0.45
        })
      );
      shade.position.copy(lamp.bulb.position);
      shade.position.y += 0.2;
      lamp.bulb.parent.add(shade);
      lamp.bulb.userData.fixtureShade = shade;

      const glowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.43, 32),
        mat(colors.warmLight, {
          emissive: colors.warmLight,
          emissiveIntensity: 1.2,
          transparent: true,
          opacity: 0.72
        })
      );
      glowDisc.rotation.x = Math.PI / 2;
      glowDisc.position.copy(lamp.bulb.position);
      glowDisc.position.y -= 0.08;
      lamp.bulb.parent.add(glowDisc);
      lamp.bulb.userData.glowDisc = glowDisc;
    }
    lamp.bulb.scale.setScalar(1.45);
    lamp.bulb.material.color.setHex(primaryOn ? colors.warmLight : colors.off);
    lamp.bulb.material.emissive.setHex(primaryOn ? colors.warmLight : 0x000000);
    lamp.bulb.material.emissiveIntensity = primaryOn ? 3.2 : 0;
    if (lamp.bulb.userData.glowDisc) {
      lamp.bulb.userData.glowDisc.visible = primaryOn;
      lamp.bulb.userData.glowDisc.material.emissiveIntensity = primaryOn ? 1.8 : 0;
    }
  }
  if (lamp?.glow) {
    lamp.glow.visible = primaryOn;
    lamp.glow.material.opacity = primaryOn ? 0.16 : 0;
    lamp.glow.material.emissiveIntensity = primaryOn ? 1.05 : 0;
  }
  if (objects.roomParts.liveCable?.material) {
    objects.roomParts.liveCable.visible = primaryOn;
    objects.roomParts.liveCable.material.emissiveIntensity = primaryOn ? 0.9 : 0;
  }
  if (lamp?.light) {
    lamp.light.visible = primaryOn;
    lamp.light.intensity = primaryOn ? 4.2 : 0;
    lamp.light.distance = Math.max(lamp.light.distance || 0, 8);
  }
  if (roomLight) {
    roomLight.visible = primaryOn;
    roomLight.intensity = primaryOn ? 2.6 : 0;
  }
}

function init() {
  addLights();
  buildZones();
  buildBuilding();
  buildRoomDetail();
  setView('zones');
  setupInteractions();
  resize();
  refreshLiveData();
  setInterval(refreshLiveData, 2500);
  animate();
}

/* ──────────────────── LIGHTING ──────────────────── */

function addLights() {
  // Lowered intensities to prevent overexposure of the scene, particularly walls
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb4c0ce, 1.25));

  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 24, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // Warm fill light
  const warmFill = new THREE.DirectionalLight(0xfff0dd, 0.25);
  warmFill.position.set(8, 6, 10);
  scene.add(warmFill);

  // Cool fill light
  const fill = new THREE.DirectionalLight(0xd7ecff, 0.35);
  fill.position.set(-12, 9, -10);
  scene.add(fill);
}

/* ──────────────────── ZONE MAP ──────────────────── */

function buildZones() {
  const ground = new THREE.Mesh(new THREE.BoxGeometry(34, 0.18, 22), mat(colors.ground, { roughness: 0.94 }));
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  objects.zones.add(ground);

  addRoad(0, 0, 18, 1.35);
  addRoad(2.2, -0.7, 1.3, 19);
  addRoad(-2.6, 4.7, 28, 1.1);

  zones.forEach(zone => {
    const color = zone.id === 'A' ? colors.normal : 0x9daabd;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(zone.size[0], 0.12, zone.size[1]),
      mat(color, { transparent: true, opacity: zone.id === 'A' ? 0.32 : 0.16, emissive: color, emissiveIntensity: 0.03 })
    );
    base.position.set(zone.center[0], 0.03, zone.center[2]);
    base.userData = { type: 'zone', id: zone.id };
    objects.zones.add(base);
    objects.zoneMeshes.set(zone.id, base);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(zone.size[0], 0.14, zone.size[1])),
      new THREE.LineBasicMaterial({ color: zone.id === 'A' ? colors.normal : colors.edge, transparent: true, opacity: 0.82 })
    );
    outline.position.copy(base.position);
    objects.zones.add(outline);
    objects.zoneBadges.set(zone.id, outline);

    addZoneBuildings(zone);
    createLabel(`${zone.label}`, new THREE.Vector3(zone.center[0], 0.55, zone.center[2] - zone.size[1] / 2 - 0.55), 'zones', 'zone');
  });

  // Add trees scattered around zones
  const treePositions = [
    [-4.5, 3.8], [-14.2, -2.5], [1.5, -6.5], [12.5, -1.8],
    [13.2, 7.2], [4.0, 8.5], [-2.0, -5.8], [10.0, 3.0]
  ];
  treePositions.forEach(([x, z]) => {
    addTree(x, z, 0.35 + Math.random() * 0.15);
  });

  // Add street lights
  const streetLightPositions = [
    [-1.2, -1.5], [3.5, -1.5], [2.2, 5.2], [-6.0, 4.7]
  ];
  streetLightPositions.forEach(([x, z]) => {
    addStreetLight(x, z);
  });
}

function addRoad(x, z, w, d) {
  const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), mat(colors.road, { roughness: 0.96 }));
  road.position.set(x, 0.02, z);
  road.receiveShadow = true;
  objects.zones.add(road);
}

function addTree(x, z, canopyRadius) {
  const group = new THREE.Group();
  const trunkH = 0.6 + Math.random() * 0.2;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, trunkH, 8),
    mat(colors.tree, { roughness: 0.9 })
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(canopyRadius, 12, 10),
    mat(colors.foliage, { roughness: 0.85 })
  );
  canopy.position.y = trunkH + canopyRadius * 0.55;
  canopy.castShadow = true;

  // Second smaller canopy sphere for volume
  const canopy2 = new THREE.Mesh(
    new THREE.SphereGeometry(canopyRadius * 0.7, 10, 8),
    mat(colors.foliageDark, { roughness: 0.88 })
  );
  canopy2.position.set(canopyRadius * 0.3, trunkH + canopyRadius * 0.8, canopyRadius * 0.2);
  canopy2.castShadow = true;

  group.add(trunk, canopy, canopy2);
  group.position.set(x, 0, z);
  objects.zones.add(group);
}

function addStreetLight(x, z) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 1.5, 8),
    mat(colors.lampPost, { roughness: 0.4, metalness: 0.6 })
  );
  pole.position.y = 0.75;
  pole.castShadow = true;

  // Arm extending to the side
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6),
    mat(colors.lampPost, { roughness: 0.4, metalness: 0.6 })
  );
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.15, 1.45, 0);

  const lampBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 8),
    mat(colors.lampGlow, { emissive: colors.lampGlow, emissiveIntensity: 0.9, transparent: true, opacity: 0.92 })
  );
  lampBulb.position.set(0.32, 1.38, 0);

  const light = new THREE.PointLight(colors.lampGlow, 0.5, 3);
  light.position.set(0.32, 1.38, 0);

  group.add(pole, arm, lampBulb, light);
  group.position.set(x, 0, z);
  objects.zones.add(group);
}

/* ──────────────────── ZONE BUILDINGS ──────────────────── */

function addZoneBuildings(zone) {
  const positions = zone.id === 'A'
    ? [[-2.8, -1.2, 2.4], [0.1, 0.8, 3.3], [2.8, -1.4, 2.1]]
    : [[-1.6, -0.8, 1.8], [1.4, 0.9, 2.2]];

  positions.forEach(([dx, dz, h], index) => {
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, h, 1.8),
      mat(zone.id === 'A' && index === 1 ? 0xdde7f1 : 0xcbd6e2, { roughness: 0.64 })
    );
    shell.position.set(zone.center[0] + dx, h / 2, zone.center[2] + dz);
    shell.castShadow = true;
    shell.receiveShadow = true;
    shell.userData = { type: 'zone', id: zone.id };
    objects.zones.add(shell);

    // Sloped roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.35, 0.35, 4),
      mat(0xa1b0c0, { roughness: 0.75 })
    );
    roof.position.set(zone.center[0] + dx, h + 0.18, zone.center[2] + dz);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    objects.zones.add(roof);

    // Windows with better appearance
    for (let i = 0; i < Math.floor(h * 1.2); i += 1) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.16),
        matPBR(0xb8d5ef, {
          transparent: true, opacity: 0.82,
          emissive: 0xf4d389, emissiveIntensity: 0.24,
          clearcoat: 0.6, roughness: 0.15, metalness: 0.05
        })
      );
      win.position.set(shell.position.x, 0.55 + i * 0.42, shell.position.z + 0.92);
      objects.zones.add(win);
    }

    // Balcony slabs on front
    const balconyCount = Math.floor(h * 0.8);
    for (let i = 0; i < balconyCount; i++) {
      const balcony = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.04, 0.25),
        mat(0xbcc6d2, { roughness: 0.7 })
      );
      balcony.position.set(shell.position.x, 0.7 + i * 0.65, shell.position.z + 1.02);
      balcony.castShadow = true;
      objects.zones.add(balcony);
    }
  });
}

/* ──────────────────── BUILDING DRILL-DOWN ──────────────────── */

function buildBuilding() {
  const podium = new THREE.Mesh(new THREE.BoxGeometry(16, 0.22, 10), mat(0xd8e1ea));
  podium.position.set(0, -0.12, 0);
  podium.receiveShadow = true;
  objects.building.add(podium);

  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(13.2, 6.8, 0.18),
    mat(0xeef3f7, { transparent: true, opacity: 0.8 })
  );
  backPanel.position.set(0, 3.1, -1.85);
  backPanel.castShadow = true;
  objects.building.add(backPanel);

  for (let floor = 1; floor <= 4; floor += 1) {
    const y = floor * 1.38;
    const floorGroup = new THREE.Group();
    floorGroup.userData = { type: 'floor', floor };

    const slab = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.16, 5.3), mat(0xcfd9e4));
    slab.position.set(0, y - 0.66, 0.55);
    slab.castShadow = true;
    slab.receiveShadow = true;
    floorGroup.add(slab);

    floorPlan.forEach(room => {
      const isDemoRoom = floor === affected.floor && room.id === affected.room;
      const isDemoFloor = floor === affected.floor;
      const roomBaseColor = isDemoRoom ? 0xeaf3ff : isDemoFloor ? 0xf6f8fb : 0xebf0f5;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(room.w, 0.9, room.d),
        mat(roomBaseColor, { transparent: true, opacity: isDemoFloor ? 0.92 : 0.78 })
      );
      mesh.position.set(room.x, y, room.z);
      mesh.userData = { type: 'room', floor, room: room.id };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      floorGroup.add(mesh);
      objects.floorRooms.set(`${floor}:${room.id}`, mesh);

      const frontFace = new THREE.Mesh(
        new THREE.PlaneGeometry(room.w * 0.78, 0.42),
        matPBR(isDemoRoom ? 0x9fc7f2 : 0xdfe7ef, {
          transparent: true,
          opacity: isDemoFloor ? 0.88 : 0.58,
          emissive: isDemoRoom ? 0x2368bd : 0x000000,
          emissiveIntensity: isDemoRoom ? 0.08 : 0,
          clearcoat: isDemoRoom ? 0.4 : 0,
          roughness: 0.3
        })
      );
      frontFace.position.set(room.x, y + 0.06, room.z + room.d / 2 + 0.02);
      frontFace.userData = { type: 'room', floor, room: room.id };
      floorGroup.add(frontFace);

      const roomEdge = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(room.w, 0.9, room.d)),
        new THREE.LineBasicMaterial({ color: isDemoRoom ? 0x2368bd : colors.edge, transparent: true, opacity: isDemoFloor ? 0.72 : 0.42 })
      );
      roomEdge.position.copy(mesh.position);
      roomEdge.userData = { type: 'room', floor, room: room.id };
      floorGroup.add(roomEdge);

      if (floor === affected.floor) {
        const label = createLabel(room.label, new THREE.Vector3(room.x, y + 0.58, room.z + room.d / 2 + 0.45), 'building', isDemoRoom ? 'room-target' : 'room-name');
        objects.floorRoomLabels.set(room.id, label);
      }
    });

    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 5.3), mat(colors.edge));
    ribbon.position.set(-6.6, y, 0.55);
    ribbon.userData = { type: 'floor', floor };
    floorGroup.add(ribbon);

    // Thin balcony slab on front of each floor
    const floorBalcony = new THREE.Mesh(
      new THREE.BoxGeometry(12.8, 0.06, 0.45),
      mat(0xc0cad6, { roughness: 0.7 })
    );
    floorBalcony.position.set(0, y - 0.42, 2.85);
    floorBalcony.castShadow = true;
    floorGroup.add(floorBalcony);

    objects.building.add(floorGroup);
    objects.floorMeshes.set(floor, floorGroup);
    createLabel(`Floor ${floor}`, new THREE.Vector3(-7.25, y + 0.08, 3.15), 'building', 'floor');
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.2, 5.6), mat(0xb9c5d2));
  roof.position.set(0, 6.25, 0.55);
  roof.castShadow = true;
  objects.building.add(roof);

  createLabel('Zone A - Building A1', new THREE.Vector3(0, 6.8, 2.85), 'building', 'title');
  createLabel('Click Floor 2 utility room', new THREE.Vector3(0, 3.22, 3.25), 'building', 'hint');
}

/* ──────────────────── ROOM DETAIL ──────────────────── */

function buildRoomDetail() {
  const roomGroup = objects.room;

  // Floor with subtle grid pattern - light blue-grey to stay bright and elegant
  const floor = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.16, 6), mat(0xb8c5d6, { roughness: 0.82 }));
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  roomGroup.add(floor);

  // Floor grid lines
  const gridGroup = new THREE.Group();
  const gridMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.3 });
  const tileSize = 0.55;
  for (let x = -4.4; x <= 4.4; x += tileSize) {
    const pts = [new THREE.Vector3(x, 0.085, -3), new THREE.Vector3(x, 0.085, 3)];
    gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  }
  for (let z = -3; z <= 3; z += tileSize) {
    const pts = [new THREE.Vector3(-4.4, 0.085, z), new THREE.Vector3(4.4, 0.085, z)];
    gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  }
  roomGroup.add(gridGroup);

  // Walls - Matte light-grey/blue-grey to stay bright and clean without causing overexposure glare
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(8.8, 3.1, 0.16), mat(0xe2e8f0, { roughness: 0.75 }));
  backWall.position.set(0, 1.55, -2.92);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  roomGroup.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.1, 6), mat(0xd6e0ec, { roughness: 0.75 }));
  leftWall.position.set(-4.42, 1.55, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  roomGroup.add(leftWall);

  // Baseboards - dark strips along bottom of walls
  const baseboardMat = mat(colors.baseboard, { roughness: 0.6 });
  const bbBack = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.1, 0.06), baseboardMat);
  bbBack.position.set(0, 0.13, -2.81);
  roomGroup.add(bbBack);

  const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 6), baseboardMat);
  bbLeft.position.set(-4.31, 0.13, 0);
  roomGroup.add(bbLeft);

  // Ambient occlusion strips at wall/floor junctions
  const aoMat = mat(0x2a3040, { transparent: true, opacity: 0.08 });
  const aoBack = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 0.15), aoMat);
  aoBack.rotation.x = -Math.PI / 2;
  aoBack.position.set(0, 0.085, -2.77);
  roomGroup.add(aoBack);

  const aoLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 6), aoMat);
  aoLeft.rotation.y = Math.PI / 2;
  aoLeft.rotation.x = -Math.PI / 2;
  aoLeft.position.set(-4.27, 0.085, 0);
  roomGroup.add(aoLeft);

  // Window frame with glass pane (replaces simple plane)
  const windowGroup = new THREE.Group();
  windowGroup.position.set(2.65, 1.85, -2.82);
  const frameColor = 0x8a929e;
  const frameMat = mat(frameColor, { roughness: 0.4, metalness: 0.3 });
  const frameThick = 0.06;
  const frameDepth = 0.06;
  const wW = 2.1, wH = 1.0;

  // 4 frame pieces
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(wW + frameThick, frameThick, frameDepth), frameMat);
  frameTop.position.y = wH / 2;
  const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(wW + frameThick, frameThick, frameDepth), frameMat);
  frameBottom.position.y = -wH / 2;
  const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(frameThick, wH, frameDepth), frameMat);
  frameLeft.position.x = -wW / 2;
  const frameRight = new THREE.Mesh(new THREE.BoxGeometry(frameThick, wH, frameDepth), frameMat);
  frameRight.position.x = wW / 2;

  // Cross bar
  const frameMid = new THREE.Mesh(new THREE.BoxGeometry(wW, frameThick * 0.6, frameDepth * 0.6), frameMat);

  // Glass pane
  const glassPaneMat = matPBR(0xb8d5ef, {
    transparent: true, opacity: 0.4,
    roughness: 0.05, metalness: 0.02,
    clearcoat: 1.0, clearcoatRoughness: 0.05,
    emissive: 0x91c4ef, emissiveIntensity: 0.05
  });
  const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(wW - frameThick, wH - frameThick), glassPaneMat);
  glassPane.position.z = -0.01;

  windowGroup.add(frameTop, frameBottom, frameLeft, frameRight, frameMid, glassPane);
  roomGroup.add(windowGroup);

  // Hazard pad and darkness overlays
  const hazardPad = new THREE.Mesh(
    new THREE.BoxGeometry(8.5, 0.04, 5.7),
    mat(colors.critical, { transparent: true, opacity: 0, emissive: colors.critical, emissiveIntensity: 0.25 })
  );
  hazardPad.position.set(0, 0.1, 0);
  roomGroup.add(hazardPad);

  const darkness = new THREE.Mesh(
    new THREE.BoxGeometry(8.7, 0.05, 5.9),
    mat(0x1e2630, { transparent: true, opacity: 0 })
  );
  darkness.position.set(0, 0.12, 0);
  roomGroup.add(darkness);

  // Devices
  const plug = createSmartPlug();
  plug.position.set(-3.55, 1.08, -2.68);
  roomGroup.add(plug);

  const lamp = createLamp();
  lamp.group.position.set(0, 2.78, -0.2);
  roomGroup.add(lamp.group);

  const temp = createSensor('temperature');
  temp.position.set(3.55, 1.52, -2.72);
  roomGroup.add(temp);

  const humidity = createSensor('humidity');
  humidity.position.set(2.75, 0.82, -2.72);
  roomGroup.add(humidity);

  // Cables
  const cable = createCable([
    new THREE.Vector3(-3.25, 1.1, -2.62),
    new THREE.Vector3(-2.0, 1.35, -2.05),
    new THREE.Vector3(-0.8, 2.45, -1.0),
    new THREE.Vector3(0, 2.62, -0.3)
  ], 0.035, colors.cable);
  roomGroup.add(cable);

  const liveCable = createCable([
    new THREE.Vector3(-3.24, 1.11, -2.6),
    new THREE.Vector3(-2.0, 1.35, -2.03),
    new THREE.Vector3(-0.8, 2.45, -0.98),
    new THREE.Vector3(0, 2.62, -0.28)
  ], 0.02, colors.plugOn);
  liveCable.material.emissive.setHex(colors.plugOn);
  liveCable.material.emissiveIntensity = 0.7;
  roomGroup.add(liveCable);

  const roomLight = new THREE.PointLight(colors.warmLight, 1.4, 7.5);
  roomLight.position.set(0, 2.3, -0.2);
  roomLight.castShadow = true;
  roomLight.shadow.bias = -0.0005;
  roomGroup.add(roomLight);

  // MCP node (futuristic AI Gateway console)
  const mcpNode = createMCPNode();
  mcpNode.position.set(-1.4, 0.45, 3.25);
  roomGroup.add(mcpNode);

  // Request node (high-tech client terminal)
  const requestNode = createRequestNode();
  requestNode.position.set(-3.2, 0.45, 3.25);
  roomGroup.add(requestNode);

  // AC unit (wall-mounted)
  const acUnit = createACUnit();
  acUnit.position.set(0, 2.2, -2.72);
  roomGroup.add(acUnit);

  // Desk (against right wall)
  const desk = createDesk();
  desk.position.set(2.2, 0, 0);
  roomGroup.add(desk);

  // Chair (placed facing the desk)
  const chair = createChair();
  chair.position.set(2.2, 0, 1.1);
  chair.rotation.y = Math.PI; // Face the desk
  roomGroup.add(chair);

  // Standing fan (in right-front corner, no overlaps)
  const fan = createFan();
  fan.group.position.set(3.5, 0, 2.0);
  roomGroup.add(fan.group);

  // Server rack (against left wall, rotated to face center)
  const serverRack = createServerRack();
  serverRack.position.set(-3.6, 0, -0.6);
  serverRack.rotation.y = Math.PI / 2; // Face center
  roomGroup.add(serverRack);

  // Fire particles (initially hidden, used during critical)
  const fireParticles = [];
  for (let i = 0; i < 8; i++) {
    const spriteMat = new THREE.SpriteMaterial({
      color: i % 2 === 0 ? colors.fireOrange : colors.fireRed,
      transparent: true,
      opacity: 0
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.setScalar(0.06 + Math.random() * 0.04);
    sprite.position.set(-2 + Math.random(), 1.2 + Math.random() * 0.3, -2.3);
    sprite.visible = false;
    roomGroup.add(sprite);
    fireParticles.push(sprite);
  }

  objects.roomParts = {
    hazardPad,
    darkness,
    plug,
    lamp,
    temp,
    humidity,
    cable,
    liveCable,
    roomLight,
    mcpNode,
    requestNode,
    acUnit,
    serverRack,
    fan,
    fanBlades: fan.blades,
    fireParticles,
    deviceLabels: {}
  };

  // Labels
  objects.roomParts.deviceLabels.plug = createLabel('Outlet', plug.position.clone().add(new THREE.Vector3(0, 0.55, 0)), 'room', 'device');
  createLabel('Ceiling lamp load', lamp.group.position.clone().add(new THREE.Vector3(0, 0.45, 0)), 'room', 'device');
  createLabel('Temperature', temp.position.clone().add(new THREE.Vector3(0, 0.45, 0)), 'room', 'device');
  objects.roomParts.deviceLabels.ac = createLabel('AC', acUnit.position.clone().add(new THREE.Vector3(0, 0.45, 0)), 'room', 'device');
  objects.roomParts.deviceLabels.fan = createLabel('Fan', fan.group.position.clone().add(new THREE.Vector3(0, 1.72, 0)), 'room', 'device');
  objects.roomParts.deviceLabels.server = createLabel('Server', serverRack.position.clone().add(new THREE.Vector3(0, 1.92, 0)), 'room', 'device');
  createLabel('MCP decision', mcpNode.position.clone().add(new THREE.Vector3(0, 0.62, 0)), 'room', 'hint');
}

/* ──────────────────── SMART PLUG (Realistic) ──────────────────── */

function createSmartPlug() {
  const group = new THREE.Group();

  // Outer bezel/frame
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 0.72, 0.22),
    matPBR(0xeaecf0, { roughness: 0.55, metalness: 0.05 })
  );
  bezel.position.z = -0.04;
  group.add(bezel);

  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.65, 0.3),
    matPBR(0xf8fafc, { roughness: 0.32, metalness: 0.03, clearcoat: 0.15 })
  );
  body.name = 'body';
  group.add(body);

  // Face plate
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.48, 0.04), matPBR(0xe5ebf2, { roughness: 0.4 }));
  face.position.z = 0.18;
  group.add(face);

  // LED strip across the top
  const ledStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.04, 0.02),
    mat(colors.plugOn, { emissive: colors.plugOn, emissiveIntensity: 1.0 })
  );
  ledStrip.position.set(0, 0.26, 0.2);
  ledStrip.name = 'ledStrip';
  group.add(ledStrip);

  // LED indicator dot
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 18, 12), mat(colors.plugOn, { emissive: colors.plugOn, emissiveIntensity: 1.2 }));
  led.position.set(0.35, 0.22, 0.2);
  led.name = 'led';
  group.add(led);

  // Power button (slightly recessed)
  const buttonRecess = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.02, 24),
    mat(0xd0d4da)
  );
  buttonRecess.rotation.x = Math.PI / 2;
  buttonRecess.position.set(0, -0.16, 0.19);
  group.add(buttonRecess);

  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 24), mat(colors.plugOn));
  button.rotation.x = Math.PI / 2;
  button.position.set(0, -0.16, 0.21);
  button.name = 'button';
  group.add(button);

  // Socket holes - wider apart, slightly larger
  const holeMat = mat(colors.dark, { roughness: 0.9 });
  const holeA = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 18), holeMat);
  const holeB = holeA.clone();
  holeA.rotation.x = Math.PI / 2;
  holeB.rotation.x = Math.PI / 2;
  holeA.position.set(-0.16, 0.05, 0.19);
  holeB.position.set(0.16, 0.05, 0.19);
  group.add(holeA, holeB);

  // Brand dot - tiny circle in corner
  const brandDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 10, 6),
    mat(0xaabbcc, { roughness: 0.3 })
  );
  brandDot.position.set(-0.38, -0.24, 0.18);
  group.add(brandDot);

  return group;
}

/* ──────────────────── LAMP (Dome shade) ──────────────────── */

function createLamp() {
  const group = new THREE.Group();

  // Ceiling mount plate
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 28), mat(0xc0c8d4, { roughness: 0.4, metalness: 0.3 }));
  mount.position.y = 0.25;
  group.add(mount);

  // Stem connecting mount to shade
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.2, 12),
    mat(0xb0b8c4, { roughness: 0.4, metalness: 0.4 })
  );
  stem.position.y = 0.12;
  group.add(stem);

  // Dome shade using LatheGeometry (half-sphere open bottom)
  const shadeProfile = [];
  for (let i = 0; i <= 16; i++) {
    const angle = (i / 16) * Math.PI * 0.55;
    const r = Math.sin(angle) * 0.58;
    const y = -Math.cos(angle) * 0.32;
    shadeProfile.push(new THREE.Vector2(r, y));
  }
  const shadeGeo = new THREE.LatheGeometry(shadeProfile, 32);
  const shade = new THREE.Mesh(shadeGeo, matPBR(0xf7f9fb, {
    transparent: true, opacity: 0.92,
    roughness: 0.35, clearcoat: 0.2
  }));
  shade.position.y = 0.02;
  group.add(shade);

  // Bulb
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), mat(colors.warmLight, { emissive: colors.warmLight, emissiveIntensity: 1.25 }));
  bulb.position.y = -0.15;
  group.add(bulb);

  // Larger softer glow sphere
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.1, 28, 18), mat(colors.warmLight, { transparent: true, opacity: 0.12, emissive: colors.warmLight, emissiveIntensity: 0.85 }));
  glow.position.y = -0.2;
  group.add(glow);

  return { group, mount, shade, bulb, glow, stem };
}

/* ──────────────────── SENSOR (Round disc) ──────────────────── */

function createSensor(kind) {
  const group = new THREE.Group();
  const accent = kind === 'temperature' ? colors.sensor : colors.humidity;

  // Round disc body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.12, 28),
    matPBR(0xf7f9fb, { roughness: 0.35, clearcoat: 0.15 })
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);

  // Accent ring around body edge
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.015, 8, 32),
    mat(accent, { emissive: accent, emissiveIntensity: 0.2 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 0.0;
  group.add(ring);

  // Small screen/LCD on front face
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.14),
    mat(accent, { emissive: accent, emissiveIntensity: 0.32 })
  );
  screen.position.z = 0.065;
  screen.name = 'screen';
  group.add(screen);

  // Indicator LED on top
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 10), mat(0xffffff, { emissive: accent, emissiveIntensity: 0.34 }));
  dot.position.set(0, 0.18, 0.04);
  group.add(dot);

  return group;
}

/* ──────────────────── AC UNIT ──────────────────── */

function createACUnit() {
  const group = new THREE.Group();

  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.45, 0.25),
    matPBR(colors.acUnit, { roughness: 0.35, clearcoat: 0.1 })
  );
  group.add(body);

  // Bottom louver section - 4 thin horizontal strips
  for (let i = 0; i < 4; i++) {
    const louver = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.025),
      mat(0xdde2e8, { roughness: 0.5 })
    );
    louver.position.set(0, -0.12 - i * 0.035, 0.13);
    group.add(louver);
  }

  // Display area
  const display = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.08, 0.02),
    mat(colors.acDisplay, { emissive: colors.acDisplay, emissiveIntensity: 0.6 })
  );
  display.position.set(0.55, 0.1, 0.14);
  display.name = 'acDisplay';
  group.add(display);

  // LED indicator
  const acLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 10, 6),
    mat(colors.plugOn, { emissive: colors.plugOn, emissiveIntensity: 0.8 })
  );
  acLed.position.set(-0.65, 0.1, 0.14);
  acLed.name = 'acLed';
  group.add(acLed);

  return group;
}

/* ──────────────────── DESK ──────────────────── */

function createDesk() {
  const group = new THREE.Group();
  const legMat = mat(colors.desk, { roughness: 0.65 });

  // Tabletop
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.06, 1),
    mat(colors.desk, { roughness: 0.55 })
  );
  top.position.y = 0.75;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  // 4 legs
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8);
  const offsets = [[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]];
  offsets.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.375, z);
    leg.castShadow = true;
    group.add(leg);
  });

  return group;
}

/* ──────────────────── CHAIR ──────────────────── */

function createChair() {
  const group = new THREE.Group();
  const chairMat = mat(colors.chair, { roughness: 0.7 });

  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), chairMat);
  seat.position.y = 0.45;
  group.add(seat);

  // Backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.05), chairMat);
  back.position.set(0, 0.67, -0.22);
  group.add(back);

  // 4 legs
  const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6);
  const offsets = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
  offsets.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, chairMat);
    leg.position.set(x, 0.225, z);
    group.add(leg);
  });

  return group;
}

/* ──────────────────── SERVER RACK ──────────────────── */

function createServerRack() {
  const group = new THREE.Group();

  // Main box
  const rack = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.6, 0.4),
    mat(colors.serverRack, { roughness: 0.6, metalness: 0.3 })
  );
  rack.position.y = 0.8;
  rack.castShadow = true;
  group.add(rack);

  // Front panel detail
  const panelMat = mat(0x3a4454, { roughness: 0.65 });
  for (let i = 0; i < 4; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.25, 0.02), panelMat);
    panel.position.set(0, 0.3 + i * 0.35, 0.21);
    group.add(panel);
  }

  // LED dots on front (small emissive spheres)
  const serverLeds = [];
  for (let i = 0; i < 5; i++) {
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 6),
      mat(colors.serverLed, { emissive: colors.serverLed, emissiveIntensity: 0.9 })
    );
    led.position.set(-0.15, 0.25 + i * 0.3, 0.22);
    led.name = `serverLed${i}`;
    group.add(led);
    serverLeds.push(led);
  }
  group.userData.serverLeds = serverLeds;

  return group;
}

/* ──────────────────── MCP NODE ──────────────────── */

function createMCPNode() {
  const group = new THREE.Group();

  // 1. Dark metallic pedestal
  const baseMat = matPBR(0x1e293b, { roughness: 0.2, metalness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.16, 8), baseMat);
  base.position.y = -0.37;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 2. Main sleek black server body
  const bodyMat = matPBR(0x0f172a, { roughness: 0.1, metalness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.44), bodyMat);
  body.position.y = 0;
  body.castShadow = true;
  group.add(body);

  // 3. Side heatsink fins (metallic silver)
  const finMat = matPBR(0x64748b, { roughness: 0.3, metalness: 0.95 });
  for (let i = 0; i < 2; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.38), finMat);
    fin.position.set(i === 0 ? -0.24 : 0.24, 0, 0);
    group.add(fin);
  }

  // 4. Glowing server status vertical lines (LED strips)
  const ledStripMat = matPBR(0x06b6d4, { emissive: 0x06b6d4, emissiveIntensity: 1.5 });
  const frontLed1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.01), ledStripMat);
  frontLed1.position.set(-0.12, 0, 0.225);
  const frontLed2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.01), ledStripMat);
  frontLed2.position.set(0.12, 0, 0.225);
  group.add(frontLed1, frontLed2);

  // 5. Glass enclosure on top
  const glassMat = matPBR(0x93c5fd, { transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, clearcoat: 1.0 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 16), glassMat);
  glass.position.y = 0.45;
  group.add(glass);

  // 6. Glowing core sphere inside the glass
  const coreMat = matPBR(0x22d3ee, { emissive: 0x22d3ee, emissiveIntensity: 2.0 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), coreMat);
  core.position.y = 0.45;
  group.add(core);

  // 7. Holographic outer ring (spinning)
  const ringMat = matPBR(0x22d3ee, { transparent: true, opacity: 0.75, emissive: 0x22d3ee, emissiveIntensity: 1.2 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 8, 32), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.45;
  group.add(ring);

  // Expose parts for animation
  group.userData = { core, ring, frontLed1, frontLed2 };

  return group;
}

/* ──────────────────── REQUEST NODE ──────────────────── */

function createRequestNode() {
  const group = new THREE.Group();

  // Base
  const baseMat = matPBR(0x1e293b, { roughness: 0.3, metalness: 0.7 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.4), baseMat);
  base.position.y = -0.22;
  base.castShadow = true;
  group.add(base);

  // Main console body
  const bodyMat = matPBR(0x334155, { roughness: 0.2, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.3), bodyMat);
  body.position.y = 0;
  body.castShadow = true;
  group.add(body);

  // Holographic screen on the front face
  const screenMat = matPBR(0x0284c7, { emissive: 0x0284c7, emissiveIntensity: 1.5, transparent: true, opacity: 0.8 });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.02), screenMat);
  screen.position.set(0, 0.06, 0.155);
  group.add(screen);

  return group;
}

/* ──────────────────── STANDING FAN ──────────────────── */

function createFan() {
  const group = new THREE.Group();

  // Base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.28, 0.05, 16),
    mat(0x4a5568, { roughness: 0.5, metalness: 0.2 })
  );
  base.position.y = 0.025;
  group.add(base);

  // Pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.035, 1.0, 8),
    mat(0x8a929e, { roughness: 0.4, metalness: 0.4 })
  );
  pole.position.y = 0.55;
  group.add(pole);

  // Motor housing
  const motor = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 14, 10),
    mat(0x4a5568, { roughness: 0.5, metalness: 0.3 })
  );
  motor.position.y = 1.08;
  group.add(motor);

  // Guard ring
  const guard = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.015, 8, 24),
    mat(0x8a929e, { roughness: 0.4, metalness: 0.5 })
  );
  guard.position.set(0, 1.08, 0.05);
  group.add(guard);

  // Blade group (for rotation animation)
  const blades = new THREE.Group();
  blades.position.set(0, 1.08, 0.06);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.08),
      mat(0xd0d8e0, { transparent: true, opacity: 0.85, roughness: 0.5 })
    );
    blade.rotation.z = (i * Math.PI * 2) / 3;
    blade.position.set(
      Math.cos((i * Math.PI * 2) / 3) * 0.14,
      Math.sin((i * Math.PI * 2) / 3) * 0.14,
      0
    );
    blades.add(blade);
  }
  group.add(blades);

  return { group, blades };
}

/* ──────────────────── CABLE ──────────────────── */

function createCable(points, radius, color) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 42, radius, 8, false),
    mat(color, { roughness: 0.64 })
  );
}

/* ──────────────────── LABEL ──────────────────── */

function createLabel(text, position, view, kind = '') {
  const element = document.createElement('div');
  element.className = `city-label${kind ? ` ${kind}` : ''}`;
  element.textContent = text;
  labelLayer.appendChild(element);
  const label = { element, position, view, kind };
  objects.labels.push(label);
  return label;
}

/* ══════════════════════════════════════════════════════════════════════
   EVERYTHING BELOW THIS LINE IS PRESERVED EXACTLY FROM THE ORIGINAL
   (functions from line 505 onward) with additions for new parts
   ══════════════════════════════════════════════════════════════════════ */

function normalizeDevice(entity) {
  if (!entity) return {};
  const fallback = fallbackLayout[entity.id] || {};
  const rawOnOff = entity.onOff ? ngsiValue(entity.onOff) : undefined;
  const isOnOff = rawOnOff === true || rawOnOff === 'true' || rawOnOff === 'ON' || rawOnOff === 'on' || rawOnOff === 1 || rawOnOff === '1';
  return {
    id: entity.id || '',
    type: entity.type || '',
    zone: ngsiValue(entity.zone) || 'A',
    label: (entity.displayName ? ngsiValue(entity.displayName) : '') || fallback.label || entity.type || '',
    onOff: isOnOff,
    power: entity.activePower ? Number(ngsiValue(entity.activePower) || 0) : 0,
    temperature: entity.temperature ? Number(ngsiValue(entity.temperature) || 0) : 0,
    humidity: entity.measuredValue ? Number(ngsiValue(entity.measuredValue) || 0) : 0
  };
}

function getDevices() {
  if (!live || !Array.isArray(live.entities)) return [];
  return live.entities
    .filter(entity =>
      entity &&
      entity.type &&
      ['HumiditySensor', 'SmartPlug', 'TemperatureSensor'].includes(entity.type) &&
      !/^urn:ngsi-ld:MatterDevice:[123]_1$/.test(String(entity.id || ''))
    )
    .map(normalizeDevice);
}

function getLevel() {
  return live.risk?.riskLevel || 'normal';
}

function getRiskColor(level = getLevel()) {
  if (level === 'critical') return colors.critical;
  if (level === 'warning') return colors.warning;
  return colors.normal;
}

function getSmartPlug(devices = getDevices()) {
  const plugs = devices
    .filter(device => device.type === 'SmartPlug' && (device.zone || 'A') === ui.selectedZone)
    .sort((a, b) => Number(b.power || 0) - Number(a.power || 0));
  return plugs.find(device => device.id === affected.smartPlugId) || plugs[0] || null;
}

function getTemperature(devices = getDevices()) {
  const sensors = devices
    .filter(device => device.type === 'TemperatureSensor' && (device.zone || 'A') === ui.selectedZone)
    .sort((a, b) => Number(b.temperature || 0) - Number(a.temperature || 0));
  return sensors.find(device => device.id === affected.tempId) || sensors[0] || null;
}

function getHumidity(devices = getDevices()) {
  const sensors = devices
    .filter(device => device.type === 'HumiditySensor' && (device.zone || 'A') === ui.selectedZone)
    .sort((a, b) => Number(b.humidity || 0) - Number(a.humidity || 0));
  return sensors.find(device => device.id === affected.humidityId) || sensors[0] || null;
}

function updateSceneFromLive() {
  const devices = getDevices();
  const plug = getSmartPlug(devices);
  const level = getLevel();
  updateZoneVisuals(level);
  updateBuildingVisuals(level, plug);
  updateRoomVisuals(level, plug, devices);
  updateReadouts(devices, live.risk || {});
  detectCommandAnimation();
}

function updateZoneVisuals(level) {
  const color = getRiskColor(level);
  const zone = objects.zoneMeshes.get('A');
  const outline = objects.zoneBadges.get('A');
  if (zone) {
    zone.material.color.setHex(color);
    zone.material.emissive.setHex(color);
    zone.material.opacity = level === 'critical' ? 0.42 : level === 'warning' ? 0.34 : 0.28;
  }
  if (outline) {
    outline.material.color.setHex(color);
    outline.material.opacity = level === 'critical' ? 1 : 0.78;
  }
}

function updateBuildingVisuals(level, plug) {
  const plugOff = plug ? (plug.onOff === false || plug.onOff === 'false' || plug.onOff === 'OFF') : true;
  const riskColor = getRiskColor(level);

  objects.floorRooms.forEach((roomMesh, key) => {
    const [floorText, roomId] = key.split(':');
    const floor = Number(floorText);
    const affectedFloor = floor === affected.floor;
    const affectedRoom = affectedFloor && roomId === affected.room;
    const off = affectedRoom && plugOff;
    const color = off ? colors.offRoom : affectedRoom && level === 'critical' ? colors.critical : affectedRoom && level === 'warning' ? colors.warning : affectedRoom ? 0xeaf3ff : affectedFloor ? 0xf6f8fb : 0xebf0f5;
    roomMesh.material.color.setHex(color);
    roomMesh.material.emissive.setHex(affectedRoom && level !== 'normal' && !off ? riskColor : 0x000000);
    roomMesh.material.emissiveIntensity = affectedRoom && level !== 'normal' && !off ? 0.22 : 0;
    roomMesh.material.opacity = affectedRoom ? 0.96 : affectedFloor ? 0.88 : 0.7;
  });

  objects.floorMeshes.forEach((floorGroup, floor) => {
    const ribbon = floorGroup.children.find(child => child.geometry?.parameters?.width === 0.2);
    if (!ribbon) return;
    const active = floor === affected.floor;
    ribbon.material.color.setHex(active ? (plugOff ? colors.off : riskColor) : colors.edge);
    ribbon.material.emissive.setHex(active && level !== 'normal' && !plugOff ? riskColor : 0x000000);
    ribbon.material.emissiveIntensity = active && level !== 'normal' && !plugOff ? 0.3 : 0;
  });
}

function updateRoomVisuals(level, plug, devices) {
  const parts = objects.roomParts;
  if (!parts.plug) return;

  const plugOff = plug ? (plug.onOff === false || plug.onOff === 'false' || plug.onOff === 'OFF') : true;
  const riskColor = getRiskColor(level);
  const temp = getTemperature(devices);
  const humidity = getHumidity(devices);

  parts.hazardPad.material.opacity = level === 'critical' && !plugOff ? 0.28 : level === 'warning' ? 0.16 : 0;
  parts.hazardPad.material.color.setHex(riskColor);
  parts.hazardPad.material.emissive.setHex(riskColor);
  parts.darkness.material.opacity = plugOff ? 0.38 : 0;

  const led = parts.plug.getObjectByName('led');
  const button = parts.plug.getObjectByName('button');
  const ledStrip = parts.plug.getObjectByName('ledStrip');
  const plugColor = plugOff ? colors.off : colors.plugOn;
  led.material.color.setHex(plugColor);
  led.material.emissive.setHex(plugOff ? 0x000000 : plugColor);
  led.material.emissiveIntensity = plugOff ? 0 : 1.2;
  button.material.color.setHex(plugColor);
  if (ledStrip) {
    ledStrip.material.color.setHex(plugColor);
    ledStrip.material.emissive.setHex(plugOff ? 0x000000 : plugColor);
    ledStrip.material.emissiveIntensity = plugOff ? 0 : 1.0;
  }

  parts.liveCable.visible = !plugOff;
  parts.liveCable.material.color.setHex(level === 'critical' ? colors.critical : colors.plugOn);
  parts.liveCable.material.emissive.setHex(level === 'critical' ? colors.critical : colors.plugOn);
  parts.liveCable.material.emissiveIntensity = level === 'critical' ? 0.95 : 0.72;
  parts.cable.material.color.setHex(colors.cable);

  const lampColor = plugOff ? colors.off : level === 'critical' ? colors.critical : colors.warmLight;
  parts.lamp.bulb.material.color.setHex(lampColor);
  parts.lamp.bulb.material.emissive.setHex(plugOff ? 0x000000 : lampColor);
  parts.lamp.bulb.material.emissiveIntensity = plugOff ? 0 : level === 'critical' ? 1.4 : 1.1;
  parts.lamp.glow.visible = !plugOff;
  parts.lamp.glow.material.color.setHex(lampColor);
  parts.lamp.glow.material.emissive.setHex(lampColor);
  parts.lamp.glow.material.opacity = level === 'critical' ? 0.24 : 0.16;
  parts.roomLight.intensity = plugOff ? 0 : level === 'critical' ? 0.75 : 1.4;
  parts.roomLight.color.setHex(level === 'critical' ? colors.critical : colors.warmLight);

  const tempScreen = parts.temp.getObjectByName('screen');
  const tempDanger = Number(temp?.temperature || 0) >= 50 || level === 'critical';
  tempScreen.material.color.setHex(tempDanger ? colors.critical : colors.sensor);
  tempScreen.material.emissive.setHex(tempDanger ? colors.critical : colors.sensor);
  tempScreen.material.emissiveIntensity = tempDanger ? 0.68 : 0.32;

  const humidityScreen = parts.humidity.getObjectByName('screen');
  humidityScreen.material.color.setHex(colors.humidity);
  humidityScreen.material.emissive.setHex(colors.humidity);
  humidityScreen.material.emissiveIntensity = Number(humidity?.humidity || 0) >= 90 ? 0.62 : 0.32;

  // AC unit LED and Display based on status
  if (parts.acUnit) {
    const acLed = parts.acUnit.getObjectByName('acLed');
    const acDisplay = parts.acUnit.getObjectByName('acDisplay');
    if (acLed) {
      const acColor = plugOff ? colors.off : level === 'critical' ? colors.critical : colors.plugOn;
      acLed.material.color.setHex(acColor);
      acLed.material.emissive.setHex(plugOff ? 0x000000 : acColor);
      acLed.material.emissiveIntensity = plugOff ? 0 : 0.8;
    }
    if (acDisplay) {
      acDisplay.material.color.setHex(plugOff ? 0x111827 : colors.acDisplay);
      acDisplay.material.emissive.setHex(plugOff ? 0x000000 : colors.acDisplay);
      acDisplay.material.emissiveIntensity = plugOff ? 0 : 0.6;
    }
  }

  // Fire particles visibility
  if (parts.fireParticles) {
    const showFire = level === 'critical' && !plugOff;
    parts.fireParticles.forEach(p => {
      p.visible = showFire;
      if (!showFire) p.material.opacity = 0;
    });
  }
}

function setView(view, zoneId = ui.selectedZone) {
  ui.view = view;
  ui.selectedZone = zoneId;
  objects.zones.visible = view === 'zones';
  objects.building.visible = view === 'building';
  objects.room.visible = view === 'room';
  objects.flow.visible = view === 'room';

  updateZoneButtons();
  setOutcome(false);

  if (view === 'zones') {
    setCamera(new THREE.Vector3(0, 15, 23), new THREE.Vector3(0, 0, 0));
    updateModeCard('Zone overview', 'Choose the affected zone', 'Only zone status is shown here. Devices and cables stay hidden until you drill down.');
  } else if (view === 'building') {
    setCamera(new THREE.Vector3(0, 8.7, 13.8), new THREE.Vector3(0, 3, 0.5));
    updateModeCard('Zone A - Building A1', 'Find the affected floor and room', 'Floor 2 contains the monitored utility room. Click the highlighted room to inspect devices.');
  } else {
    setCamera(new THREE.Vector3(6.2, 4.3, 8.2), new THREE.Vector3(0, 1.35, -0.35));
    updateModeCard('Room detail', 'Smart plug controls the lamp load', 'Critical risk triggers MCP control. The plug turns off, the cable goes cold, and the lamp goes dark.');
  }
  updateReadouts(getDevices(), live.risk || {});
}

function setCamera(position, lookAt) {
  ui.cameraTarget.copy(position);
  ui.lookTarget.copy(lookAt);
}

function updateModeCard(kicker, title, copy) {
  setText('city-mode-kicker', kicker);
  setText('city-mode-title', title);
  setText('city-mode-copy', copy);
}

function updateZoneButtons() {
  document.querySelectorAll('.zone-button').forEach(button => {
    button.classList.toggle('active', button.dataset.zone === ui.selectedZone);
  });
}

function updateReadouts(devices = [], risk = live.risk || {}) {
  const level = ui.selectedZone === 'A' ? risk.riskLevel || 'normal' : 'unknown';
  const temp = getTemperature(devices);
  const humidity = getHumidity(devices);
  const plug = getSmartPlug(devices);

  setText('city-zone-name', `Zone ${ui.selectedZone}`);
  setText('city-risk-score', ui.selectedZone === 'A' ? risk.riskScore ?? '--' : '--');
  const levelEl = document.getElementById('city-risk-level');
  levelEl.textContent = ui.selectedZone === 'A' ? String(level).toUpperCase() : 'MAP ONLY';
  levelEl.className = `risk-${level}`;
  setText('zone-a-state', risk.riskLevel ? String(risk.riskLevel).toUpperCase() : 'Live devices');
  setText('city-temp', ui.selectedZone === 'A' && temp?.temperature !== undefined ? `${Number(temp.temperature).toFixed(1)} C` : '-- C');
  setText('city-humidity', ui.selectedZone === 'A' && humidity?.humidity !== undefined ? `${Number(humidity.humidity).toFixed(1)} %RH` : '-- %RH');
  const highestLoad = getSmartPlug(devices);
  const primaryLoad = getRoomLoad('primary');
  const highestLabel = highestLoad
    ? String(highestLoad.label || highestLoad.id).split(':').pop()
    : 'Controlled load';
  setText('city-plug', ui.selectedZone === 'A' && highestLoad
    ? highestLoad.onOff !== false
      ? `${highestLabel} ON - ${Number(highestLoad.power || 0).toFixed(0)} W`
      : `${highestLabel} OFF - isolated`
    : '--');
  setText('city-rationale', ui.selectedZone === 'A'
    ? risk.rationale || 'Waiting for MCP risk evaluation.'
    : 'This zone is city context only in the current demo.');

  if (!live.replay.active) {
    const elevated = ui.selectedZone === 'A' && ['warning', 'critical'].includes(level);
    const off = ui.selectedZone === 'A' && normalizeOnOff(primaryLoad?.onOff) === false;
    setFlow('flow-sensor', elevated ? (level === 'critical' ? 'danger' : 'active') : '');
    setFlow('flow-orion', elevated ? 'active' : '');
    setFlow('flow-mcp', level === 'critical' ? 'danger' : level === 'warning' ? 'active' : '');
    setFlow('flow-plug', off ? 'active' : '');
    setFlow('flow-room', off ? 'active' : '');
  }
}

async function refreshLiveData() {
  const [entitiesResult, riskResult, commandsResult] = await Promise.allSettled([
    fetch(`${ORION_URL}/v2/entities?limit=1000`, { headers: { Accept: 'application/json' } }),
    fetch(`${MCP_URL}/risk?zone=A`),
    fetch(`${MCP_URL}/commands?limit=8`)
  ]);

  try {
    const entitiesRes = entitiesResult.status === 'fulfilled' ? entitiesResult.value : null;
    if (entitiesRes?.ok) {
      const payload = await entitiesRes.json();
      live.entities = Array.isArray(payload) ? payload : [];
      state.lastUpdate = new Date().toLocaleTimeString('vi-VN');
      setText('last-update', state.lastUpdate);
      setConnectionStatus('orion', true, 'Connected');
    } else {
      const fallbackRes = await fetch(`${MCP_URL}/tools/query_entities?zone=${encodeURIComponent(ui.selectedZone)}`);
      if (fallbackRes.ok) {
        const payload = await fallbackRes.json();
        live.entities = Array.isArray(payload) ? payload : [];
        setConnectionStatus('orion', true, 'Via MCP');
      } else {
        setConnectionStatus('orion', false, 'Unavailable');
      }
    }

    const riskRes = riskResult.status === 'fulfilled' ? riskResult.value : null;
    if (riskRes?.ok) {
      live.risk = await riskRes.json();
      setConnectionStatus('mcp', true, 'Running');
    } else {
      setConnectionStatus('mcp', false, 'Risk unavailable');
    }

    const commandsRes = commandsResult.status === 'fulfilled' ? commandsResult.value : null;
    if (commandsRes?.ok) {
      live.commands = await commandsRes.json();
      if (!live.commandsInitialized) {
        const first = live.commands[0];
        live.lastCommandId = first?.id || ngsiValue(first?.commandId) || null;
        live.commandsInitialized = true;
      }
    }
    updateSceneFromLive();
  } catch (error) {
    setText('city-rationale', `Live data unavailable: ${error.message}`);
  }
}

async function runScenario(mode) {
  try {
    resetReplayVisuals();
    if (mode === 'critical' || ui.view === 'room') setView('room', 'A');
    else if (mode === 'warning') setView('building', 'A');
    await simulateScenario(mode);
    await refreshLiveData();
  } catch (error) {
    setText('city-command-detail', `Scenario failed: ${error.message}`);
  }
}

async function forceEvaluate() {
  try {
    setView('room', 'A');
    await triggerEvaluate();
    await refreshLiveData();
  } catch (error) {
    setText('city-command-detail', `Evaluate failed: ${error.message}`);
  }
}

async function replayIncident() {
  const button = document.getElementById('city-replay');
  if (live.replay.active) return;

  live.replay.active = true;
  button.disabled = true;
  button.querySelector('span').textContent = 'Replaying...';
  clearFlow();
  setOutcome(false);

  try {
    setReplayStage('zones');
    setView('zones');
    await simulateScenario('normal');
    await refreshLiveData();
    await delay(900);

    setReplayStage('building');
    setView('building', 'A');
    await delay(1050);

    setReplayStage('room');
    setView('room', 'A');
    await delay(850);

    setReplayStage('spike');
    await simulateScenario('critical');
    await refreshLiveData();
    await delay(900);

    setReplayStage('mcp');
    await triggerEvaluate();
    startCommandAnimation(sourceMeta['mcp-auto-critical'].color, sourceMeta['mcp-auto-critical'].label, 'TURN_OFF');
    await delay(1250);
    await refreshLiveData();
    await ensurePlugOffForReplay();
    await delay(450);

    setReplayStage('cut');
    await refreshLiveData();
    setOutcome(true);
    await delay(1500);
  } catch (error) {
    setText('city-command-detail', `Replay failed: ${error.message}`);
  } finally {
    live.replay.active = false;
    button.disabled = false;
    button.querySelector('span').textContent = 'Replay incident';
    updateSceneFromLive();
  }
}

function setReplayStage(stage) {
  live.replay.stage = stage;
  clearFlow();
  setOutcome(false);

  if (stage === 'zones') {
    updateModeCard('Replay', 'Start from the zone map', 'The audience first sees which part of the city needs attention.');
    setText('city-command-detail', 'Zone overview: no device clutter yet.');
  }
  if (stage === 'building') {
    updateModeCard('Replay', 'Drill into Zone A', 'The building view reveals Floor 2 and the affected utility room.');
    setFlow('flow-sensor', 'active');
    setText('city-command-detail', 'Zone A -> Building A1 -> Floor 2 utility room.');
  }
  if (stage === 'room') {
    updateModeCard('Replay', 'Open room detail', 'Only now do we show the smart plug, lamp, sensors, and short power cable.');
    setFlow('flow-sensor', 'active');
    setText('city-command-detail', 'The smart plug is visibly connected to the lamp load.');
  }
  if (stage === 'spike') {
    updateModeCard('Replay', 'Risk becomes critical', 'The room turns red as live sensor context crosses the fire threshold.');
    setFlow('flow-sensor', 'danger');
    setFlow('flow-orion', 'active');
    setText('city-command-detail', 'Sensor spike is written to Orion, then evaluated by MCP.');
  }
  if (stage === 'mcp') {
    updateModeCard('Replay', 'MCP issues shutdown', 'A command travels from MCP to the smart plug.');
    setFlow('flow-sensor', 'danger');
    setFlow('flow-orion', 'active');
    setFlow('flow-mcp', 'danger');
    setText('city-command-detail', 'MCP sends TURN_OFF to isolate the electrical load.');
  }
  if (stage === 'cut') {
    updateModeCard('Replay', 'Auto shutdown applied', 'The plug is off, the cable is cold, and the lamp goes dark.');
    setFlow('flow-sensor', 'danger');
    setFlow('flow-orion', 'active');
    setFlow('flow-mcp', 'danger');
    setFlow('flow-plug', 'active');
    setFlow('flow-room', 'active');
    setText('city-command-detail', 'TURN_OFF reached the smart plug. The connected lamp is now dark.');
  }
}

async function ensurePlugOffForReplay() {
  const devices = getDevices();
  const plugs = devices.filter(device => device.type === 'SmartPlug');
  
  for (const plug of plugs) {
    if (normalizeOnOff(plug.onOff) === false) continue;
    const res = await fetch(`${MCP_URL}/tools/invoke_command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: plug.id,
        action: 'TURN_OFF',
        reason: 'Replay incident safety cut for Zone A',
        requestedBy: 'dashboard',
        confirmed: true
      })
    });
    if (!res.ok) console.error(`Fallback shutoff failed for ${plug.id}: ${res.status}`);
  }
  await refreshLiveData();
}

function detectCommandAnimation() {
  const cmd = live.commands[0];
  if (!cmd) return;
  const id = cmd.id || ngsiValue(cmd.commandId);
  if (!id || id === live.lastCommandId) return;
  live.lastCommandId = id;

  const action = ngsiValue(cmd.action);
  const requestedBy = normalizeSource(ngsiValue(cmd.requestedBy));
  const deviceId = ngsiValue(cmd.deviceId);
  const meta = sourceMeta[requestedBy] || sourceMeta.unknown;
  setText('city-command-detail', `${meta.label}: ${action || 'COMMAND'} -> ${String(deviceId || '').split(':').pop() || 'device'}`);

  if (action === 'TURN_OFF' || action === 'TURN_ON') {
    setView('room', 'A');
    setFlow('flow-mcp', 'active');
    setFlow('flow-plug', 'active');
    startCommandAnimation(meta.color, meta.label, action);
  }
}

function normalizeSource(source) {
  if (sourceMeta[source]) return source;
  return 'unknown';
}

function startCommandAnimation(color, sourceLabel = 'Request', action = 'COMMAND') {
  const { requestNode, mcpNode, plug } = objects.roomParts;
  if (!requestNode || !mcpNode || !plug) return;

  if (objects.commandPath) objects.flow.remove(objects.commandPath);
  if (objects.commandOrb) objects.flow.remove(objects.commandOrb);

  const start = requestNode.getWorldPosition(new THREE.Vector3());
  const mcp = mcpNode.getWorldPosition(new THREE.Vector3());
  const end = plug.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.1, 0.12, 0.1));
  const curve = new THREE.CatmullRomCurve3([
    start,
    start.clone().lerp(mcp, 0.5).add(new THREE.Vector3(0, 0.95, 0)),
    mcp,
    mcp.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 1.25, 0)),
    end
  ]);

  objects.commandPath = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(44)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.88 })
  );
  objects.flow.add(objects.commandPath);

  objects.commandOrb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 22, 14), mat(color, { emissive: color, emissiveIntensity: 1.2 }));
  objects.flow.add(objects.commandOrb);
  live.animation = { curve, elapsed: 0, duration: 1.25, target: plug };

  const bubbleCurve = new THREE.CatmullRomCurve3([
    start,
    start.clone().lerp(mcp, 0.5).add(new THREE.Vector3(0, 1.1, 0)),
    mcp
  ]);
  showRequestBubble(`${sourceLabel}: ${action === 'TURN_OFF' ? 'turn off' : 'turn on'}`, color, bubbleCurve);
}

function showRequestBubble(text, color, curve) {
  if (!requestBubbleEl) return;
  requestBubbleEl.textContent = text;
  requestBubbleEl.style.setProperty('--bubble-color', `#${color.toString(16).padStart(6, '0')}`);
  requestBubbleEl.classList.remove('hide');
  live.requestBubble = { curve, elapsed: 0, duration: 0.95 };
  updateRequestBubblePosition(curve.getPoint(0));
}

function setupInteractions() {
  document.querySelectorAll('.zone-button').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.zone === 'A') setView('building', 'A');
      else setView('zones', button.dataset.zone);
    });
  });

  document.getElementById('city-back-zone').addEventListener('click', () => {
    if (live.replay.active) return;
    resetReplayVisuals();
    if (ui.view === 'room') setView('building', 'A');
    else setView('zones');
  });

  document.getElementById('city-replay').addEventListener('click', replayIncident);
  document.querySelectorAll('[data-scenario]').forEach(button => {
    button.addEventListener('click', () => runScenario(button.dataset.scenario));
  });
  document.getElementById('city-force-evaluate').addEventListener('click', forceEvaluate);

  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
}

function handlePointerDown(event) {
  const hit = getInteractiveHit(event);
  if (!hit) return;
  const data = hit.object.userData;
  if (data.type === 'zone' && data.id === 'A') setView('building', 'A');
  if (data.type === 'room' && data.floor === affected.floor) setView('room', 'A');
  if (data.type === 'floor' && data.floor === affected.floor) setView('room', 'A');
}

function handlePointerMove(event) {
  const hit = getInteractiveHit(event);
  canvas.style.cursor = hit ? 'pointer' : 'default';
}

function getInteractiveHit(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const targets = ui.view === 'zones'
    ? [...objects.zoneMeshes.values()]
    : ui.view === 'building'
      ? [...objects.floorMeshes.values().flatMap(group => group.children)]
      : [];
  const hits = raycaster.intersectObjects(targets, false);
  return hits.find(hit => {
    const type = hit.object.userData?.type;
    if (ui.view === 'zones') return type === 'zone';
    if (ui.view === 'building') return type === 'room' || type === 'floor';
    return false;
  }) || null;
}

function clearFlow() {
  ['flow-sensor', 'flow-orion', 'flow-mcp', 'flow-plug', 'flow-room'].forEach(id => setFlow(id, ''));
}

function resetReplayVisuals() {
  live.replay.stage = '';
  live.requestBubble = null;
  requestBubbleEl?.classList.add('hide');
  setOutcome(false);
  clearFlow();
  if (objects.commandPath) objects.flow.remove(objects.commandPath);
  if (objects.commandOrb) objects.flow.remove(objects.commandOrb);
  objects.commandPath = null;
  objects.commandOrb = null;
}

function setOutcome(visible) {
  const outcome = document.getElementById('city-outcome');
  if (outcome) outcome.classList.toggle('hide', !visible);
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height, false);
}

/* ──────────────────── ANIMATION LOOP (Enhanced) ──────────────────── */

function animate() {
  requestAnimationFrame(animate);
  try {
    const delta = clock.getDelta();
    const time = clock.elapsedTime;

    // Verify and handle dynamic canvas resize (prevent 0x0 size bugs)
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (renderer.domElement.clientWidth !== rect.width || renderer.domElement.clientHeight !== rect.height)) {
      resize();
    }

    camera.position.lerp(ui.cameraTarget, 0.08);
    camera.lookAt(ui.lookTarget);

    const level = getLevel();
    syncRoomLoadVisuals();
    syncAllDeviceVisuals(time);
    if (level === 'critical' && objects.roomParts.hazardPad) {
      objects.roomParts.hazardPad.material.opacity = Math.max(objects.roomParts.hazardPad.material.opacity, 0.18 + Math.sin(time * 5) * 0.04);
    }
    if (objects.roomParts.mcpNode) {
      objects.roomParts.mcpNode.scale.setScalar(1 + Math.sin(time * 3) * 0.035);
    }

    if (live.animation && objects.commandOrb) {
      live.animation.elapsed += delta;
      const t = Math.min(live.animation.elapsed / live.animation.duration, 1);
      objects.commandOrb.position.copy(live.animation.curve.getPoint(t));
      live.animation.target.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.12);
      if (t >= 1) {
        live.animation.target.scale.setScalar(1);
        live.animation = null;
        setTimeout(() => {
          if (objects.commandPath) objects.flow.remove(objects.commandPath);
          if (objects.commandOrb) objects.flow.remove(objects.commandOrb);
          objects.commandPath = null;
          objects.commandOrb = null;
        }, 650);
      }
    }

    // Fan blade rotation (when fan plug is ON)
    if (objects.roomParts.fanBlades) {
      const fanOn = isLoadOn('fan');
      if (fanOn) {
        objects.roomParts.fanBlades.rotation.z += delta * 8;
      }
    }

    // Lamp flicker when warning
    if (level === 'warning' && objects.roomParts.lamp && isLoadOn('primary') !== false) {
      const flicker = 1.0 + (Math.random() - 0.5) * 0.35;
      objects.roomParts.lamp.bulb.material.emissiveIntensity = 1.1 * flicker;
    }

    // Server rack LED pulsing (when server plug is ON)
    if (objects.roomParts.serverRack && objects.roomParts.serverRack.userData.serverLeds) {
      const serverOn = isLoadOn('server');
      const leds = objects.roomParts.serverRack.userData.serverLeds;
      leds.forEach((led, i) => {
        if (serverOn) {
          const pulse = 0.5 + Math.sin(time * 3 + i * 1.2) * 0.5;
          led.material.emissiveIntensity = 0.3 + pulse * 0.7;
        } else {
          led.material.emissiveIntensity = 0;
        }
      });
    }

    // MCP Node animation (holographic ring spin + pulsing core & vertical LEDs)
    if (objects.roomParts.mcpNode && objects.roomParts.mcpNode.userData) {
      const mcpUD = objects.roomParts.mcpNode.userData;
      if (mcpUD.ring) {
        mcpUD.ring.rotation.z += delta * 1.5;
      }
      const mcpPulse = 0.6 + Math.sin(time * 4) * 0.4;
      if (mcpUD.core) {
        mcpUD.core.material.emissiveIntensity = 1.0 + mcpPulse * 1.5;
      }
      if (mcpUD.frontLed1) {
        mcpUD.frontLed1.material.emissiveIntensity = 0.8 + mcpPulse * 0.8;
      }
      if (mcpUD.frontLed2) {
        mcpUD.frontLed2.material.emissiveIntensity = 0.8 + mcpPulse * 0.8;
      }
    }

    // Fire particles near cable when critical
    if (objects.roomParts.fireParticles) {
      const plug = getRoomLoad('primary');
      const plugOff = plug ? normalizeOnOff(plug.onOff) === false : true;
      const showFire = level === 'critical' && !plugOff;
      objects.roomParts.fireParticles.forEach(p => {
        if (showFire) {
          p.visible = true;
          p.position.y += delta * 0.8;
          p.material.opacity -= delta * 0.5;
          if (p.material.opacity <= 0) {
            p.position.set(-2 + Math.random(), 1.2 + Math.random() * 0.3, -2.3);
            p.material.opacity = 0.8;
          }
        } else {
          p.visible = false;
          p.material.opacity = 0;
        }
      });
    }

    updateRequestBubble(delta);
    updateLabels();
    renderer.render(scene, camera);
  } catch (err) {
    console.error('[3D Animation Loop Error]:', err);
    const box = document.getElementById('debug-error-box');
    const msg = document.getElementById('debug-error-msg');
    if (box && msg) {
      box.style.display = 'block';
      msg.innerHTML = `Render loop error: ${err.message}<br><small>${err.stack ? err.stack.split('\\n').slice(0,2).join('<br>') : ''}</small>`;
    }
  }
}

function updateRequestBubble(delta) {
  if (!live.requestBubble || !requestBubbleEl) return;
  live.requestBubble.elapsed += delta;
  const t = Math.min(live.requestBubble.elapsed / live.requestBubble.duration, 1);
  updateRequestBubblePosition(live.requestBubble.curve.getPoint(t));
  if (t >= 1) {
    live.requestBubble = null;
    setTimeout(() => requestBubbleEl.classList.add('hide'), 450);
  }
}

function updateRequestBubblePosition(position) {
  if (!requestBubbleEl) return;
  const rect = canvas.getBoundingClientRect();
  const projected = position.clone().project(camera);
  requestBubbleEl.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`;
  requestBubbleEl.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`;
}

function updateLabels() {
  const rect = canvas.getBoundingClientRect();
  objects.labels.forEach(label => {
    const shouldShow = label.view === ui.view;
    if (!shouldShow) {
      label.element.style.display = 'none';
      return;
    }
    const projected = label.position.clone().project(camera);
    const visible = projected.z > -1 && projected.z < 1;
    label.element.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`;
    label.element.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`;
    label.element.style.display = visible ? 'block' : 'none';
  });
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function setFlow(id, stateName) {
  const element = document.getElementById(id);
  if (!element) return;
  element.className = `flow-step${stateName ? ` ${stateName}` : ''}`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

init();
