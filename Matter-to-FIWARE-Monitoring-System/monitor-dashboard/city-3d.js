import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

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
  dark: 0x1d2633
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
  room: 'utility',
  smartPlugId: 'urn:ngsi-ld:MatterDevice:2_1',
  tempId: 'urn:ngsi-ld:MatterDevice:3_1',
  humidityId: 'urn:ngsi-ld:MatterDevice:1_1'
};

const fallbackLayout = {
  [affected.humidityId]: { label: 'Humidity sensor' },
  [affected.smartPlugId]: { label: 'Smart plug' },
  [affected.tempId]: { label: 'Temperature sensor' }
};

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

function ngsiValue(value) {
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
    return value.value;
  }
  return value;
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

function addLights() {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb4c0ce, 2.1));

  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(10, 24, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xd7ecff, 0.75);
  fill.position.set(-12, 9, -10);
  scene.add(fill);
}

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
}

function addRoad(x, z, w, d) {
  const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), mat(colors.road, { roughness: 0.96 }));
  road.position.set(x, 0.02, z);
  road.receiveShadow = true;
  objects.zones.add(road);
}

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

    for (let i = 0; i < Math.floor(h * 1.2); i += 1) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.16),
        mat(0xf4d389, { transparent: true, opacity: 0.76, emissive: 0xf4d389, emissiveIntensity: 0.24 })
      );
      win.position.set(shell.position.x, 0.55 + i * 0.42, shell.position.z + 0.92);
      objects.zones.add(win);
    }
  });
}

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
        mat(isDemoRoom ? 0x9fc7f2 : 0xdfe7ef, {
          transparent: true,
          opacity: isDemoFloor ? 0.88 : 0.58,
          emissive: isDemoRoom ? 0x2368bd : 0x000000,
          emissiveIntensity: isDemoRoom ? 0.08 : 0
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

function buildRoomDetail() {
  const roomGroup = objects.room;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.16, 6), mat(0xd6dee8, { roughness: 0.82 }));
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  roomGroup.add(floor);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(8.8, 3.1, 0.16), mat(0xf5f7fa));
  backWall.position.set(0, 1.55, -2.92);
  backWall.receiveShadow = true;
  roomGroup.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.1, 6), mat(0xe9eef4));
  leftWall.position.set(-4.42, 1.55, 0);
  leftWall.receiveShadow = true;
  roomGroup.add(leftWall);

  const rightWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1),
    mat(0xb8d5ef, { transparent: true, opacity: 0.8, emissive: 0x91c4ef, emissiveIntensity: 0.05 })
  );
  rightWindow.position.set(2.65, 1.85, -2.82);
  roomGroup.add(rightWindow);

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

  const roomLight = new THREE.PointLight(colors.warmLight, 2.2, 7.5);
  roomLight.position.set(0, 2.3, -0.2);
  roomGroup.add(roomLight);

  const mcpNode = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.58, 0.52, 28),
    mat(colors.mcp, { emissive: colors.mcp, emissiveIntensity: 0.18 })
  );
  mcpNode.position.set(-1.4, 0.45, 3.25);
  mcpNode.castShadow = true;
  roomGroup.add(mcpNode);

  const requestNode = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.48, 0.3),
    mat(colors.command, { emissive: colors.command, emissiveIntensity: 0.16 })
  );
  requestNode.position.set(-3.2, 0.45, 3.25);
  requestNode.castShadow = true;
  roomGroup.add(requestNode);

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
    requestNode
  };

  createLabel('Smart plug', plug.position.clone().add(new THREE.Vector3(0, 0.55, 0)), 'room', 'device');
  createLabel('Ceiling lamp load', lamp.group.position.clone().add(new THREE.Vector3(0, 0.45, 0)), 'room', 'device');
  createLabel('Temperature', temp.position.clone().add(new THREE.Vector3(0, 0.45, 0)), 'room', 'device');
  createLabel('MCP decision', mcpNode.position.clone().add(new THREE.Vector3(0, 0.62, 0)), 'room', 'hint');
}

function createSmartPlug() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.58, 0.26), mat(0xf8fafc, { roughness: 0.38 }));
  body.name = 'body';
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.04), mat(0xe5ebf2));
  face.position.z = 0.16;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 12), mat(colors.plugOn, { emissive: colors.plugOn, emissiveIntensity: 1.2 }));
  led.position.set(0.27, 0.18, 0.19);
  led.name = 'led';
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.04, 24), mat(colors.plugOn));
  button.rotation.x = Math.PI / 2;
  button.position.set(0, -0.15, 0.19);
  button.name = 'button';
  const holeA = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 18), mat(colors.dark));
  const holeB = holeA.clone();
  holeA.rotation.x = Math.PI / 2;
  holeB.rotation.x = Math.PI / 2;
  holeA.position.set(-0.12, 0.04, 0.19);
  holeB.position.set(0.12, 0.04, 0.19);
  group.add(body, face, led, button, holeA, holeB);
  return group;
}

function createLamp() {
  const group = new THREE.Group();
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 28), mat(0xc8d2dd));
  mount.position.y = 0.22;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.34, 0.3, 36, 1, true), mat(0xf7f9fb, { transparent: true, opacity: 0.94 }));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), mat(colors.warmLight, { emissive: colors.warmLight, emissiveIntensity: 1.25 }));
  bulb.position.y = -0.13;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.86, 28, 18), mat(colors.warmLight, { transparent: true, opacity: 0.17, emissive: colors.warmLight, emissiveIntensity: 0.9 }));
  glow.position.y = -0.18;
  group.add(mount, shade, bulb, glow);
  return { group, mount, shade, bulb, glow };
}

function createSensor(kind) {
  const group = new THREE.Group();
  const accent = kind === 'temperature' ? colors.sensor : colors.humidity;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.48, 0.12), mat(0xf7f9fb));
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.035), mat(accent, { emissive: accent, emissiveIntensity: 0.32 }));
  screen.position.z = 0.08;
  screen.name = 'screen';
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10), mat(0xffffff, { emissive: accent, emissiveIntensity: 0.34 }));
  dot.position.set(0.24, 0.14, 0.09);
  group.add(body, screen, dot);
  return group;
}

function createCable(points, radius, color) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 42, radius, 8, false),
    mat(color, { roughness: 0.64 })
  );
}

function createLabel(text, position, view, kind = '') {
  const element = document.createElement('div');
  element.className = `city-label${kind ? ` ${kind}` : ''}`;
  element.textContent = text;
  labelLayer.appendChild(element);
  const label = { element, position, view, kind };
  objects.labels.push(label);
  return label;
}

function normalizeDevice(entity) {
  const fallback = fallbackLayout[entity.id] || {};
  return {
    id: entity.id,
    type: entity.type,
    label: ngsiValue(entity.displayName) || fallback.label || entity.type,
    onOff: ngsiValue(entity.onOff),
    power: ngsiValue(entity.activePower),
    temperature: ngsiValue(entity.temperature),
    humidity: ngsiValue(entity.measuredValue)
  };
}

function getDevices() {
  return live.entities
    .filter(entity => ['HumiditySensor', 'SmartPlug', 'TemperatureSensor'].includes(entity.type))
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
  return devices.find(device => device.type === 'SmartPlug');
}

function getTemperature(devices = getDevices()) {
  return devices.find(device => device.type === 'TemperatureSensor');
}

function getHumidity(devices = getDevices()) {
  return devices.find(device => device.type === 'HumiditySensor');
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
  const plugOff = plug?.onOff === false;
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

  const plugOff = plug?.onOff === false;
  const riskColor = getRiskColor(level);
  const temp = getTemperature(devices);
  const humidity = getHumidity(devices);

  parts.hazardPad.material.opacity = level === 'critical' && !plugOff ? 0.28 : level === 'warning' ? 0.16 : 0;
  parts.hazardPad.material.color.setHex(riskColor);
  parts.hazardPad.material.emissive.setHex(riskColor);
  parts.darkness.material.opacity = plugOff ? 0.38 : 0;

  const led = parts.plug.getObjectByName('led');
  const button = parts.plug.getObjectByName('button');
  const plugColor = plugOff ? colors.off : colors.plugOn;
  led.material.color.setHex(plugColor);
  led.material.emissive.setHex(plugOff ? 0x000000 : plugColor);
  led.material.emissiveIntensity = plugOff ? 0 : 1.2;
  button.material.color.setHex(plugColor);

  parts.liveCable.visible = !plugOff;
  parts.liveCable.material.color.setHex(level === 'critical' ? colors.critical : colors.plugOn);
  parts.liveCable.material.emissive.setHex(level === 'critical' ? colors.critical : colors.plugOn);
  parts.liveCable.material.emissiveIntensity = level === 'critical' ? 0.95 : 0.72;
  parts.cable.material.color.setHex(plugOff ? colors.off : colors.cable);

  const lampColor = plugOff ? colors.off : level === 'critical' ? colors.critical : colors.warmLight;
  parts.lamp.bulb.material.color.setHex(lampColor);
  parts.lamp.bulb.material.emissive.setHex(plugOff ? 0x000000 : lampColor);
  parts.lamp.bulb.material.emissiveIntensity = plugOff ? 0 : level === 'critical' ? 1.4 : 1.1;
  parts.lamp.glow.visible = !plugOff;
  parts.lamp.glow.material.color.setHex(lampColor);
  parts.lamp.glow.material.emissive.setHex(lampColor);
  parts.lamp.glow.material.opacity = level === 'critical' ? 0.24 : 0.16;
  parts.roomLight.intensity = plugOff ? 0 : level === 'critical' ? 1.15 : 2.2;
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
  setText('city-plug', ui.selectedZone === 'A' && plug ? plug.onOff ? 'ON - lamp powered' : 'OFF - lamp dark' : '--');
  setText('city-rationale', ui.selectedZone === 'A'
    ? risk.rationale || 'Waiting for MCP risk evaluation.'
    : 'This zone is city context only in the current demo.');

  if (!live.replay.active) {
    const elevated = ui.selectedZone === 'A' && ['warning', 'critical'].includes(level);
    const off = ui.selectedZone === 'A' && plug?.onOff === false;
    setFlow('flow-sensor', elevated ? (level === 'critical' ? 'danger' : 'active') : '');
    setFlow('flow-orion', elevated ? 'active' : '');
    setFlow('flow-mcp', level === 'critical' ? 'danger' : level === 'warning' ? 'active' : '');
    setFlow('flow-plug', off ? 'active' : '');
    setFlow('flow-room', off ? 'active' : '');
  }
}

async function refreshLiveData() {
  try {
    const [entitiesRes, riskRes, commandsRes] = await Promise.all([
      fetch(`${ORION_URL}/v2/entities`, { headers: { Accept: 'application/json' } }),
      fetch(`${MCP_URL}/risk?zone=A`),
      fetch(`${MCP_URL}/commands?limit=8`)
    ]);

    if (entitiesRes.ok) {
      live.entities = await entitiesRes.json();
      state.lastUpdate = new Date().toLocaleTimeString('vi-VN');
      setText('last-update', state.lastUpdate);
      setConnectionStatus('orion', true, 'Connected');
    }
    if (riskRes.ok) {
      live.risk = await riskRes.json();
      setConnectionStatus('mcp', true, 'Running');
    }
    if (commandsRes.ok) {
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
  const plug = getSmartPlug();
  if (plug?.onOff === false) return;
  const res = await fetch(`${MCP_URL}/tools/invoke_command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: affected.smartPlugId,
      action: 'TURN_OFF',
      reason: 'Replay incident safety cut for Zone A',
      requestedBy: 'dashboard'
    })
  });
  if (!res.ok) throw new Error(`MCP command returned ${res.status}`);
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

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const time = clock.elapsedTime;

  camera.position.lerp(ui.cameraTarget, 0.08);
  camera.lookAt(ui.lookTarget);

  const level = getLevel();
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

  updateRequestBubble(delta);
  updateLabels();
  renderer.render(scene, camera);
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
