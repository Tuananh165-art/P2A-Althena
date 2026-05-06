class CommandExecutor {
  constructor() {
    this.executions = [];
  }

  async execute(deviceId, action, reason) {
    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    // Simulate command execution (in real system, this would bridge to hardware)
    const success = Math.random() > 0.05; // 95% success rate
    const status = success ? 'ACK' : 'ERROR';

    const execution = {
      id: `urn:ngsi-ld:CommandExecution:${commandId}`,
      type: 'CommandExecution',
      commandId: { type: 'Text', value: commandId },
      deviceId: { type: 'Text', value: deviceId },
      action: { type: 'Text', value: action },
      reason: { type: 'Text', value: reason },
      status: { type: 'Text', value: status },
      timestamp: { type: 'DateTime', value: timestamp }
    };

    this.executions.push(execution);
    if (this.executions.length > 100) this.executions.shift();

    console.log(`[CommandExecutor] ${action} -> ${deviceId} => ${status} (${commandId})`);
    return execution;
  }

  getHistory(limit = 20) {
    return this.executions.slice(-limit);
  }
}

module.exports = CommandExecutor;
