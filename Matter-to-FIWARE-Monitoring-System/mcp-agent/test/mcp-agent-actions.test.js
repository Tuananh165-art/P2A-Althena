const assert = require('node:assert/strict');
const test = require('node:test');

const MCPAgent = require('../src/index');

function attr(value, type = 'Text') {
  return { type, value };
}

function createFakeOrion(entities = []) {
  const state = structuredClone(entities);
  const upserts = [];
  const updates = [];

  return {
    state,
    upserts,
    updates,
    async getEntities(type) {
      return state.filter(entity => !type || entity.type === type);
    },
    async getEntity(id) {
      return state.find(entity => entity.id === id) || null;
    },
    async updateEntity(id, attrs) {
      updates.push({ id, attrs });
      const entity = state.find(item => item.id === id);
      if (!entity) return null;
      Object.assign(entity, structuredClone(attrs));
      return 'updated';
    },
    async upsertEntity(id, type, attrs) {
      upserts.push({ id, type, attrs: structuredClone(attrs) });
      const existing = state.find(entity => entity.id === id);
      if (existing) {
        Object.assign(existing, structuredClone(attrs));
        return 'updated';
      }
      state.push({ id, type, ...structuredClone(attrs) });
      return 'created';
    },
    async checkHealth() {
      return { orion: { version: 'test' } };
    }
  };
}

function createAgent(orion, overrides = {}) {
  return new MCPAgent({
    orion,
    deviceAdapter: overrides.deviceAdapter,
    riskEngine: overrides.riskEngine || {
      evaluate() {
        return [{
          zone: 'A',
          riskScore: 10,
          riskLevel: 'normal',
          rationale: 'Normal test conditions',
          recommendedActions: [],
          metrics: {},
          timestamp: new Date().toISOString()
        }];
      }
    },
    aiReasoner: {
      async analyzeRisk(metrics, result) {
        return {
          rationale: result.rationale,
          recommendedActions: result.recommendedActions,
          source: 'rules',
          confidence: 0.95
        };
      }
    }
  });
}

test('invokeCommand persists a truthful command audit to Orion', async () => {
  const orion = createFakeOrion([
    {
      id: 'urn:ngsi-ld:MatterDevice:plug-1',
      type: 'SmartPlug',
      zone: attr('A')
    }
  ]);
  const agent = createAgent(orion);

  const result = await agent.invokeCommand(
    'urn:ngsi-ld:MatterDevice:plug-1',
    'TURN_OFF',
    'Operator confirmed'
  );

  assert.equal(result.status.value, 'SIMULATED_ACK');
  assert.equal(orion.upserts.length, 1);
  assert.equal(orion.upserts[0].type, 'CommandExecution');
  assert.equal(orion.upserts[0].attrs.source.value, 'simulator');
});

test('simulated SmartPlug TURN_OFF updates Orion state with simulator metadata', async () => {
  const adapterCalls = [];
  const orion = createFakeOrion([
    {
      id: 'urn:ngsi-ld:MatterDevice:plug-1',
      type: 'SmartPlug',
      zone: attr('A'),
      onOff: { type: 'Boolean', value: true }
    }
  ]);
  const agent = createAgent(orion, {
    deviceAdapter: {
      async execute(device, action) {
        adapterCalls.push({ device, action });
        return { source: 'fimat-emulator' };
      }
    }
  });

  await agent.invokeCommand(
    'urn:ngsi-ld:MatterDevice:plug-1',
    'TURN_OFF',
    'Operator confirmed'
  );

  const plugUpdate = orion.updates.find(
    update => update.id === 'urn:ngsi-ld:MatterDevice:plug-1'
  );
  assert.equal(plugUpdate.attrs.onOff.value, false);
  assert.equal(plugUpdate.attrs.onOff.metadata.source.value, 'fimat-emulator');
  assert.equal(adapterCalls[0].action, 'TURN_OFF');
});

test('simulated SmartPlug TURN_ON updates Orion state with simulator metadata', async () => {
  const orion = createFakeOrion([
    {
      id: 'urn:ngsi-ld:MatterDevice:plug-1',
      type: 'SmartPlug',
      zone: attr('A'),
      onOff: { type: 'Boolean', value: false }
    }
  ]);
  const agent = createAgent(orion);

  await agent.invokeCommand(
    'urn:ngsi-ld:MatterDevice:plug-1',
    'TURN_ON',
    'Operator confirmed'
  );

  const plugUpdate = orion.updates.find(
    update => update.id === 'urn:ngsi-ld:MatterDevice:plug-1'
  );
  assert.equal(plugUpdate.attrs.onOff.value, true);
  assert.equal(plugUpdate.attrs.onOff.metadata.source.value, 'simulator');
});

test('history is read from Orion and sorted newest first', async () => {
  const orion = createFakeOrion([
    {
      id: 'cmd-old',
      type: 'CommandExecution',
      timestamp: attr('2026-06-01T00:00:00.000Z', 'DateTime')
    },
    {
      id: 'cmd-new',
      type: 'CommandExecution',
      timestamp: attr('2026-06-02T00:00:00.000Z', 'DateTime')
    }
  ]);
  const agent = createAgent(orion);

  const commands = await agent.getCommandHistory(1);

  assert.deepEqual(commands.map(command => command.id), ['cmd-new']);
});

test('acknowledgeAlert updates status and operator audit fields', async () => {
  const orion = createFakeOrion([
    {
      id: 'urn:ngsi-ld:AlertEvent:A_1',
      type: 'AlertEvent',
      status: attr('open')
    }
  ]);
  const agent = createAgent(orion);

  const result = await agent.acknowledgeAlert(
    'urn:ngsi-ld:AlertEvent:A_1',
    'operator@example.com',
    'Investigating panel'
  );

  assert.equal(result.status.value, 'acknowledged');
  assert.equal(result.acknowledgedBy.value, 'operator@example.com');
  assert.equal(result.note.value, 'Investigating panel');
  assert.equal(orion.updates.length, 1);
});

test('simulateScenario discovers devices dynamically and records a SimulationRun', async () => {
  const orion = createFakeOrion([
    {
      id: 'temperature-live-id',
      type: 'TemperatureSensor',
      zone: attr('A')
    },
    {
      id: 'humidity-live-id',
      type: 'HumiditySensor',
      zone: attr('A')
    },
    {
      id: 'plug-live-id',
      type: 'SmartPlug',
      zone: attr('A')
    }
  ]);
  const agent = createAgent(orion);

  const result = await agent.simulateScenario('critical', 'A', 'openclaw');

  assert.equal(result.status, 'SIMULATED');
  assert.equal(result.scenario, 'critical');
  assert.deepEqual(
    result.updatedDevices.map(device => device.id).sort(),
    ['humidity-live-id', 'plug-live-id', 'temperature-live-id']
  );
  assert.equal(
    orion.upserts.some(entry => entry.type === 'SimulationRun'),
    true
  );
  assert.equal(
    orion.updates.some(entry => entry.id === 'plug-live-id'),
    true
  );
});

test('simulateScenario fails when a required device type is missing', async () => {
  const orion = createFakeOrion([
    {
      id: 'temperature-live-id',
      type: 'TemperatureSensor',
      zone: attr('A')
    }
  ]);
  const agent = createAgent(orion);

  await assert.rejects(
    () => agent.simulateScenario('warning', 'A', 'openclaw'),
    /Missing devices for zone A: HumiditySensor, SmartPlug/
  );
});
