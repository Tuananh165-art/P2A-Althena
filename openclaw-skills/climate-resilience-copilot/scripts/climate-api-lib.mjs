const OPERATIONS = new Set([
  "ack-alert",
  "alerts",
  "city-summary",
  "commands",
  "control",
  "devices",
  "explain",
  "health",
  "publish-alert",
  "risk",
  "simulate",
  "tools",
]);
const DEVICE_TYPES = new Set([
  "HumiditySensor",
  "MatterDevice",
  "SmartPlug",
  "TemperatureSensor",
]);
const DEFAULT_TIMEOUT_MS = 5000;

export class ClimateApiError extends Error {
  constructor(message, { code = "CLIMATE_API_ERROR", status, url, cause } = {}) {
    super(message, { cause });
    this.name = "ClimateApiError";
    this.code = code;
    this.status = status;
    this.url = url;
  }
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function readOption(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new ClimateApiError(`${name} requires a value`, {
      code: "INVALID_ARGUMENT",
    });
  }
  return value;
}

export function parseCliArgs(args) {
  const operation = args[0];
  if (!operation) {
    throw new ClimateApiError(
      "Missing operation. Use health, risk, alerts, devices, city-summary, explain, commands, control, simulate, publish-alert, ack-alert, or tools.",
      { code: "INVALID_ARGUMENT" },
    );
  }
  if (!OPERATIONS.has(operation)) {
    throw new ClimateApiError(`Unsupported operation: ${operation}`, {
      code: "INVALID_ARGUMENT",
    });
  }

  const result = { operation };
  for (let index = 1; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--zone") {
      result.zone = readOption(args, index, "--zone");
      index += 1;
    } else if (option === "--type") {
      result.type = readOption(args, index, "--type");
      index += 1;
    } else if (option === "--level") {
      result.level = readOption(args, index, "--level").toUpperCase();
      index += 1;
    } else if (option === "--limit") {
      const rawLimit = readOption(args, index, "--limit");
      const limit = Number.parseInt(rawLimit, 10);
      if (!Number.isInteger(limit) || String(limit) !== rawLimit || limit < 1 || limit > 100) {
        throw new ClimateApiError("limit must be between 1 and 100", {
          code: "INVALID_ARGUMENT",
        });
      }
      result.limit = limit;
      index += 1;
    } else if (option === "--action") {
      result.action = readOption(args, index, "--action").toUpperCase();
      index += 1;
    } else if (option === "--reason") {
      result.reason = readOption(args, index, "--reason");
      index += 1;
    } else if (option === "--device-id") {
      result.deviceId = readOption(args, index, "--device-id");
      index += 1;
    } else if (option === "--scenario") {
      result.scenario = readOption(args, index, "--scenario").toLowerCase();
      index += 1;
    } else if (option === "--message") {
      result.message = readOption(args, index, "--message");
      index += 1;
    } else if (option === "--rationale") {
      result.rationale = readOption(args, index, "--rationale");
      index += 1;
    } else if (option === "--alert-id") {
      result.alertId = readOption(args, index, "--alert-id");
      index += 1;
    } else if (option === "--operator") {
      result.operator = readOption(args, index, "--operator");
      index += 1;
    } else if (option === "--note") {
      result.note = readOption(args, index, "--note");
      index += 1;
    } else if (option === "--confirm") {
      result.confirmed = true;
    } else {
      throw new ClimateApiError(`Unsupported option: ${option}`, {
        code: "INVALID_ARGUMENT",
      });
    }
  }

  if (operation === "risk" && !result.zone) {
    result.zone = "A";
  }
  if (["alerts", "commands", "city-summary"].includes(operation) && !result.limit) {
    result.limit = 20;
  }
  if (["control", "simulate", "publish-alert", "ack-alert"].includes(operation)) {
    result.confirmed = result.confirmed === true;
  }
  if (operation === "control") {
    result.zone ||= "A";
    result.type ||= "SmartPlug";
    if (!result.action || !["TURN_ON", "TURN_OFF"].includes(result.action)) {
      throw new ClimateApiError("control requires --action TURN_ON or TURN_OFF", {
        code: "INVALID_ARGUMENT",
      });
    }
    if (!result.reason) {
      throw new ClimateApiError("control requires --reason", {
        code: "INVALID_ARGUMENT",
      });
    }
  }
  if (operation === "simulate") {
    result.zone ||= "A";
    if (!["normal", "warning", "critical"].includes(result.scenario)) {
      throw new ClimateApiError(
        "simulate requires --scenario normal, warning, or critical",
        { code: "INVALID_ARGUMENT" },
      );
    }
  }

  return result;
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function errorMessage(body, response) {
  if (body && typeof body === "object" && body.error) {
    return String(body.error);
  }
  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }
  return `${response.status} ${response.statusText}`.trim();
}

function ngsiValue(value) {
  if (
    value &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value, "value")
  ) {
    return value.value;
  }
  return value;
}

export function createClimateClient({
  mcpUrl = process.env.CLIMATE_MCP_URL || "http://127.0.0.1:3002",
  orionUrl = process.env.CLIMATE_ORION_URL || "http://127.0.0.1:1026",
  fimatUrl = process.env.CLIMATE_FIMAT_URL || "http://127.0.0.1:3000",
  zigbeeUrl = process.env.CLIMATE_ZIGBEE_URL || "http://127.0.0.1:3003",
  fetchImpl = globalThis.fetch,
  timeoutMs = Number.parseInt(
    process.env.CLIMATE_API_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS),
    10,
  ),
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new ClimateApiError("A fetch implementation is required", {
      code: "INVALID_CONFIGURATION",
    });
  }

  const endpoints = {
    mcp: trimTrailingSlash(mcpUrl),
    orion: trimTrailingSlash(orionUrl),
    fimat: trimTrailingSlash(fimatUrl),
    zigbee: trimTrailingSlash(zigbeeUrl),
  };

  async function get(url) {
    return request(url);
  }

  async function post(url, body) {
    return request(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  async function request(url, options = {}) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: options.headers || { accept: "application/json" },
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error?.name === "TimeoutError";
      throw new ClimateApiError(
        timedOut ? `Request timed out after ${timeoutMs}ms` : error.message,
        {
          code: timedOut ? "TIMEOUT" : "CONNECTION_ERROR",
          url,
          cause: error,
        },
      );
    }

    const body = await readResponseBody(response);
    if (!response.ok) {
      throw new ClimateApiError(errorMessage(body, response), {
        code: "HTTP_ERROR",
        status: response.status,
        url,
      });
    }
    return body;
  }

  return { endpoints, get, post };
}

function result(operation, data, request = {}, ok = true) {
  return {
    ok,
    operation,
    source: "live",
    timestamp: new Date().toISOString(),
    request,
    data,
  };
}

async function health(client) {
  const targets = {
    mcp: `${client.endpoints.mcp}/health`,
    orion: `${client.endpoints.orion}/version`,
    fimat: `${client.endpoints.fimat}/health`,
    zigbee: `${client.endpoints.zigbee}/health`,
  };
  const entries = await Promise.all(
    Object.entries(targets).map(async ([name, url]) => {
      try {
        const data = await client.get(url);
        return [name, { ok: true, url, data }];
      } catch (error) {
        return [
          name,
          {
            ok: false,
            url,
            error: error.message,
            code: error.code || "UNKNOWN_ERROR",
          },
        ];
      }
    }),
  );
  const services = Object.fromEntries(entries);
  return result(
    "health",
    { services },
    {},
    Object.values(services).every((service) => service.ok),
  );
}

async function risk(client, options) {
  const params = new URLSearchParams({ zone: options.zone || "A" });
  const data = await client.get(`${client.endpoints.mcp}/risk?${params}`);
  return result("risk", data, { zone: options.zone || "A" });
}

async function alerts(client, options) {
  const limit = options.limit || 20;
  const params = new URLSearchParams({ limit: String(limit) });
  let data = await client.get(`${client.endpoints.mcp}/alerts?${params}`);
  if (!Array.isArray(data)) {
    throw new ClimateApiError("MCP Agent returned an invalid alerts payload", {
      code: "INVALID_RESPONSE",
      url: `${client.endpoints.mcp}/alerts?${params}`,
    });
  }

  const request = { limit };
  if (options.level) {
    const level = options.level.toUpperCase();
    data = data.filter((alert) => {
      const actual = ngsiValue(alert.severity ?? alert.level);
      return String(actual || "").toUpperCase() === level;
    });
    request.level = level;
  }
  return result("alerts", data, request);
}

async function devices(client, options) {
  const params = new URLSearchParams();
  if (options.zone) params.set("zone", options.zone);
  if (options.type) params.set("type", options.type);
  const query = params.toString();
  const url = `${client.endpoints.mcp}/tools/query_entities${query ? `?${query}` : ""}`;
  const data = await client.get(url);
  if (!Array.isArray(data)) {
    throw new ClimateApiError("MCP Agent returned an invalid entities payload", {
      code: "INVALID_RESPONSE",
      url,
    });
  }
  const deviceData = data.filter((entity) => DEVICE_TYPES.has(entity.type));
  const request = {};
  if (options.zone) request.zone = options.zone;
  if (options.type) request.type = options.type;
  return result("devices", deviceData, request);
}

async function commands(client, options) {
  const limit = options.limit || 20;
  const params = new URLSearchParams({ limit: String(limit) });
  const data = await client.get(`${client.endpoints.mcp}/commands?${params}`);
  if (!Array.isArray(data)) {
    throw new ClimateApiError("MCP Agent returned an invalid commands payload", {
      code: "INVALID_RESPONSE",
    });
  }
  return result("commands", data, { limit });
}

async function citySummary(client, options) {
  const limit = options.limit || 20;
  const [risks, alertData, deviceResult] = await Promise.all([
    client.get(`${client.endpoints.mcp}/risk/all`),
    client.get(`${client.endpoints.mcp}/alerts?${new URLSearchParams({ limit: String(limit) })}`),
    devices(client, { operation: "devices" }),
  ]);
  if (!Array.isArray(risks) || !Array.isArray(alertData)) {
    throw new ClimateApiError("MCP Agent returned an invalid city summary payload", {
      code: "INVALID_RESPONSE",
    });
  }
  const criticalZones = risks.filter(
    riskItem => String(riskItem.riskLevel || "").toLowerCase() === "critical",
  );
  return result(
    "city-summary",
    {
      zoneCount: risks.length,
      criticalZoneCount: criticalZones.length,
      criticalZones,
      risks,
      alertCount: alertData.length,
      alerts: alertData,
      deviceCount: deviceResult.data.length,
      devices: deviceResult.data,
    },
    { limit },
  );
}

async function explain(client, options) {
  const riskResult = await risk(client, {
    operation: "risk",
    zone: options.zone || "A",
  });
  return result("explain", riskResult.data, riskResult.request);
}

function confirmationResult(operation, preview) {
  return result(
    operation,
    { status: "CONFIRMATION_REQUIRED", ...preview },
    preview.request || {},
    false,
  );
}

async function resolveControlTarget(client, options) {
  const params = new URLSearchParams({
    zone: options.zone || "A",
    type: options.type || "SmartPlug",
  });
  const entities = await client.get(
    `${client.endpoints.mcp}/tools/query_entities?${params}`,
  );
  let matches = entities.filter(entity => DEVICE_TYPES.has(entity.type));
  if (options.deviceId) {
    matches = matches.filter(entity => entity.id === options.deviceId);
  }
  if (!matches.length) {
    throw new ClimateApiError("No matching controllable device found", {
      code: "DEVICE_NOT_FOUND",
    });
  }
  if (matches.length > 1) {
    throw new ClimateApiError(
      `Multiple matching devices found: ${matches.map(item => item.id).join(", ")}. Use --device-id.`,
      { code: "AMBIGUOUS_DEVICE" },
    );
  }
  return matches[0];
}

async function control(client, options) {
  const target = await resolveControlTarget(client, options);
  const preview = {
    target: { id: target.id, type: target.type },
    action: options.action,
    reason: options.reason,
  };
  if (!options.confirmed) {
    return confirmationResult("control", preview);
  }
  const data = await client.post(`${client.endpoints.mcp}/tools/invoke_command`, {
    deviceId: target.id,
    action: options.action,
    reason: options.reason,
    confirmed: true,
    requestedBy: "openclaw",
  });
  return result("control", data, preview);
}

async function simulate(client, options) {
  const preview = {
    scenario: options.scenario,
    zone: options.zone || "A",
  };
  if (!options.confirmed) {
    return confirmationResult("simulate", preview);
  }
  const data = await client.post(
    `${client.endpoints.mcp}/tools/simulate_scenario`,
    {
      scenario: options.scenario,
      zone: options.zone || "A",
      requestedBy: "openclaw",
      confirmed: true,
    },
  );
  return result("simulate", data, preview);
}

async function publishAlert(client, options) {
  if (!options.level || !options.zone || !options.message || !options.rationale) {
    throw new ClimateApiError(
      "publish-alert requires --level, --zone, --message, and --rationale",
      { code: "INVALID_ARGUMENT" },
    );
  }
  const preview = {
    level: options.level,
    zone: options.zone,
    message: options.message,
    rationale: options.rationale,
  };
  if (!options.confirmed) {
    return confirmationResult("publish-alert", preview);
  }
  const data = await client.post(`${client.endpoints.mcp}/tools/publish_alert`, preview);
  return result("publish-alert", data, preview);
}

async function acknowledgeAlert(client, options) {
  if (!options.alertId || !options.operator) {
    throw new ClimateApiError("ack-alert requires --alert-id and --operator", {
      code: "INVALID_ARGUMENT",
    });
  }
  const preview = {
    alertId: options.alertId,
    acknowledgedBy: options.operator,
    note: options.note || "",
  };
  if (!options.confirmed) {
    return confirmationResult("ack-alert", preview);
  }
  const data = await client.post(
    `${client.endpoints.mcp}/tools/acknowledge_alert`,
    preview,
  );
  return result("ack-alert", data, preview);
}

async function tools(client) {
  const data = await client.get(`${client.endpoints.mcp}/tools`);
  return result("tools", data);
}

export async function runOperation(client, options) {
  switch (options.operation) {
    case "health":
      return health(client);
    case "risk":
      return risk(client, options);
    case "alerts":
      return alerts(client, options);
    case "devices":
      return devices(client, options);
    case "commands":
      return commands(client, options);
    case "city-summary":
      return citySummary(client, options);
    case "explain":
      return explain(client, options);
    case "control":
      return control(client, options);
    case "simulate":
      return simulate(client, options);
    case "publish-alert":
      return publishAlert(client, options);
    case "ack-alert":
      return acknowledgeAlert(client, options);
    case "tools":
      return tools(client);
    default:
      throw new ClimateApiError(`Unsupported operation: ${options.operation}`, {
        code: "INVALID_ARGUMENT",
      });
  }
}

export function serializeError(error, operation) {
  return {
    ok: false,
    operation: operation || "unknown",
    source: "unavailable",
    timestamp: new Date().toISOString(),
    error: {
      code: error.code || "UNEXPECTED_ERROR",
      message: error.message || String(error),
      ...(error.status ? { status: error.status } : {}),
      ...(error.url ? { url: error.url } : {}),
    },
  };
}
