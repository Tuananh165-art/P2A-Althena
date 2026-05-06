require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const skillRouter = require('./skill-router');
const AlertSubscriber = require('./alert-subscriber');

// ============================================
// Telegram Bot
// ============================================

let bot = null;
let alertSubscriber = null;

function initTelegram() {
  const token = config.telegram.token;
  if (!token) {
    console.warn('[OpenClaw] TELEGRAM_BOT_TOKEN not set — Telegram disabled');
    return false;
  }

  bot = new TelegramBot(token, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // Chat ID whitelist check
    if (config.telegram.allowedChatIds.length > 0 &&
        !config.telegram.allowedChatIds.includes(String(chatId))) {
      console.log(`[OpenClaw] Blocked message from unauthorized chat ${chatId}`);
      return;
    }

    console.log(`[OpenClaw] Message from ${msg.from?.username || chatId}: ${text}`);

    try {
      const response = await skillRouter.route(text);
      await bot.sendMessage(chatId, response.text, { parse_mode: 'HTML' });
      console.log(`[OpenClaw] Replied (${response.skill}) to ${chatId}`);
    } catch (e) {
      console.error(`[OpenClaw] Error handling message: ${e.message}`);
      await bot.sendMessage(chatId, `❌ Error: ${e.message}. Make sure MCP Agent is running.`);
    }
  });

  bot.on('polling_error', (err) => {
    console.error(`[OpenClaw] Polling error: ${err.message}`);
  });

  console.log('[OpenClaw] Telegram bot started');

  // Start alert subscriber
  if (config.telegram.allowedChatIds.length > 0) {
    alertSubscriber = new AlertSubscriber(bot, config.telegram.allowedChatIds);
    alertSubscriber.start();
  } else {
    console.warn('[OpenClaw] No allowed chat IDs — alert push disabled');
  }

  return true;
}

// ============================================
// Express API (health + webhook)
// ============================================

function initExpress() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'OpenClaw Gateway',
      telegram: bot ? 'connected' : 'disabled',
      alertSubscriber: alertSubscriber?.running ? 'running' : 'stopped',
      uptime: process.uptime()
    });
  });

  app.get('/skills', (req, res) => {
    res.json({
      skills: [
        { name: 'query-risk', trigger: 'risk, danger, safety, fire' },
        { name: 'get-alerts', trigger: 'alerts, warnings, notifications' },
        { name: 'device-control', trigger: 'turn on/off, switch, activate' },
        { name: 'system-status', trigger: 'status, health, diagnostics' },
        { name: 'simulate-scenario', trigger: 'simulate, demo, test' }
      ]
    });
  });

  // Webhook for MCP Agent to push alerts directly
  app.post('/webhook/alert', async (req, res) => {
    const alert = req.body;
    if (!alert) return res.status(400).json({ error: 'No alert body' });

    console.log(`[OpenClaw] Webhook alert received: ${alert.level} zone=${alert.zone}`);

    if (alertSubscriber) {
      await alertSubscriber.pushAlert(alert);
    } else if (bot && config.telegram.allowedChatIds.length > 0) {
      const fmt = require('./telegram-formatter');
      const text = fmt.formatAlertPush(alert);
      for (const chatId of config.telegram.allowedChatIds) {
        try {
          await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        } catch (e) {
          console.error(`[OpenClaw] Webhook push failed: ${e.message}`);
        }
      }
    }

    res.json({ status: 'ok', message: 'Alert forwarded' });
  });

  // Manual trigger for testing
  app.post('/test/send', async (req, res) => {
    const { chatId, message } = req.body;
    if (!bot) return res.status(503).json({ error: 'Telegram not connected' });
    if (!chatId) return res.status(400).json({ error: 'chatId required' });

    try {
      await bot.sendMessage(chatId, message || '🔔 Test message from OpenClaw Gateway', { parse_mode: 'HTML' });
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  const PORT = config.gateway.port;
  app.listen(PORT, () => {
    console.log(`[OpenClaw] Gateway API on http://localhost:${PORT}`);
  });
}

// ============================================
// Main
// ============================================

if (require.main === module) {
  console.log('\n[OpenClaw] Starting Climate Resilience Copilot Gateway');
  console.log('[OpenClaw] ================================');

  initTelegram();
  initExpress();

  process.on('SIGINT', () => {
    console.log('\n[OpenClaw] Shutting down...');
    if (alertSubscriber) alertSubscriber.stop();
    if (bot) bot.stopPolling();
    process.exit(0);
  });
}

module.exports = { initTelegram, initExpress };
