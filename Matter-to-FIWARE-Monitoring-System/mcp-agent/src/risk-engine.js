const config = require('../config');

class RiskEngine {
  constructor() {
    this.thresholds = config.risk.thresholds;
  }

  evaluate(entities) {
    const zones = this.groupByZone(entities);
    const results = [];

    for (const [zone, zoneEntities] of Object.entries(zones)) {
      const result = this.evaluateZone(zone, zoneEntities);
      if (result) results.push(result);
    }

    return results;
  }

  groupByZone(entities) {
    const zones = { A: [] };
    for (const entity of entities) {
      const zone = entity.zone?.value || entity.zone || 'A';
      if (!zones[zone]) zones[zone] = [];
      zones[zone].push(entity);
    }
    return zones;
  }

  evaluateZone(zone, entities) {
    let maxHumidity = 0;
    let maxPower = 0;
    let maxTemp = 0;
    let hasPlugOn = false;
    const rationaleParts = [];

    for (const entity of entities) {
      if (entity.type === 'HumiditySensor') {
        const val = entity.measuredValue?.value ?? 0;
        maxHumidity = Math.max(maxHumidity, val);
      }
      if (entity.type === 'SmartPlug') {
        const power = entity.activePower?.value ?? 0;
        const onOff = entity.onOff?.value ?? false;
        maxPower = Math.max(maxPower, power);
        if (onOff) hasPlugOn = true;
      }
      if (entity.type === 'TemperatureSensor') {
        const temp = entity.temperature?.value ?? 0;
        maxTemp = Math.max(maxTemp, temp);
      }
    }

    let riskScore = 0;
    let riskLevel = 'normal';

    // === PRIMARY: Electrical Fire Risk from Heat Wave ===

    // Temperature scoring — direct fire risk indicator
    if (maxTemp >= this.thresholds.temperature.critical) {
      riskScore += 40;
      rationaleParts.push(`Temperature ${maxTemp.toFixed(1)}°C — critical fire risk from wiring overheat (threshold ${this.thresholds.temperature.critical}°C)`);
    } else if (maxTemp >= this.thresholds.temperature.warning) {
      riskScore += 20;
      rationaleParts.push(`Temperature ${maxTemp.toFixed(1)}°C — heat stress on electrical insulation (threshold ${this.thresholds.temperature.warning}°C)`);
    }

    // Power scoring — electrical overload during heat wave
    if (maxPower >= this.thresholds.activePower.critical) {
      riskScore += 30;
      rationaleParts.push(`Power ${maxPower}W — electrical overload risk during extreme heat (threshold ${this.thresholds.activePower.critical}W)`);
    } else if (maxPower >= this.thresholds.activePower.warning) {
      riskScore += 15;
      rationaleParts.push(`Power ${maxPower}W — elevated load from cooling demand (threshold ${this.thresholds.activePower.warning}W)`);
    }

    // COMPOUND: High temperature + high power = electrical fire from heat wave overload
    if (maxTemp >= this.thresholds.temperature.warning && maxPower >= this.thresholds.activePower.warning) {
      riskScore += 25;
      rationaleParts.push('COMPOUND FIRE RISK: heat wave causing electrical overload — wiring overheat + high current = short circuit risk');
    }

    // Critical combo: temp + power both critical
    if (maxTemp >= this.thresholds.temperature.critical && maxPower >= this.thresholds.activePower.critical) {
      riskScore += 10;
      rationaleParts.push('CRITICAL: imminent electrical fire risk — immediate load shedding required');
    }

    // === SECONDARY: Humidity (short circuit risk when combined with power) ===
    if (maxHumidity >= this.thresholds.humidity.critical && maxPower >= this.thresholds.activePower.warning) {
      riskScore += 15;
      rationaleParts.push(`Humidity ${maxHumidity.toFixed(1)}% + high power — moisture-induced short circuit risk`);
    } else if (maxHumidity >= this.thresholds.humidity.warning) {
      riskScore += 5;
      rationaleParts.push(`Humidity ${maxHumidity.toFixed(1)}% — monitor for moisture-related insulation degradation`);
    }

    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 35) riskLevel = 'warning';

    if (rationaleParts.length === 0) {
      rationaleParts.push('All electrical and thermal indicators within safe range — no fire risk detected');
    }

    const recommendedActions = [];
    if (riskLevel === 'critical') {
      recommendedActions.push('CUT_POWER_IMMEDIATELY', 'TURN_ON_ALERT_LAMP', 'NOTIFY_OPERATOR', 'EVACUATE_ZONE');
    } else if (riskLevel === 'warning') {
      recommendedActions.push('REDUCE_LOAD', 'MONITOR_CLOSELY', 'NOTIFY_OPERATOR');
    }

    return {
      zone,
      riskScore: Math.min(riskScore, 100),
      riskLevel,
      rationale: rationaleParts.join('; '),
      recommendedActions,
      metrics: { maxHumidity, maxPower, maxTemp, hasPlugOn },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = RiskEngine;
