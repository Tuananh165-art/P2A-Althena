const axios = require('axios');
const config = require('../config');
const fmt = require('./telegram-formatter');

class AlertSubscriber {
  constructor(telegramBot, chatIds) {
    this.bot = telegramBot;
    this.chatIds = chatIds;
    this.seenAlerts = new Set();
    this.cooldowns = new Map();
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log(`[OpenClaw] Alert subscriber started (poll every ${config.alert.pollInterval}ms)`);
    this.poll();
  }

  stop() {
    this.running = false;
    console.log('[OpenClaw] Alert subscriber stopped');
  }

  async poll() {
    if (!this.running) return;

    try {
      await this.checkAlerts();
    } catch (e) {
      console.error(`[OpenClaw] Alert poll error: ${e.message}`);
    }

    setTimeout(() => this.poll(), config.alert.pollInterval);
  }

  async checkAlerts() {
    const { data: alerts } = await axios.get(`${config.mcp.url}/alerts`, {
      params: { limit: 10 },
      timeout: 3000
    });

    if (!alerts?.length) return;

    for (const alert of alerts) {
      const alertId = alert.id || `${alert.zone?.value}-${alert.timestamp?.value}`;
      if (this.seenAlerts.has(alertId)) continue;

      this.seenAlerts.add(alertId);

      const level = alert.level?.value || alert.level || 'warning';
      if (level === 'normal') continue;

      const zone = alert.zone?.value || alert.zone || 'A';
      if (!this.canSend(zone)) continue;

      await this.pushAlert(alert);

      this.cooldowns.set(zone, Date.now());
    }

    if (this.seenAlerts.size > 200) {
      const arr = [...this.seenAlerts];
      this.seenAlerts = new Set(arr.slice(-100));
    }
  }

  canSend(zone) {
    const lastSent = this.cooldowns.get(zone);
    if (!lastSent) return true;
    return Date.now() - lastSent > config.alert.cooldownMs;
  }

  async pushAlert(alert) {
    const text = fmt.formatAlertPush(alert);

    for (const chatId of this.chatIds) {
      try {
        await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        console.log(`[OpenClaw] Alert pushed to chat ${chatId}`);
      } catch (e) {
        console.error(`[OpenClaw] Failed to push alert to ${chatId}: ${e.message}`);
      }
    }
  }

  seenAlertIds() {
    return [...this.seenAlerts];
  }
}

module.exports = AlertSubscriber;
