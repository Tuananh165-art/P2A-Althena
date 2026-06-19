require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const OrionClient = require('./orion-client');
const RiskEngine = require('./risk-engine');
const AlertManager = require('./alert-manager');
const CommandExecutor = require('./command-executor');
const AIReasoner = require('./ai-reasoner');
const config = require('../config');

const DEVICE_TYPES = new Set(['HumiditySensor', 'SmartPlug', 'TemperatureSensor', 'MatterDevice']);
const CONTROL_ACTIONS = new Set(['TURN_ON', 'TURN_OFF']);
const SCENARIOS = {
  normal: { temperature: 29, humidity: 55, power: 120, plugOn: true },
  warning: { temperature: 44, humidity: 82, power: 860, plugOn: true },
  critical: { temperature: 55, humidity: 95, power: 980, plugOn: true }
};
const SEED_SCENARIO_ALIASES = {};
const SEED_DIR = path.resolve(__dirname, '..', '..', '..', 'sim-seed');

function safetyPolicy() {
  return {
    sensitiveActionsRequireApproval: config.safety.requireOperatorApproval,
    autoCriticalActionsEnabled: config.safety.autoCriticalActions,
    firstReminderSec: config.safety.escalationFirstReminderSec,
    backupEscalationSec: config.safety.escalationBackupSec,
    criticalActionMode: config.safety.autoCriticalActions ? 'AUTO_SIMULATION' : 'HUMAN_APPROVAL_REQUIRED'
  };
}

function attr(type, value, metadata) {
  const out = { type, value };
  if (metadata) out.metadata = metadata;
  return out;
}

function ngsiValue(value) {
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
    return value.value;
  }
  return value;
}

function summarizeSeedScenario(scenario) {
  const seedName = SEED_SCENARIO_ALIASES[scenario] || scenario;
  const filePath = path.join(SEED_DIR, `${seedName}.json`);
  if (!fs.existsSync(filePath)) {
    return { values: SCENARIOS[scenario], sourceScenario: scenario, seedFile: null };
  }

  const entities = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const list = Array.isArray(entities) ? entities : [entities];
  const zoneA = list.filter(entity => entityZone(entity) === 'A');
  const sourceEntities = zoneA.length ? zoneA : list;
  const temps = sourceEntities
    .filter(entity => entity.type === 'TemperatureSensor')
    .map(entity => Number(ngsiValue(entity.temperature)))
    .filter(Number.isFinite);
  const hums = sourceEntities
    .filter(entity => entity.type === 'HumiditySensor')
    .map(entity => Number(ngsiValue(entity.measuredValue)))
    .filter(Number.isFinite);
  const plugs = sourceEntities.filter(entity => entity.type === 'SmartPlug');
  const powers = plugs
    .map(entity => Number(ngsiValue(entity.activePower)))
    .filter(Number.isFinite);
  const anyPlugOn = plugs.some(entity => ngsiValue(entity.onOff) !== false);

  return {
    values: {
      temperature: temps.length ? Math.max(...temps) : SCENARIOS[scenario]?.temperature ?? 0,
      humidity: hums.length ? Math.max(...hums) : SCENARIOS[scenario]?.humidity ?? 0,
      power: powers.length ? Math.max(...powers) : SCENARIOS[scenario]?.power ?? 0,
      plugOn: plugs.length ? anyPlugOn : SCENARIOS[scenario]?.plugOn ?? true
    },
    sourceScenario: seedName,
    seedFile: filePath
  };
}

function entityZone(entity) {
  return ngsiValue(entity.zone) || 'A';
}

function parseMatterNodeId(deviceId) {
  const match = String(deviceId || '').match(/MatterDevice:(\d+)_/);
  return match ? match[1] : null;
}

function deviceProtocol(device) {
  const explicit = String(ngsiValue(device.protocol) || ngsiValue(device.source) || '').toLowerCase();
  if (explicit) return explicit;
  if (String(device.id || '').includes(':ZigbeeDevice:')) return 'zigbee';
  if (parseMatterNodeId(device.id)) return 'matter';
  return '';
}

function sortByTimestampNewestFirst(items) {
  return items.sort((a, b) => {
    const aTime = new Date(ngsiValue(a.timestamp) || 0).getTime();
    const bTime = new Date(ngsiValue(b.timestamp) || 0).getTime();
    return bTime - aTime;
  });
}

function createFimatDeviceAdapter() {
  return {
    async execute(device, action) {
      const protocol = deviceProtocol(device);
      if (protocol === 'zigbee') {
        const friendlyName = ngsiValue(device.friendlyName);
        if (!friendlyName) {
          throw new Error(`Zigbee device ${device.id} has no friendlyName`);
        }
        const { data } = await axios.post(
          `${config.zigbee.baseUrl()}/devices/${encodeURIComponent(friendlyName)}/control`,
          { state: action === 'TURN_ON' ? 'ON' : 'OFF' },
          { timeout: 5000 }
        );
        return { ...data, source: 'zigbee', reportedStateRequired: true };
      }

      const nodeId = parseMatterNodeId(device.id);
      if (!nodeId) {
        throw new Error(`No live control adapter for ${device.id}`);
      }

      const { data } = await axios.post(
        `${config.fimat.baseUrl()}/devices/${nodeId}/control`,
        { action },
        { timeout: 5000 }
      );
      return { ...(data || {}), source: 'matter', reportedStateRequired: true };
    },

    async simulate(scenario, holdMs) {
      const { data } = await axios.post(
        `${config.fimat.baseUrl()}/scenario`,
        { scenario, holdMs },
        { timeout: 5000 }
      );
      return data || { source: 'fimat-emulator' };
    }
  };
}

class MCPAgent {
  constructor(deps = {}) {
    this.orion = deps.orion || new OrionClient();
    this.riskEngine = deps.riskEngine || new RiskEngine();
    this.alertManager = deps.alertManager || new AlertManager();
    this.commandExecutor = deps.commandExecutor || new CommandExecutor();
    this.aiReasoner = deps.aiReasoner || new AIReasoner();
    this.hasCustomDeviceAdapter = Boolean(deps.deviceAdapter);
    this.deviceAdapter = deps.deviceAdapter || createFimatDeviceAdapter();
    this.lastRiskResults = [];
    this.running = false;
    this.lastCriticalActionAt = new Map();
  }

  async start() {
    console.log('\n[MCP] Starting Climate Resilience MCP Agent');
    console.log('[MCP] ================================');

    const health = await this.orion.checkHealth();
    if (!health) {
      console.error('[MCP] Cannot connect to Orion. Retrying...');
      await new Promise(r => setTimeout(r, 5000));
      const retry = await this.orion.checkHealth();
      if (!retry) {
        console.error('[MCP] Orion unavailable. Starting in degraded mode.');
      }
    } else {
      console.log(`[MCP] Connected to Orion v${health.orion?.version || 'unknown'}`);
    }

    this.running = true;
    this.pollLoop();
    console.log(`[MCP] Polling every ${config.agent.pollInterval}ms`);
  }

  async pollLoop() {
    if (!this.running) return;

    try {
      await this.evaluateAndAct();
    } catch (e) {
      console.error(`[MCP] Poll error: ${e.message}`);
    }

    setTimeout(() => this.pollLoop(), config.agent.pollInterval);
  }

  async evaluateAndAct(bypassCooldown = false) {
    const entities = await this.orion.getEntities();
    const riskResults = this.riskEngine.evaluate(entities);
    this.lastRiskResults = riskResults;

    for (const result of riskResults) {
      let aiAnalysis;
      try {
        aiAnalysis = await this.aiReasoner.analyzeRisk(result.metrics, result);
      } catch (e) {
        console.error(`[MCP] AI analysis error: ${e.message}`);
        aiAnalysis = {
          rationale: result.rationale,
          recommendedActions: result.recommendedActions,
          source: 'rules',
          confidence: 0.95
        };
      }

      result.rationale = aiAnalysis.rationale;
      result.recommendedActions = aiAnalysis.recommendedActions;
      result.reasoningSource = aiAnalysis.source;
      result.confidence = aiAnalysis.confidence;

      try {
        await this.orion.upsertEntity(
          `urn:ngsi-ld:ZoneRisk:${result.zone}`,
          'ZoneRisk',
          {
            riskScore: attr('Number', result.riskScore),
            riskLevel: attr('Text', result.riskLevel),
            rationale: attr('Text', result.rationale),
            reasoningSource: attr('Text', aiAnalysis.source),
            confidence: attr('Number', aiAnalysis.confidence),
            safetyPolicy: attr('StructuredValue', safetyPolicy()),
            timestamp: attr('DateTime', result.timestamp)
          }
        );
      } catch (e) {
        console.error(`[MCP] ZoneRisk upsert error: ${e.message}`, e.response?.status, JSON.stringify(e.response?.data)?.slice(0, 200));
      }

      if (result.riskLevel !== 'normal') {
        await this.publishAlertIfAllowed(result);
      } else {
        this.alertManager.clearZone(result.zone);
      }

      if (result.riskLevel === 'critical') {
        await this.executeActions(result, bypassCooldown);
      }
    }
  }

  async publishAlertIfAllowed(result) {
    const message = `Climate risk ${result.riskLevel} in zone ${result.zone}: score ${result.riskScore}`;
    const rationale = result.rationale;
    const shouldAlert = this.alertManager.shouldPublish(
      result.zone,
      result.riskLevel,
      message,
      rationale
    );
    if (!shouldAlert) return null;

    const alert = this.alertManager.createAlert(result.zone, result.riskLevel, message, rationale);

    try {
      await this.orion.upsertEntity(alert.id, 'AlertEvent', {
        level: alert.level,
        zone: alert.zone,
        message: alert.message,
        rationale: alert.rationale,
        status: alert.status,
        timestamp: alert.timestamp
      });
    } catch (e) {
      console.error(`[MCP] AlertEvent upsert error: ${e.message}`, e.response?.status, JSON.stringify(e.response?.data)?.slice(0, 200));
    }

    await this.pushAlertToOpenClaw(alert);

    console.log(`[MCP] Alert published: ${result.riskLevel} zone=${result.zone} score=${result.riskScore}`);
    return alert;
  }

  async pushAlertToOpenClaw(alert) {
    if (!config.openclaw.alertWebhookEnabled || !config.openclaw.alertWebhookUrl) {
      return;
    }

    try {
      await axios.post(config.openclaw.alertWebhookUrl, alert, { timeout: 3000 });
    } catch (e) {
      console.error(`[MCP] OpenClaw alert webhook failed: ${e.message}`);
    }
  }

  async executeActions(result, bypassCooldown = false) {
    const criticalKey = `${result.zone}:${result.riskLevel}`;
    const last = this.lastCriticalActionAt.get(criticalKey) || 0;
    if (!bypassCooldown && (Date.now() - last < config.risk.cooldownMs)) {
      console.log(`[MCP] Cooldown active for critical actions, skipping.`);
      return [];
    }
    this.lastCriticalActionAt.set(criticalKey, Date.now());

    const executions = [];
    if (result.recommendedActions.includes('REDUCE_LOAD') || result.recommendedActions.includes('CUT_POWER_IMMEDIATELY')) {
      const plugs = await this.findDevices('SmartPlug', result.zone);
      if (!plugs.length) {
        console.error(`[MCP] Critical auto-off skipped: no SmartPlug found in zone ${result.zone}`);
      }
      for (const plug of plugs) {
        const onOff = ngsiValue(plug.onOff);
        if (onOff === false) continue;

        if (config.safety.requireOperatorApproval && !config.safety.autoCriticalActions) {
          const exec = await this.recordApprovalRequired(
            plug.id,
            'TURN_OFF',
            `Critical fire risk in zone ${result.zone}; operator approval required before load isolation`,
            result.zone
          );
          executions.push(exec);
          continue;
        }

        const exec = await this.invokeCommand(
          plug.id,
          'TURN_OFF',
          `Critical fire risk mitigation for zone ${result.zone}`,
          {
            requestedBy: 'mcp-auto-critical',
            auto: true,
            policy: safetyPolicy().criticalActionMode
          }
        );
        executions.push(exec);
      }
    }

    return executions;
  }

  async recordApprovalRequired(deviceId, action, reason, zone) {
    const policy = safetyPolicy();
    const exec = await this.commandExecutor.execute(deviceId, action, reason, {
      status: 'APPROVAL_REQUIRED',
      source: 'mcp-policy',
      requestedBy: 'mcp-critical-policy',
      auto: false,
      approvalRequired: true,
      policy: `Human approval required; reminder=${policy.firstReminderSec}s; backup escalation=${policy.backupEscalationSec}s`
    });

    exec.zone = attr('Text', zone);
    await this.orion.upsertEntity(exec.id, 'CommandExecution', {
      commandId: exec.commandId,
      deviceId: exec.deviceId,
      action: exec.action,
      reason: exec.reason,
      status: exec.status,
      source: exec.source,
      requestedBy: exec.requestedBy,
      auto: exec.auto,
      approvalRequired: exec.approvalRequired,
      policy: exec.policy,
      zone: exec.zone,
      error: exec.error,
      timestamp: exec.timestamp
    });
    return exec;
  }

  async queryEntities(zone, type, since) {
    const entities = await this.orion.getEntities(type);
    let filtered = entities;

    if (zone) {
      filtered = filtered.filter(e => entityZone(e) === zone);
    }
    if (since) {
      const sinceTime = new Date(since).getTime();
      filtered = filtered.filter(e => {
        const ts = ngsiValue(e.timestamp) || e.measuredValue?.metadata?.timestamp?.value;
        return ts && new Date(ts).getTime() >= sinceTime;
      });
    }
    return filtered;
  }

  async findDevices(type, zone = 'A') {
    const entities = await this.queryEntities(zone, type);
    return entities.filter(entity => entity.type === type);
  }

  computeRisk(zone = 'A') {
    const result = this.lastRiskResults.find(r => r.zone === zone) || {
      zone,
      riskScore: 0,
      riskLevel: 'normal',
      rationale: 'No data',
      recommendedActions: []
    };
    return { ...result, safetyPolicy: safetyPolicy() };
  }

  async publishAlert(level, zone, message, rationale) {
    if (!this.alertManager.shouldPublish(zone, level, message, rationale)) {
      return { status: 'duplicate', message: 'Alert suppressed because the same notification is already active' };
    }

    const alert = this.alertManager.createAlert(zone, level, message, rationale);
    await this.orion.upsertEntity(alert.id, 'AlertEvent', {
      level: alert.level,
      zone: alert.zone,
      message: alert.message,
      rationale: alert.rationale,
      status: alert.status,
      timestamp: alert.timestamp
    });
    await this.pushAlertToOpenClaw(alert);
    return alert;
  }

  async invokeCommand(deviceId, action, reason, options = {}) {
    if (!CONTROL_ACTIONS.has(action)) {
      throw new Error(`Unsupported action: ${action}`);
    }

    const device = await this.orion.getEntity(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const simulatorMode = config.control.mode === 'simulator';
    let adapterResult = { source: simulatorMode ? 'simulator' : deviceProtocol(device) || 'unknown' };
    let status = 'PENDING';
    let commandError = '';

    if (device.type === 'SmartPlug') {
      if (simulatorMode && !this.hasCustomDeviceAdapter) {
        await this.updateSmartPlugState(deviceId, action, 'simulator');
        status = 'SIMULATED_ACK';
      } else if (simulatorMode && this.hasCustomDeviceAdapter) {
        adapterResult = await this.deviceAdapter.execute(device, action);
        await this.updateSmartPlugState(deviceId, action, adapterResult.source || 'simulator');
        status = 'SIMULATED_ACK';
      } else if (!deviceProtocol(device) && !this.hasCustomDeviceAdapter) {
        await this.updateSmartPlugState(deviceId, action, 'virtual-seed');
        adapterResult = { source: 'virtual-seed' };
        status = 'SIMULATED_ACK';
      } else {
        try {
          adapterResult = await this.deviceAdapter.execute(device, action);
          const confirmed = await this.waitForReportedState(deviceId, action === 'TURN_ON');
          status = confirmed ? 'CONFIRMED' : 'PENDING';
        } catch (error) {
          status = 'FAILED';
          commandError = error.message;
          console.error(`[MCP] Live device command failed: ${error.message}`);
        }
      }
    }

    const exec = await this.commandExecutor.execute(deviceId, action, reason, {
      status,
      source: adapterResult.source,
      error: commandError,
      requestedBy: options.requestedBy || 'unknown',
      auto: options.auto === true,
      approvalRequired: options.approvalRequired === true,
      policy: options.policy || ''
    });
    exec.source = attr('Text', adapterResult.source || 'simulator');
    exec.requestedBy = attr('Text', options.requestedBy || 'unknown');
    exec.auto = attr('Boolean', options.auto === true);
    exec.approvalRequired = attr('Boolean', options.approvalRequired === true);
    exec.policy = attr('Text', options.policy || '');

    await this.orion.upsertEntity(exec.id, 'CommandExecution', {
      commandId: exec.commandId,
      deviceId: exec.deviceId,
      action: exec.action,
      reason: exec.reason,
      status: exec.status,
      source: exec.source,
      requestedBy: exec.requestedBy,
      auto: exec.auto,
      approvalRequired: exec.approvalRequired,
      policy: exec.policy,
      error: exec.error,
      timestamp: exec.timestamp
    });
    return exec;
  }

  async waitForReportedState(deviceId, expectedState) {
    const deadline = Date.now() + config.control.confirmationTimeoutMs;
    while (Date.now() < deadline) {
      const current = await this.orion.getEntity(deviceId);
      if (current && ngsiValue(current.onOff) === expectedState) return true;
      await new Promise(resolve => setTimeout(resolve, config.control.confirmationPollMs));
    }
    return false;
  }

  async updateSmartPlugState(deviceId, action, source) {
    const onOff = action === 'TURN_ON';
    const activePower = onOff ? 500 : 0;
    const timestamp = new Date().toISOString();
    await this.orion.updateEntity(deviceId, {
      onOff: attr('Boolean', onOff, {
        source: attr('Text', source),
        timestamp: attr('DateTime', timestamp)
      }),
      activePower: attr('Number', activePower, {
        unit: attr('Text', 'W'),
        source: attr('Text', source),
        timestamp: attr('DateTime', timestamp)
      })
    });
  }

  async simulateScenario(scenario, zone = 'A', requestedBy = 'unknown') {
    if (config.control.mode !== 'simulator') {
      throw new Error('Scenario simulation is disabled while DEVICE_CONTROL_MODE=live');
    }

    const seedProfile = summarizeSeedScenario(scenario);
    const values = seedProfile.values;
    if (!values) {
      throw new Error(`Unsupported scenario: ${scenario}`);
    }

    const required = {
      TemperatureSensor: await this.findDevices('TemperatureSensor', zone),
      HumiditySensor: await this.findDevices('HumiditySensor', zone),
      SmartPlug: await this.findDevices('SmartPlug', zone)
    };
    const missing = Object.entries(required)
      .filter(([, devices]) => devices.length === 0)
      .map(([type]) => type);
    if (missing.length) {
      throw new Error(`Missing devices for zone ${zone}: ${missing.join(', ')}`);
    }

    let adapterResult = { source: 'simulator' };
    try {
      adapterResult = await this.deviceAdapter.simulate(scenario, 120000);
    } catch (e) {
      console.error(`[MCP] Scenario adapter failed, updating Orion directly: ${e.message}`);
    }

    const source = adapterResult.source || 'simulator';
    const timestamp = new Date().toISOString();
    const updatedDevices = [];

    for (const device of required.TemperatureSensor) {
      await this.orion.updateEntity(device.id, {
        temperature: attr('Number', values.temperature, {
          unit: attr('Text', 'degC'),
          source: attr('Text', source),
          timestamp: attr('DateTime', timestamp)
        })
      });
      updatedDevices.push({ id: device.id, type: device.type });
    }
    for (const device of required.HumiditySensor) {
      await this.orion.updateEntity(device.id, {
        measuredValue: attr('Number', values.humidity, {
          unit: attr('Text', '%RH'),
          source: attr('Text', source),
          timestamp: attr('DateTime', timestamp)
        })
      });
      updatedDevices.push({ id: device.id, type: device.type });
    }
    for (const device of required.SmartPlug) {
      await this.orion.updateEntity(device.id, {
        onOff: attr('Boolean', values.plugOn, {
          source: attr('Text', source),
          timestamp: attr('DateTime', timestamp)
        }),
        activePower: attr('Number', values.power, {
          unit: attr('Text', 'W'),
          source: attr('Text', source),
          timestamp: attr('DateTime', timestamp)
        })
      });
      updatedDevices.push({ id: device.id, type: device.type });
    }

    const auditId = `urn:ngsi-ld:SimulationRun:${scenario}_${Date.now()}`;
    const audit = {
      id: auditId,
      type: 'SimulationRun',
      scenario: attr('Text', scenario),
      zone: attr('Text', zone),
      requestedBy: attr('Text', requestedBy),
      source: attr('Text', source),
      status: attr('Text', 'SIMULATED'),
      seedScenario: attr('Text', seedProfile.sourceScenario),
      seedFile: attr('Text', seedProfile.seedFile || 'built-in-fallback'),
      timestamp: attr('DateTime', timestamp)
    };
    await this.orion.upsertEntity(auditId, 'SimulationRun', audit);

    return {
      status: 'SIMULATED',
      auditId,
      scenario,
      sourceScenario: seedProfile.sourceScenario,
      seedFile: seedProfile.seedFile,
      zone,
      source,
      values,
      updatedDevices,
      adapter: adapterResult,
      timestamp
    };
  }

  async acknowledgeAlert(alertId, acknowledgedBy, note = '') {
    const existing = await this.orion.getEntity(alertId);
    if (!existing) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    const update = {
      status: attr('Text', 'acknowledged'),
      acknowledgedBy: attr('Text', acknowledgedBy),
      note: attr('Text', note),
      acknowledgedAt: attr('DateTime', new Date().toISOString())
    };
    await this.orion.updateEntity(alertId, update);
    return { id: alertId, type: 'AlertEvent', ...existing, ...update };
  }

  async getAlertHistory(limit = 20) {
    const live = await this.orion.getEntities('AlertEvent');
    const merged = [...live, ...this.alertManager.getHistory(limit)];
    const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
    return sortByTimestampNewestFirst(unique).slice(0, limit);
  }

  async getCommandHistory(limit = 20) {
    const live = await this.orion.getEntities('CommandExecution');
    const merged = [...live, ...this.commandExecutor.getHistory(limit)];
    const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
    return sortByTimestampNewestFirst(unique).slice(0, limit);
  }

  listTools() {
    return [
      { name: 'query_entities', method: 'GET', path: '/tools/query_entities' },
      { name: 'compute_risk', method: 'POST', path: '/tools/compute_risk' },
      { name: 'publish_alert', method: 'POST', path: '/tools/publish_alert', mutating: true },
      { name: 'acknowledge_alert', method: 'POST', path: '/tools/acknowledge_alert', mutating: true },
      { name: 'invoke_command', method: 'POST', path: '/tools/invoke_command', mutating: true },
      { name: 'simulate_scenario', method: 'POST', path: '/tools/simulate_scenario', mutating: true },
      { name: 'ai_chat', method: 'POST', path: '/tools/ai_chat' }
    ];
  }
}

function requireConfirmation(req, res) {
  if (req.body?.confirmed === true) return true;
  res.status(409).json({
    error: 'CONFIRMATION_REQUIRED',
    message: 'This mutating tool requires confirmed: true'
  });
  return false;
}

// Main
if (require.main === module) {
  const agent = new MCPAgent();
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
      message: 'MCP Agent running',
      controlMode: config.control.mode,
      uptime: process.uptime()
    });
  });

  app.get('/tools', (req, res) => {
    res.json(agent.listTools());
  });

  app.get('/risk', (req, res) => {
    const zone = req.query.zone || 'A';
    res.json(agent.computeRisk(zone));
  });

  app.get('/risk/all', (req, res) => {
    res.json(agent.lastRiskResults);
  });

  app.get('/tools/query_entities', async (req, res) => {
    try {
      const { zone, type, since } = req.query;
      const result = await agent.queryEntities(zone, type, since);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/tools/compute_risk', (req, res) => {
    const { zone } = req.body;
    res.json(agent.computeRisk(zone || 'A'));
  });

  app.post('/tools/publish_alert', async (req, res) => {
    try {
      if (!requireConfirmation(req, res)) return;
      const { level, zone, message, rationale } = req.body;
      const result = await agent.publishAlert(level, zone, message, rationale);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/tools/acknowledge_alert', async (req, res) => {
    try {
      if (!requireConfirmation(req, res)) return;
      const { alertId, acknowledgedBy, operator, note } = req.body;
      const result = await agent.acknowledgeAlert(alertId, acknowledgedBy || operator, note || '');
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/tools/invoke_command', async (req, res) => {
    try {
      if (!requireConfirmation(req, res)) return;
      const { deviceId, action, reason, requestedBy } = req.body;
      const result = await agent.invokeCommand(deviceId, action, reason, { requestedBy });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/tools/simulate_scenario', async (req, res) => {
    try {
      if (!requireConfirmation(req, res)) return;
      const { scenario, zone, requestedBy } = req.body;
      const result = await agent.simulateScenario(scenario, zone || 'A', requestedBy || 'unknown');
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/alerts', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      res.json(await agent.getAlertHistory(limit));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/commands', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      res.json(await agent.getCommandHistory(limit));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/tools/ai_chat', async (req, res) => {
    try {
      const { message, skills, seedData } = req.body;
      if (!message) return res.status(400).json({ error: 'message is required' });

      const entities = await agent.orion.getEntities();
      const risks = agent.lastRiskResults;
      const deviceCount = entities.filter(e => ['HumiditySensor', 'SmartPlug', 'TemperatureSensor'].includes(e.type)).length;
      const zones = [...new Set(risks.map(r => r.zone))];
      const alertCount = (await agent.getAlertHistory(100)).length;

      const result = await agent.aiReasoner.chat(message, {
        risks,
        zones,
        deviceCount,
        alertCount,
        skills: Array.isArray(skills) ? skills : [],
        seedData: seedData || {
          zone: 'A',
          scenario: 'demo-building-main-area',
          sensors: {
            temperatureC: 36.8,
            humidityPercent: 68,
            activePowerW: 620,
            smartPlug: 'ON'
          },
          services: ['Orion', 'MCP Agent', 'OpenClaw Gateway'],
          note: 'Demo seed context only; live Orion data should override it when present.'
        }
      });
      res.json(result);
    } catch (e) {
      console.error(`[MCP] /tools/ai_chat error: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/evaluate', async (req, res) => {
    try {
      console.log('[MCP] Manual /evaluate triggered');
      await agent.evaluateAndAct(true); // Bypass cooldown for manual triggers
      res.json({ status: 'ok', results: agent.lastRiskResults });
    } catch (e) {
      console.error(`[MCP] /evaluate error: ${e.message}`, e.stack);
      res.status(500).json({ error: e.message });
    }
  });

  const PORT = config.agent.port;
  app.listen(PORT, () => {
    console.log(`[MCP] API server on http://localhost:${PORT}`);
    agent.start();
  });

  process.on('SIGINT', () => {
    console.log('\n[MCP] Shutting down...');
    agent.running = false;
    process.exit(0);
  });
}

module.exports = MCPAgent;
