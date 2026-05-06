# Climate Resilience Copilot — OpenClaw Skills

OpenClaw skills for the Electrical Fire Detection platform.
These skills allow OpenClaw to monitor fire risk from climate-driven heat waves (temperature, power, humidity),
detect electrical hazards, and coordinate protective responses through messaging platforms (WhatsApp, Telegram, Slack, etc.).

## Available Skills

| Skill | Description |
|-------|-------------|
| `query-risk` | Get current risk assessment for a zone |
| `get-alerts` | List recent alerts with filtering |
| `device-control` | Control IoT devices (on/off, dimming) |
| `system-status` | Full system health check |
| `simulate-scenario` | Trigger disaster simulation for demo |

## Architecture

```
User (Telegram)
  <-> OpenClaw Gateway (port 3004)
      -> Skill Router (keyword-based)
          -> MCP Agent API (port 3002)
              -> FIWARE Orion (context broker)
                  -> Zigbee Bridge -> Zigbee Devices

MCP Agent (poll loop)
  -> OpenClaw Gateway (poll /alerts)
      -> Telegram Bot (push alert notification)
```

## Setup

```powershell
cd Matter-to-FIWARE-Monitoring-System/openclaw-gateway
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_IDS
npm install
npm start
```

## Configuration

Set these in `.env`:

```env
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_ALLOWED_CHAT_IDS=<your chat ID>
MCP_URL=http://localhost:3002
ORION_URL=http://localhost:1026
ZIGBEE_URL=http://localhost:3003
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Gateway health check |
| `GET` | `/skills` | List available skills |
| `POST` | `/webhook/alert` | Push alert to Telegram |
| `POST` | `/test/send` | Send test message |
