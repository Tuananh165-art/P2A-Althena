const assert = require('node:assert/strict');
const test = require('node:test');

const AIReasoner = require('../src/ai-reasoner');

test('chat falls back to rules when AI is not configured', async () => {
  const previousEndpoint = process.env.AI_ENDPOINT;
  const previousKey = process.env.AI_API_KEY;
  const previousRequireAI = process.env.AI_CHAT_REQUIRE_AI;

  process.env.AI_ENDPOINT = '';
  process.env.AI_API_KEY = '';
  delete process.env.AI_CHAT_REQUIRE_AI;

  try {
    const reasoner = new AIReasoner();
    const response = await reasoner.chat('ban ten la gi', {
      risks: [],
      zones: ['A'],
      alertCount: 0,
      deviceCount: 3
    });

    assert.equal(response.source, 'rules-fast');
    assert.match(response.text, /OpenClaw/);
  } finally {
    process.env.AI_ENDPOINT = previousEndpoint;
    process.env.AI_API_KEY = previousKey;
    if (previousRequireAI === undefined) {
      delete process.env.AI_CHAT_REQUIRE_AI;
    } else {
      process.env.AI_CHAT_REQUIRE_AI = previousRequireAI;
    }
  }
});

test('chat can still require AI when explicitly configured', async () => {
  const previousEndpoint = process.env.AI_ENDPOINT;
  const previousKey = process.env.AI_API_KEY;
  const previousRequireAI = process.env.AI_CHAT_REQUIRE_AI;

  process.env.AI_ENDPOINT = '';
  process.env.AI_API_KEY = '';
  process.env.AI_CHAT_REQUIRE_AI = 'true';

  try {
    const reasoner = new AIReasoner();
    await assert.rejects(
      () => reasoner.chat('hello', {}),
      /AI chat is required/
    );
  } finally {
    process.env.AI_ENDPOINT = previousEndpoint;
    process.env.AI_API_KEY = previousKey;
    if (previousRequireAI === undefined) {
      delete process.env.AI_CHAT_REQUIRE_AI;
    } else {
      process.env.AI_CHAT_REQUIRE_AI = previousRequireAI;
    }
  }
});
