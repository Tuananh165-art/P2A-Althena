require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const OrionClient = require('./orion-client');
const RiskEngine = require('./risk-engine');
const AlertManager = require('./alert-manager');
const CommandExecutor = require('./command-executor');
const AIReasoner = require('./ai-reasoner');
const config = require('../config');

class MCPAgent {
  constructor() {
    this.orion = new OrionClient();
    this.riskEngine = new RiskEngine();
    this.alertManager = new AlertManager();
    this.commandExecutor = new CommandExecutor();
    this.aiReasoner = new AIReasoner();
    this.lastRiskResults = [];
    this.running = false;
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

  async evaluateAndAct() {
    const entities = await this.orion.getEntities();
    const riskResults = this.riskEngine.evaluate(entities);
    this.lastRiskResults = riskResults;

    for (const result of riskResults) {
      // AI-enhanced reasoning
      let aiAnalysis;
      try {
        aiAnalysis = await this.aiReasoner.analyzeRisk(result.metrics, result);
      } catch (e) {
        console.error(`[MCP] AI analysis error: ${e.message}`);
        aiAnalysis = { rationale: result.rationale, recommendedActions: result.recommendedActions, source: 'rules', confidence: 0.95 };
      }
      result.rationale = aiAnalysis.rationale;
      result.recommendedActions = aiAnalysis.recommendedActions;
      result.reasoningSource = aiAnalysis.source;
      result.confidence = aiAnalysis.confidence;

      // Upsert ZoneRisk entity
      try {
        await this.orion.upsertEntity(
          `urn:ngsi-ld:ZoneRisk:${result.zone}`,
          'ZoneRisk',
          {
            riskScore: { type: 'Number', value: result.riskScore },
            riskLevel: { type: 'Text', value: result.riskLevel },
            rationale: { type: 'Text', value: result.rationale },
            reasoningSource: { type: 'Text', value: aiAnalysis.source },
            confidence: { type: 'Number', value: aiAnalysis.confidence },
            timestamp: { type: 'DateTime', value: result.timestamp }
          }
        );
      } catch (e) {
        console.error(`[MCP] ZoneRisk upsert error: ${e.message}`, e.response?.status, JSON.stringify(e.response?.data)?.slice(0, 200));
      }

      // Publish alert if warning or critical
      if (result.riskLevel !== 'normal') {
        const shouldAlert = this.alertManager.shouldPublish(result.zone, result.riskLevel);
        if (shouldAlert) {
          const alert = this.alertManager.createAlert(
            result.zone,
            result.riskLevel,
            `Climate risk ${result.riskLevel} in zone ${result.zone}: score ${result.riskScore}`,
            result.rationale
          );

          // Upsert alert to Orion
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

          console.log(`[MCP] Alert published: ${result.riskLevel} zone=${result.zone} score=${result.riskScore}`);

          // Auto-execute critical actions
          if (result.riskLevel === 'critical') {
            await this.executeActions(result);
          }
        }
      }
    }
  }

  async executeActions(result) {
    const plugDeviceId = 'urn:ngsi-ld:MatterDevice:2_1';
    const lampDeviceId = 'urn:ngsi-ld:MatterDevice:1_1';

    for (const action of result.recommendedActions) {
      if (action === 'TURN_ON_ALERT_LAMP') {
        const exec = await this.commandExecutor.execute(
          lampDeviceId, action, result.rationale
        );
        await this.orion.upsertEntity(exec.id, 'CommandExecution', {
          commandId: exec.commandId, deviceId: exec.deviceId,
          action: exec.action, reason: exec.reason,
          status: exec.status, timestamp: exec.timestamp
        });
      }

      if (action === 'REDUCE_LOAD' || action === 'CUT_POWER_IMMEDIATELY') {
        const exec = await this.commandExecutor.execute(
          plugDeviceId, 'TURN_OFF', `[FIRE PREVENTION] ${result.rationale}`
        );
        await this.orion.upsertEntity(exec.id, 'CommandExecution', {
          commandId: exec.commandId, deviceId: exec.deviceId,
          action: exec.action, reason: exec.reason,
          status: exec.status, timestamp: exec.timestamp
        });
      }
    }
  }

  // MCP tool implementations
  async queryEntities(zone, type, since) {
    const entities = await this.orion.getEntities(type);
    let filtered = entities;

    if (zone) {
      filtered = filtered.filter(e => (e.zone?.value || 'A') === zone);
    }
    if (since) {
      const sinceTime = new Date(since).getTime();
      filtered = filtered.filter(e => {
        const ts = e.timestamp?.value || e.measuredValue?.metadata?.timestamp?.value;
        return ts && new Date(ts).getTime() >= sinceTime;
      });
    }
    return filtered;
  }

  computeRisk(zone = 'A') {
    return this.lastRiskResults.find(r => r.zone === zone) || {
      zone, riskScore: 0, riskLevel: 'normal', rationale: 'No data', recommendedActions: []
    };
  }

  publishAlert(level, zone, message, rationale) {
    if (!this.alertManager.shouldPublish(zone, level)) {
      return { status: 'cooldown', message: 'Alert suppressed by cooldown' };
    }
    const alert = this.alertManager.createAlert(zone, level, message, rationale);
    this.orion.upsertEntity(alert.id, 'AlertEvent', {
      level: alert.level, zone: alert.zone, message: alert.message,
      rationale: alert.rationale, status: alert.status, timestamp: alert.timestamp
    }).catch(e => console.error('[MCP] Error upserting alert:', e.message));
    return alert;
  }

  async invokeCommand(deviceId, action, reason) {
    const exec = await this.commandExecutor.execute(deviceId, action, reason);
    await this.orion.upsertEntity(exec.id, 'CommandExecution', {
      commandId: exec.commandId, deviceId: exec.deviceId, action: exec.action,
      reason: exec.reason, status: exec.status, timestamp: exec.timestamp
    });
    return exec;
  }
}

// Main
if (require.main === module) {
  const agent = new MCPAgent();
  const app = express();
  app.use(express.json());

  // CORS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // MCP Tool endpoints
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'MCP Agent running', uptime: process.uptime() });
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

  app.post('/tools/publish_alert', (req, res) => {
    const { level, zone, message, rationale } = req.body;
    const result = agent.publishAlert(level, zone, message, rationale);
    res.json(result);
  });

  app.post('/tools/invoke_command', async (req, res) => {
    try {
      const { deviceId, action, reason } = req.body;
      const result = await agent.invokeCommand(deviceId, action, reason);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/alerts', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json(agent.alertManager.getHistory(limit));
  });

  app.get('/commands', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json(agent.commandExecutor.getHistory(limit));
  });

  // AI Chat endpoint
  app.post('/tools/ai_chat', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message is required' });

      const entities = await agent.orion.getEntities();
      const risks = agent.lastRiskResults;
      const deviceCount = entities.filter(e => ['HumiditySensor','SmartPlug','TemperatureSensor'].includes(e.type)).length;
      const zones = [...new Set(risks.map(r => r.zone))];
      const alertCount = agent.alertManager.getHistory(100).length;

      const result = await agent.aiReasoner.chat(message, {
        risks, zones, deviceCount, alertCount
      });
      res.json(result);
    } catch (e) {
      console.error(`[MCP] /tools/ai_chat error: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // Manual trigger
  app.post('/evaluate', async (req, res) => {
    try {
      console.log('[MCP] Manual /evaluate triggered');
      await agent.evaluateAndAct();
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
