const test = require('node:test');
const assert = require('node:assert/strict');

const MCPAgent = require('../src/index');
const config = require('../config');

function createOrion(device) {
  const updates = [];
  return {
    updates,
    async getEntity() {
      return device;
    },
    async updateEntity(id, attrs) {
      updates.push({ id, attrs });
      if (attrs.onOff) device.onOff = attrs.onOff;
      if (attrs.activePower) device.activePower = attrs.activePower;
    },
    async upsertEntity() {}
  };
}

test('simulator mode updates Orion and records simulated acknowledgement', async () => {
  const previousMode = config.control.mode;
  config.control.mode = 'simulator';
  const device = {
    id: 'urn:ngsi-ld:SmartPlug:demo',
    type: 'SmartPlug',
    onOff: { type: 'Boolean', value: true }
  };
  const orion = createOrion(device);
  const agent = new MCPAgent({ orion });

  try {
    const result = await agent.invokeCommand(device.id, 'TURN_OFF', 'test');
    assert.equal(result.status.value, 'SIMULATED_ACK');
    assert.equal(device.onOff.value, false);
    assert.equal(orion.updates.length, 1);
  } finally {
    config.control.mode = previousMode;
  }
});

test('live mode confirms only after reported device state reaches Orion', async () => {
  const previousMode = config.control.mode;
  const previousTimeout = config.control.confirmationTimeoutMs;
  const previousPoll = config.control.confirmationPollMs;
  config.control.mode = 'live';
  config.control.confirmationTimeoutMs = 100;
  config.control.confirmationPollMs = 5;

  const device = {
    id: 'urn:ngsi-ld:ZigbeeDevice:room_plug',
    type: 'SmartPlug',
    protocol: { type: 'Text', value: 'zigbee' },
    friendlyName: { type: 'Text', value: 'room_plug' },
    onOff: { type: 'Boolean', value: true }
  };
  const orion = createOrion(device);
  const deviceAdapter = {
    async execute() {
      device.onOff = { type: 'Boolean', value: false };
      return { source: 'zigbee' };
    }
  };
  const agent = new MCPAgent({ orion, deviceAdapter });

  try {
    const result = await agent.invokeCommand(device.id, 'TURN_OFF', 'test');
    assert.equal(result.status.value, 'CONFIRMED');
    assert.equal(orion.updates.length, 0);
  } finally {
    config.control.mode = previousMode;
    config.control.confirmationTimeoutMs = previousTimeout;
    config.control.confirmationPollMs = previousPoll;
  }
});

test('live adapter failure is recorded without changing reported state', async () => {
  const previousMode = config.control.mode;
  config.control.mode = 'live';
  const device = {
    id: 'urn:ngsi-ld:SmartPlug:no_adapter',
    type: 'SmartPlug',
    onOff: { type: 'Boolean', value: true }
  };
  const orion = createOrion(device);
  const deviceAdapter = {
    async execute() {
      throw new Error('bridge unavailable');
    }
  };
  const agent = new MCPAgent({ orion, deviceAdapter });

  try {
    const result = await agent.invokeCommand(device.id, 'TURN_OFF', 'test');
    assert.equal(result.status.value, 'FAILED');
    assert.equal(result.error.value, 'bridge unavailable');
    assert.equal(device.onOff.value, true);
    assert.equal(orion.updates.length, 0);
  } finally {
    config.control.mode = previousMode;
  }
});
