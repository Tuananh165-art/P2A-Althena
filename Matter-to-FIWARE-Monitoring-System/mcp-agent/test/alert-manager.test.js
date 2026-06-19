const assert = require('node:assert/strict');
const test = require('node:test');

const AlertManager = require('../src/alert-manager');

test('suppresses the same active alert content even with a new timestamp', () => {
  const manager = new AlertManager();

  assert.equal(
    manager.shouldPublish('A', 'warning', 'Climate risk warning in zone A: score 45', 'Heat stress'),
    true
  );
  assert.equal(
    manager.shouldPublish('A', 'warning', 'Climate risk warning in zone A: score 45', 'Heat stress'),
    false
  );
});

test('allows changed alert content immediately', () => {
  const manager = new AlertManager();

  assert.equal(manager.shouldPublish('A', 'warning', 'Score 45', 'Heat stress'), true);
  assert.equal(manager.shouldPublish('A', 'warning', 'Score 70', 'Heat stress'), true);
});

test('allows the same warning again after the zone returns to normal', () => {
  const manager = new AlertManager();

  assert.equal(manager.shouldPublish('A', 'warning', 'Score 45', 'Heat stress'), true);
  manager.clearZone('A');
  assert.equal(manager.shouldPublish('A', 'warning', 'Score 45', 'Heat stress'), true);
});
