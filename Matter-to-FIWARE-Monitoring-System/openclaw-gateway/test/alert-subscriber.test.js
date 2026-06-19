const assert = require('node:assert/strict');
const test = require('node:test');

const AlertSubscriber = require('../src/alert-subscriber');

function createSubscriber() {
  const sent = [];
  const bot = {
    async sendMessage(chatId, text, options) {
      sent.push({ chatId, text, options });
    }
  };
  return { sent, subscriber: new AlertSubscriber(bot, ['chat-1']) };
}

test('pushAlert sends the first notification and suppresses duplicate content', async () => {
  const { sent, subscriber } = createSubscriber();
  const alert = {
    id: 'alert-1',
    level: { value: 'warning' },
    zone: { value: 'A' },
    message: { value: 'Climate risk warning in zone A: score 45' },
    rationale: { value: 'Heat stress' },
    timestamp: { value: '2026-06-18T04:00:00.000Z' }
  };

  assert.equal(await subscriber.pushAlert(alert), true);
  assert.equal(await subscriber.pushAlert({ ...alert, id: 'alert-2' }), false);
  assert.equal(sent.length, 1);
});

test('pushAlert allows different notification content without zone cooldown', async () => {
  const { sent, subscriber } = createSubscriber();

  assert.equal(await subscriber.pushAlert({
    level: 'warning',
    zone: 'A',
    message: 'Score 45',
    rationale: 'Heat stress'
  }), true);
  assert.equal(await subscriber.pushAlert({
    level: 'critical',
    zone: 'A',
    message: 'Score 92',
    rationale: 'Overload'
  }), true);
  assert.equal(sent.length, 2);
});
