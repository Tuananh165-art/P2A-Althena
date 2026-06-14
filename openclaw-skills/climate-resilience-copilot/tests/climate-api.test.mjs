import assert from "node:assert/strict";
import test from "node:test";

import {
  ClimateApiError,
  createClimateClient,
  parseCliArgs,
  runOperation,
} from "../scripts/climate-api-lib.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("parseCliArgs parses a risk request with a zone", () => {
  assert.deepEqual(parseCliArgs(["risk", "--zone", "B"]), {
    operation: "risk",
    zone: "B",
  });
});

test("parseCliArgs applies alert defaults and validates limit", () => {
  assert.deepEqual(parseCliArgs(["alerts"]), {
    operation: "alerts",
    limit: 20,
  });

  assert.throws(
    () => parseCliArgs(["alerts", "--limit", "0"]),
    /limit must be between 1 and 100/,
  );
});

test("parseCliArgs requires explicit confirmation for control execution", () => {
  assert.deepEqual(
    parseCliArgs([
      "control",
      "--zone",
      "A",
      "--type",
      "SmartPlug",
      "--action",
      "TURN_OFF",
      "--reason",
      "Operator requested load reduction",
    ]),
    {
      operation: "control",
      zone: "A",
      type: "SmartPlug",
      action: "TURN_OFF",
      reason: "Operator requested load reduction",
      confirmed: false,
    },
  );
});

test("risk reads live data from MCP Agent and preserves the requested zone", async () => {
  const requests = [];
  const client = createClimateClient({
    mcpUrl: "http://mcp.test",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse({ zone: "A", score: 91, level: "CRITICAL" });
    },
  });

  const result = await runOperation(client, {
    operation: "risk",
    zone: "A",
  });

  assert.equal(requests[0].url, "http://mcp.test/risk?zone=A");
  assert.equal(requests[0].options.signal instanceof AbortSignal, true);
  assert.equal(result.ok, true);
  assert.equal(result.operation, "risk");
  assert.equal(result.source, "live");
  assert.deepEqual(result.request, { zone: "A" });
  assert.deepEqual(result.data, {
    zone: "A",
    score: 91,
    level: "CRITICAL",
  });
});

test("alerts filters by severity without inventing records", async () => {
  const client = createClimateClient({
    mcpUrl: "http://mcp.test/",
    fetchImpl: async () =>
      jsonResponse([
        { id: "a1", severity: "CRITICAL" },
        { id: "a2", severity: "WARNING" },
        { id: "a3", level: "critical" },
        { id: "a4", level: { type: "Text", value: "critical" } },
      ]),
  });

  const result = await runOperation(client, {
    operation: "alerts",
    limit: 10,
    level: "critical",
  });

  assert.deepEqual(result.data, [
    { id: "a1", severity: "CRITICAL" },
    { id: "a3", level: "critical" },
    { id: "a4", level: { type: "Text", value: "critical" } },
  ]);
  assert.deepEqual(result.request, { limit: 10, level: "CRITICAL" });
});

test("devices queries NGSI entities through MCP Agent", async () => {
  let requestedUrl;
  const client = createClimateClient({
    mcpUrl: "http://mcp.test",
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return jsonResponse([
        {
          id: "urn:ngsi-ld:TemperatureSensor:zone-a",
          type: "TemperatureSensor",
        },
        {
          id: "urn:ngsi-ld:AlertEvent:zone-a",
          type: "AlertEvent",
        },
      ]);
    },
  });

  const result = await runOperation(client, {
    operation: "devices",
    zone: "Zone A",
    type: "TemperatureSensor",
  });

  assert.equal(
    requestedUrl,
    "http://mcp.test/tools/query_entities?zone=Zone+A&type=TemperatureSensor",
  );
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].type, "TemperatureSensor");
});

test("health reports each dependency independently", async () => {
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target === "http://zigbee.test/health") {
      throw new TypeError("connection refused");
    }
    return jsonResponse({ status: "ok" });
  };
  const client = createClimateClient({
    mcpUrl: "http://mcp.test",
    orionUrl: "http://orion.test",
    fimatUrl: "http://fimat.test",
    zigbeeUrl: "http://zigbee.test",
    fetchImpl,
  });

  const result = await runOperation(client, { operation: "health" });

  assert.equal(result.ok, false);
  assert.equal(result.data.services.mcp.ok, true);
  assert.equal(result.data.services.orion.ok, true);
  assert.equal(result.data.services.fimat.ok, true);
  assert.equal(result.data.services.zigbee.ok, false);
  assert.match(result.data.services.zigbee.error, /connection refused/);
});

test("HTTP errors become ClimateApiError with status and URL", async () => {
  const client = createClimateClient({
    mcpUrl: "http://mcp.test",
    fetchImpl: async () => jsonResponse({ error: "service unavailable" }, 503),
  });

  await assert.rejects(
    () => runOperation(client, { operation: "risk", zone: "A" }),
    (error) => {
      assert.equal(error instanceof ClimateApiError, true);
      assert.equal(error.status, 503);
      assert.equal(error.url, "http://mcp.test/risk?zone=A");
      assert.match(error.message, /service unavailable/);
      return true;
    },
  );
});

test("control without confirmation returns a preview and performs no POST", async () => {
  const requests = [];
  const client = createClimateClient({
    mcpUrl: "http://mcp.test",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse([
        {
          id: "urn:ngsi-ld:MatterDevice:plug-a",
          type: "SmartPlug",
          zone: { type: "Text", value: "A" },
        },
      ]);
    },
  });

  const result = await runOperation(client, {
    operation: "control",
    zone: "A",
    type: "SmartPlug",
    action: "TURN_OFF",
    reason: "Operator requested",
    confirmed: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.data.status, "CONFIRMATION_REQUIRED");
  assert.equal(result.data.target.id, "urn:ngsi-ld:MatterDevice:plug-a");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, undefined);
});

test("confirmed control discovers the target before invoking the command", async () => {
  const requests = [];
  const client = createClimateClient({
    mcpUrl: "http://mcp.test",
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      if (options.method === "POST") {
        return jsonResponse({
          id: "command-1",
          status: { type: "Text", value: "SIMULATED_ACK" },
        });
      }
      return jsonResponse([
        {
          id: "urn:ngsi-ld:MatterDevice:plug-a",
          type: "SmartPlug",
        },
      ]);
    },
  });

  const result = await runOperation(client, {
    operation: "control",
    zone: "A",
    type: "SmartPlug",
    action: "TURN_OFF",
    reason: "Operator confirmed",
    confirmed: true,
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, "http://mcp.test/tools/invoke_command");
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    deviceId: "urn:ngsi-ld:MatterDevice:plug-a",
    action: "TURN_OFF",
    reason: "Operator confirmed",
    confirmed: true,
    requestedBy: "openclaw",
  });
  assert.equal(result.data.status.value, "SIMULATED_ACK");
});

test("control refuses ambiguous discovery results", async () => {
  const client = createClimateClient({
    mcpUrl: "http://mcp.test",
    fetchImpl: async () =>
      jsonResponse([
        { id: "plug-a", type: "SmartPlug" },
        { id: "plug-b", type: "SmartPlug" },
      ]),
  });

  await assert.rejects(
    () =>
      runOperation(client, {
        operation: "control",
        zone: "A",
        type: "SmartPlug",
        action: "TURN_OFF",
        reason: "Operator confirmed",
        confirmed: true,
      }),
    /Multiple matching devices/,
  );
});

test("simulation requires confirmation and calls the MCP action endpoint", async () => {
  const requests = [];
  const client = createClimateClient({
    mcpUrl: "http://mcp.test",
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      return jsonResponse({
        status: "SIMULATED",
        scenario: "warning",
        zone: "A",
      });
    },
  });

  const preview = await runOperation(client, {
    operation: "simulate",
    scenario: "warning",
    zone: "A",
    confirmed: false,
  });
  assert.equal(preview.data.status, "CONFIRMATION_REQUIRED");
  assert.equal(requests.length, 0);

  const result = await runOperation(client, {
    operation: "simulate",
    scenario: "warning",
    zone: "A",
    confirmed: true,
  });
  assert.equal(requests[0].url, "http://mcp.test/tools/simulate_scenario");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    scenario: "warning",
    zone: "A",
    requestedBy: "openclaw",
    confirmed: true,
  });
  assert.equal(result.data.status, "SIMULATED");
});

test("city summary combines risk, alert, and device data", async () => {
  const client = createClimateClient({
    mcpUrl: "http://mcp.test",
    fetchImpl: async (url) => {
      const target = String(url);
      if (target.endsWith("/risk/all")) {
        return jsonResponse([
          { zone: "A", riskLevel: "critical", riskScore: 95 },
          { zone: "B", riskLevel: "normal", riskScore: 10 },
        ]);
      }
      if (target.includes("/alerts?")) {
        return jsonResponse([{ id: "alert-1" }]);
      }
      return jsonResponse([
        { id: "plug-a", type: "SmartPlug" },
        { id: "sensor-a", type: "TemperatureSensor" },
      ]);
    },
  });

  const result = await runOperation(client, {
    operation: "city-summary",
    limit: 20,
  });

  assert.equal(result.data.zoneCount, 2);
  assert.equal(result.data.criticalZoneCount, 1);
  assert.equal(result.data.deviceCount, 2);
  assert.equal(result.data.alertCount, 1);
});
