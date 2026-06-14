const assert = require('node:assert/strict');
const test = require('node:test');

const MatterController = require('../src/matter-controller');
const HumiditySensorEmulator = require('../../matter-emulators/humidity-sensor');
const SmartPlugEmulator = require('../../matter-emulators/smart-plug');
const TemperatureSensorEmulator = require('../../matter-emulators/temperature-sensor');

test('SmartPlugEmulator setOnOff(false) emits off state and zero power', () => {
  const plug = new SmartPlugEmulator({ nodeId: 2, endpointId: 1, initialState: true });
  const events = [];
  plug.on('data_change', event => events.push(event));

  const status = plug.setOnOff(false, { holdMs: 30000 });

  assert.equal(status.onOff, false);
  assert.equal(status.activePower, 0);
  assert.equal(events.find(event => event.attributeName === 'onOff').attributeValue, false);
  assert.equal(events.find(event => event.attributeName === 'activePower').attributeValue, 0);
});

test('SmartPlugEmulator random toggle respects hold and cooldown', () => {
  const plug = new SmartPlugEmulator({
    nodeId: 2,
    endpointId: 1,
    initialState: true,
    randomToggle: true,
    randomToggleChance: 1,
    minRandomToggleIntervalMs: 60000
  });
  const base = plug.lastRandomToggleAt;

  plug.manualOverrideUntil = base + 120000;
  assert.equal(plug.maybeRandomToggle(base + 61000), false);
  assert.equal(plug.onOff, true);

  plug.manualOverrideUntil = 0;
  assert.equal(plug.maybeRandomToggle(base + 30000), false);
  assert.equal(plug.onOff, true);

  assert.equal(plug.maybeRandomToggle(base + 61000), true);
  assert.equal(plug.onOff, false);
});

test('MatterController routes TURN_OFF to the SmartPlug emulator', async () => {
  const controller = new MatterController();
  const plug = new SmartPlugEmulator({ nodeId: 2, endpointId: 1, initialState: true });
  controller.connectedDevices.set('2', { nodeId: 2, deviceType: 'SmartPlug' });
  controller.deviceInstances.set('2', plug);

  const result = await controller.controlDevice(2, 'TURN_OFF');

  assert.equal(result.status, 'SIMULATED_ACK');
  assert.equal(result.nodeId, 2);
  assert.equal(result.state.onOff, false);
});

test('sensor emulators emit pinned values for scenario hold', () => {
  const humidity = new HumiditySensorEmulator({ nodeId: 1, endpointId: 1 });
  const temperature = new TemperatureSensorEmulator({ nodeId: 3, endpointId: 1 });
  const events = [];
  humidity.on('data_change', event => events.push(event));
  temperature.on('data_change', event => events.push(event));

  humidity.setHumidity(95, { holdMs: 60000 });
  temperature.setTemperature(55, { holdMs: 60000 });

  assert.equal(events.find(event => event.attributeName === 'measuredValue').attributeValue, 95);
  assert.equal(events.find(event => event.attributeName === 'temperature').attributeValue, 55);
});

test('MatterController applies critical scenario hold across all emulators', async () => {
  const controller = new MatterController();
  const humidity = new HumiditySensorEmulator({ nodeId: 1, endpointId: 1 });
  const plug = new SmartPlugEmulator({ nodeId: 2, endpointId: 1, initialState: false });
  const temperature = new TemperatureSensorEmulator({ nodeId: 3, endpointId: 1 });
  controller.connectedDevices.set('1', { nodeId: 1, deviceType: 'HumiditySensor' });
  controller.connectedDevices.set('2', { nodeId: 2, deviceType: 'SmartPlug' });
  controller.connectedDevices.set('3', { nodeId: 3, deviceType: 'TemperatureSensor' });
  controller.deviceInstances.set('1', humidity);
  controller.deviceInstances.set('2', plug);
  controller.deviceInstances.set('3', temperature);

  const result = await controller.applyScenario('critical', { holdMs: 60000 });

  assert.equal(result.status, 'SCENARIO_HELD');
  assert.equal(result.scenario, 'critical');
  assert.equal(result.holdMs, 60000);
  assert.equal(result.states.temperature.temperature, 55);
  assert.equal(result.states.humidity.currentHumidity, 95);
  assert.equal(result.states.smartPlug.onOff, true);
  assert.equal(result.states.smartPlug.activePower, 980);
});
