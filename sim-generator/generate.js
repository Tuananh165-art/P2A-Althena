#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const args = parseArgs(process.argv.slice(2));
const scenarioName = args.scenario || 'normal';
const duration = parseInt(args.duration || '60', 10);
const rate = parseFloat(args.rate || '1');
const outputFile = args.output;
const sendToOrion = args.send || false;
const orionUrl = process.env.ORION_URL || process.env.ORION_HOST || args.orion;
const verbose = args.verbose || false;

const SCENARIOS = {
  normal: {
    label: 'Normal',
    temperature: t => 22 + noise(0, 2),
    humidity: t => 44 + noise(0, 6),
    plugPower: t => 40 + noise(0, 40),
    voltage: t => 230 + noise(0, 1),
    powerFactor: t => 0.96 + noise(0, 0.03),
    riskLevel: () => 'low',
    offlineDevice: null,
    badDataChance: 0
  },
  'heat-wave': {
    label: 'Heat-wave',
    temperature: t => 28 + Math.min(12, t / 30) * 1.2 + noise(0, 1.8),
    humidity: t => 42 + noise(0, 8) - (t / 120),
    plugPower: t => 80 + Math.min(140, t / 15 * 5) + noise(0, 30),
    voltage: t => 230 - Math.min(4, t / 120) + noise(0, 1),
    powerFactor: t => 0.92 + noise(0, 0.04),
    riskLevel: t => (t > 120 ? 'medium' : 'low'),
    offlineDevice: null,
    badDataChance: 0.02
  },
  overload: {
    label: 'Overload',
    temperature: t => 26 + noise(0, 2),
    humidity: t => 40 + noise(0, 10),
    plugPower: t => 160 + Math.min(800, t / 5 * 100) + noise(0, 90), // Ramp power high for overload
    voltage: t => 228 - Math.min(8, t / 100) + noise(0, 1.2),
    powerFactor: t => 0.85 + noise(0, 0.06),
    riskLevel: () => 'high',
    offlineDevice: null,
    badDataChance: 0.04
  },
  offline: {
    label: 'Device offline',
    temperature: t => 22 + noise(0, 2),
    humidity: t => 45 + noise(0, 7),
    plugPower: t => 35 + noise(0, 35),
    voltage: t => 230 + noise(0, 1),
    powerFactor: t => 0.97 + noise(0, 0.02),
    riskLevel: () => 'low',
    offlineDevice: 'urn:ngsi-ld:SmartPlug:ZoneA_Room102_Server',
    badDataChance: 0.01
  },
  noisy: {
    label: 'Noisy data',
    temperature: t => 24 + noise(0, 2),
    humidity: t => 46 + noise(0, 8),
    plugPower: t => 40 + noise(0, 40),
    voltage: t => 230 + noise(0, 2),
    powerFactor: t => 0.95 + noise(0, 0.05),
    riskLevel: () => 'low',
    offlineDevice: null,
    badDataChance: 0.25
  }
};

const DEVICES = {
  plugs: [
    'urn:ngsi-ld:SmartPlug:ZoneA_Room102_AC',
    'urn:ngsi-ld:SmartPlug:ZoneA_Room102_Server',
    'urn:ngsi-ld:SmartPlug:ZoneA_Room102_Fan'
  ],
  temperatures: [
    'urn:ngsi-ld:TemperatureSensor:ZoneA_Room102_Wiring',
    'urn:ngsi-ld:TemperatureSensor:ZoneA_Outdoor_Ambient'
  ],
  humidity: ['urn:ngsi-ld:HumiditySensor:ZoneA_Room102_Sensor1'],
  zone: 'urn:ngsi-ld:Zone:ZoneA'
};

const scenario = SCENARIOS[scenarioName];
if (!scenario) {
  console.error(`Unknown scenario: ${scenarioName}`);
  console.error('Available scenarios: ' + Object.keys(SCENARIOS).join(', '));
  process.exit(1);
}

const eventCount = Math.max(1, Math.floor(duration * rate));
const intervalMs = Math.max(100, 1000 / rate);
let generated = 0;

async function main() {
  console.log(`Simulation: ${scenario.label}`);
  console.log(`Duration: ${duration}s, Rate: ${rate}/s, Steps: ${eventCount}`);
  if (sendToOrion && !orionUrl) {
    console.error('ORION_URL is required when using --send or --orion');
    process.exit(1);
  }

  const runningEntities = [];
  for (let tick = 0; tick < eventCount; tick++) {
    const timestamp = new Date(Date.now() + tick * intervalMs).toISOString();
    const tickEntities = buildEntitiesForTick(tick, timestamp, duration, scenario);

    if (verbose) {
      console.log(`Tick ${tick + 1}/${eventCount}: ${tickEntities.length} entities`);
    }

    runningEntities.push(...tickEntities);
    generated += tickEntities.length;

    if (sendToOrion) {
      await seedBatchToOrion(tickEntities);
    }

    if (outputFile && tick < eventCount - 1) {
      await wait(intervalMs);
    }
  }

  if (outputFile) {
    const outputPath = path.resolve(process.cwd(), outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(runningEntities, null, 2), 'utf8');
    console.log(`Wrote ${runningEntities.length} events to ${outputPath}`);
  }

  console.log(`Generated ${generated} entity updates.`);
}

function buildEntitiesForTick(tick, timestamp, duration, scenario) {
  const entities = [];
  const zonePower = DEVICES.plugs.reduce((sum, id, index) => {
    if (scenario.offlineDevice === id && tick >= Math.floor(duration / 3) && tick <= Math.floor(duration / 2)) {
      return sum;
    }
    return sum + Math.max(0, scenario.plugPower(tick) + noise(0, 12));
  }, 0);

  const zoneAttrs = {
    id: DEVICES.zone,
    type: 'Zone',
    totalActivePower: entityValue(zonePower, 'Number', 'W', timestamp),
    voltageDrop: entityValue(Math.max(0.5, 3 + (230 - averageVoltage(tick, scenario)) / 2), 'Number', 'V', timestamp),
    riskLevel: entityValue(scenario.riskLevel(tick), 'Text', null, timestamp),
    timestamp: entityValue(timestamp, 'DateTime')
  };
  entities.push(zoneAttrs);

  DEVICES.temperatures.forEach(deviceId => {
    const tempValue = scenario.temperature(tick) + (deviceId.includes('Outdoor') ? 4 : 0) + noise(0, 0.6);
    const battery = 80 + noise(0, 5);
    const zoneVal = deviceId.includes('Outdoor') ? 'Outdoor' : 'A';
    entities.push({
      id: deviceId,
      type: 'TemperatureSensor',
      temperature: entityValue(round(tempValue, 1), 'Number', 'C', timestamp),
      battery: entityValue(Math.min(100, Math.max(0, round(battery, 0))), 'Integer', '%', timestamp),
      zone: entityValue(zoneVal, 'Text'),
      timestamp: entityValue(timestamp, 'DateTime')
    });
  });

  DEVICES.humidity.forEach(deviceId => {
    entities.push({
      id: deviceId,
      type: 'HumiditySensor',
      measuredValue: entityValue(round(scenario.humidity(tick), 1), 'Number', '%RH', timestamp),
      zone: entityValue('A', 'Text'),
      timestamp: entityValue(timestamp, 'DateTime')
    });
  });

  DEVICES.plugs.forEach((deviceId, index) => {
    if (scenario.offlineDevice === deviceId && tick >= Math.floor(duration / 3) && tick <= Math.floor(duration / 2)) {
      return;
    }
    const activePower = Math.max(0, scenario.plugPower(tick) + noise(index * 3, 10));
    const onOff = activePower > 20;
    const currentEstimate = activePower / Math.max(0.1, averageVoltage(tick, scenario) * scenario.powerFactor(tick));
    entities.push({
      id: deviceId,
      type: 'SmartPlug',
      onOff: entityValue(onOff, 'Boolean', null, timestamp),
      activePower: entityValue(round(activePower, 1), 'Number', 'W', timestamp),
      powerFactor: entityValue(round(scenario.powerFactor(tick), 2), 'Number', null, timestamp),
      voltage: entityValue(round(averageVoltage(tick, scenario), 1), 'Number', 'V', timestamp),
      currentEstimate: entityValue(round(currentEstimate, 2), 'Number', 'A', timestamp),
      zone: entityValue('A', 'Text'),
      timestamp: entityValue(timestamp, 'DateTime')
    });
  });

  if (scenario.badDataChance > 0 && Math.random() < scenario.badDataChance) {
    entities.push(buildBadPayload(timestamp));
  }

  return entities;
}

function buildBadPayload(timestamp) {
  const badEntity = {
    id: 'urn:ngsi-ld:SmartPlug:ZoneA_Room102_BadPlug',
    type: 'SmartPlug',
    onOff: entityValue(true, 'Boolean', null, timestamp),
    activePower: entityValue(-5, 'Number', 'W', timestamp),
    powerFactor: entityValue(1.5, 'Number', null, timestamp),
    voltage: entityValue(999, 'Number', 'V', timestamp),
    currentEstimate: entityValue(null, 'Number', 'A', timestamp),
    zone: entityValue('A', 'Text'),
    timestamp: entityValue(timestamp, 'DateTime')
  };
  if (verbose) {
    console.log('  Generated noisy payload: urn:ngsi-ld:SmartPlug:ZoneA_Room102_BadPlug with invalid values');
  }
  return badEntity;
}

function entityValue(value, type, unit, timestamp) {
  const attr = { value };
  if (type) attr.type = type;
  if (unit || timestamp) {
    attr.metadata = {};
    if (unit) {
      attr.metadata.unit = { type: 'string', value: unit };
    }
    if (timestamp) {
      attr.metadata.timestamp = { type: 'string', value: timestamp };
    }
  }
  return attr;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function averageVoltage(tick, scenario) {
  return scenario.voltage(tick);
}

function noise(mean, range) {
  return (Math.random() - 0.5) * range * 2 + mean;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function seedBatchToOrion(entities) {
  const client = axios.create({ baseURL: orionUrl, timeout: 10000 });
  for (const entity of entities) {
    try {
      await client.post('/v2/entities?options=upsert', entity, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (verbose) {
        console.log(`  Sent ${entity.id} to Orion`);
      }
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      console.error(`  Failed to send ${entity.id}: ${status || ''} ${data || error.message}`);
    }
  }
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

main().catch(error => {
  console.error('Simulation failed:', error.message || error);
  process.exit(1);
});
