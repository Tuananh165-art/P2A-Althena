const axios = require('axios');
const config = require('../config');
const fmt = require('./telegram-formatter');

class AlertSubscriber {
  constructor(telegramBot, chatIds) {
    this.bot = telegramBot;
    this.chatIds = chatIds;
    this.seenAlerts = new Set();
    this.sentNotifications = new Set();
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

      const level = alert.level?.value || alert.level || 'warning';
      if (level === 'normal') continue;

      await this.pushAlert(alert);
    }

    if (this.seenAlerts.size > 200) {
      const arr = [...this.seenAlerts];
      this.seenAlerts = new Set(arr.slice(-100));
    }

    if (this.sentNotifications.size > 200) {
      const arr = [...this.sentNotifications];
      this.sentNotifications = new Set(arr.slice(-100));
    }
  }

  notificationFingerprint(alert) {
    const level = alert.level?.value || alert.level || 'warning';
    const zone = alert.zone?.value || alert.zone || 'A';
    const message = alert.message?.value || alert.message || '';
    const rationale = alert.rationale?.value || alert.rationale || '';
    return [level, zone, message, rationale]
      .map(value => String(value || '').trim().toLowerCase())
      .join('|');
  }

  shouldSend(alert) {
    const fingerprint = this.notificationFingerprint(alert);
    if (this.sentNotifications.has(fingerprint)) {
      console.log('[OpenClaw] Duplicate alert notification suppressed');
      return false;
    }
    this.sentNotifications.add(fingerprint);
    return true;
  }

  async pushAlert(alert) {
    const alertId = alert.id || `${alert.zone?.value || alert.zone}-${alert.timestamp?.value || alert.timestamp}`;
    if (this.seenAlerts.has(alertId)) return false;
    this.seenAlerts.add(alertId);

    if (!this.shouldSend(alert)) return false;

    const text = fmt.formatAlertPush(alert);

    for (const chatId of this.chatIds) {
      try {
        await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        console.log(`[OpenClaw] Alert pushed to chat ${chatId}`);
      } catch (e) {
        console.error(`[OpenClaw] Failed to push alert to ${chatId}: ${e.message}`);
      }
    }

    return true;
  }

  seenAlertIds() {
    return [...this.seenAlerts];
  }
}

module.exports = AlertSubscriber;
