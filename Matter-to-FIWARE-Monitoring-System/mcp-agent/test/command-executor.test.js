const assert = require('node:assert/strict');
const test = require('node:test');

const CommandExecutor = require('../src/command-executor');

test('mock command execution is deterministic and explicitly simulated', async () => {
  const executor = new CommandExecutor();

  const execution = await executor.execute(
    'urn:ngsi-ld:MatterDevice:plug-1',
    'TURN_OFF',
    'Operator confirmed overload protection'
  );

  assert.equal(execution.status.value, 'SIMULATED_ACK');
  assert.equal(execution.deviceId.value, 'urn:ngsi-ld:MatterDevice:plug-1');
  assert.equal(execution.action.value, 'TURN_OFF');
  assert.equal(execution.source.value, 'simulator');
});
