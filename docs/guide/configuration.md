# Configuration

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `BOT_TOKEN` | Yes | — | Telegram Bot API token from [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | Yes | — | PostgreSQL password (used by Docker Compose) |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection URL |
| `REDIS_PASSWORD` | No | — | Redis password (Docker Compose auto-builds REDIS_URL) |
| `BOT_OWNER_ID` | No | `0` | Telegram user ID for owner-only commands like `/broadcast` |
| `ZENON_NODE_HTTP` | No | `https://node.zenonhub.io:35997` | Zenon HTTP endpoint |
| `ZENON_NODE_WS` | No | `wss://node.zenonhub.io:35998` | Zenon WebSocket endpoint |
| `ZENON_MNEMONIC` | No | — | Bot wallet mnemonic for `/zsend` and `/zfuse` |
| `HEALTH_PORT` | No | `0` | HTTP health check port (0 = disabled) |
| `LOG_LEVEL` | No | `info` | Log level: trace, debug, info, warn, error |
| `NODE_ENV` | No | `development` | Environment mode |

## Docker Compose

The easiest way to run the bot with all dependencies:

```bash
cp .env.example .env
# Edit .env with your BOT_TOKEN and POSTGRES_PASSWORD

docker compose up -d
```

This starts PostgreSQL, Redis, and the bot. The bot waits for both services to be healthy before starting.

### Redis Authentication

Redis password is optional. Set `REDIS_PASSWORD` in `.env` to enable it — Docker Compose automatically constructs the `REDIS_URL` with credentials.

## Manual Setup

```bash
npm ci
npx prisma generate
npx prisma db push
npm run dev    # development with hot reload
npm run build  # production build
npm start      # run production
```

## Health Check

Set `HEALTH_PORT` to a non-zero port number to enable an HTTP health check endpoint at `GET /health`. Useful for container orchestration and monitoring.
