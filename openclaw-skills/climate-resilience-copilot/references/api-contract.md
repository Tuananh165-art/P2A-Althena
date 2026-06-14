# Live Data Contract

The CLI is the stable interface for this skill. It reads these local services:

| Operation | Service | Endpoint |
|---|---|---|
| `risk` | MCP Agent | `GET /risk?zone={zone}` |
| `alerts` | MCP Agent | `GET /alerts?limit={limit}` |
| `devices` | MCP Agent | `GET /tools/query_entities?zone={zone}&type={type}` |
| `health` | MCP Agent | `GET /health` |
| `health` | Orion Context Broker | `GET /version` |
| `health` | FIMAT Agent | `GET /health` |
| `health` | Zigbee Bridge | `GET /health` |
| `commands` | MCP Agent | `GET /commands?limit={limit}` |
| `tools` | MCP Agent | `GET /tools` |
| `control` | MCP Agent | `POST /tools/invoke_command` |
| `simulate` | MCP Agent | `POST /tools/simulate_scenario` |
| `publish-alert` | MCP Agent | `POST /tools/publish_alert` |
| `ack-alert` | MCP Agent | `POST /tools/acknowledge_alert` |

Default local URLs:

- MCP Agent: `http://127.0.0.1:3002`
- Orion: `http://127.0.0.1:1026`
- FIMAT Agent: `http://127.0.0.1:3000`
- Zigbee Bridge: `http://127.0.0.1:3003`

Override them with `CLIMATE_MCP_URL`, `CLIMATE_ORION_URL`,
`CLIMATE_FIMAT_URL`, and `CLIMATE_ZIGBEE_URL`. Configure request timeout with
`CLIMATE_API_TIMEOUT_MS`.

The MCP Agent is currently an HTTP tool facade. It is not a registered MCP protocol
server. This skill deliberately uses its tested REST contract.

Mutating tool endpoints require `confirmed: true` in the request body. The CLI enforces
the confirmation preview before sending mutating requests.
