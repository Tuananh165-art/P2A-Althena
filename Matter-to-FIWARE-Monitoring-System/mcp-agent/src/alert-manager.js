class AlertManager {
  constructor() {
    this.alertHistory = [];
    this.activeFingerprints = new Map();
  }

  alertFingerprint(zone, level, message = '', rationale = '') {
    return [
      zone,
      level,
      message,
      rationale
    ].map(value => String(value || '').trim().toLowerCase()).join('|');
  }

  shouldPublish(zone, level, message = '', rationale = '') {
    const key = `${zone}:${level}`;
    const fingerprint = this.alertFingerprint(zone, level, message, rationale);
    if (this.activeFingerprints.get(key) === fingerprint) {
      return false;
    }
    this.activeFingerprints.set(key, fingerprint);
    return true;
  }

  clearZone(zone) {
    for (const key of this.activeFingerprints.keys()) {
      if (key.startsWith(`${zone}:`)) {
        this.activeFingerprints.delete(key);
      }
    }
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
