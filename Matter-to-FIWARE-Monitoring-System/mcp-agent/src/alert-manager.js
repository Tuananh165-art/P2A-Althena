const config = require('../config');

class AlertManager {
  constructor() {
    this.cooldownMap = new Map();
    this.cooldownMs = config.risk.cooldownMs;
    this.alertHistory = [];
  }

  shouldPublish(zone, level) {
    const key = `${zone}:${level}`;
    const last = this.cooldownMap.get(key);
    if (last && Date.now() - last < this.cooldownMs) {
      return false;
    }
    this.cooldownMap.set(key, Date.now());
    return true;
  }

  createAlert(zone, level, message, rationale) {
    const id = `urn:ngsi-ld:AlertEvent:${zone}_${Date.now()}`;
    const alert = {
      id,
      type: 'AlertEvent',
      level: { type: 'Text', value: level },
      zone: { type: 'Text', value: zone },
      message: { type: 'Text', value: message },
      rationale: { type: 'Text', value: rationale },
      status: { type: 'Text', value: 'open' },
      timestamp: { type: 'DateTime', value: new Date().toISOString() }
    };
    this.alertHistory.push(alert);
    if (this.alertHistory.length > 100) this.alertHistory.shift();
    return alert;
  }

  getHistory(limit = 20) {
    return this.alertHistory.slice(-limit);
  }
}

module.exports = AlertManager;
