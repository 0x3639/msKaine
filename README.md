# Ms. Kaine Admin Bot

A full-featured Telegram group administration and moderation bot with Zenon Network blockchain integration. Built with TypeScript and the [grammY](https://grammy.dev) framework.

Inspired by [Miss Rose](https://missrose.org), Ms. Kaine provides comprehensive group management — bans, warnings, CAPTCHA verification, content filtering, federations, and more — plus native Zenon Network features like wallet linking, token gating, and on-chain queries.

## Features

### Moderation
- **Bans & Mutes** — ban, tban, mute, tmute, kick with silent/delete variants
- **Warnings** — configurable warn limits, actions (ban/mute/kick), and expiry timers
- **Purge** — bulk message deletion with safety cap (200 messages)
- **Admin management** — promote, demote, cached admin lists
- **Approvals** — exempt trusted users from automated moderation
- **Reports** — users can report messages to all admins via `/report` or `@admin`
- **Log channels** — configurable audit logging with per-category toggles

### Anti-Spam
- **CAPTCHA** — verify new members with button, math, text, or custom challenges
- **Blocklist** — trigger-based filtering with glob patterns, lookalike detection, and per-trigger actions
- **Antiflood** — rate limiting with configurable thresholds and time windows
- **Antiraid** — manual or automatic raid mode that kicks new joins during active periods
- **Locks** — restrict content types (stickers, links, forwards, etc.) with allowlists

### Content & Automation
- **Welcome/Goodbye** — customizable greeting messages with template variables
- **Rules** — group rules with optional private delivery and custom buttons
- **Notes** — saved messages retrievable by name or `#hashtag`
- **Filters** — auto-reply triggers with contains/prefix/exact/command matching
- **Cleaning** — auto-delete commands, message types, and service messages
- **Echo & Broadcast** — send formatted messages as the bot

### Federations
- **Cross-group bans** — ban a user once, enforce across all federated groups
- **Federation subscriptions** — subscribe to another federation's ban list
- **Import/Export** — bulk import bans from JSON (max 5MB / 10,000 entries)
- **Federated admin system** — promote admins, set log channels, require ban reasons

### Zenon Network Integration
- **Wallet linking** — link and verify Zenon addresses (`z1...`)
- **Token gating** — restrict group access based on ZTS token balance
- **On-chain queries** — balances, pillars, staking, plasma, delegations, rewards
- **Network info** — sync status, momentum, peer count
- **Token browser** — look up any ZTS token by address
- **Accelerator-Z** — browse funding proposals and voting info
- **Bridge & HTLC** — bridge network info and hash time-locked contract lookups
- **Subscriptions** — get notified of new momentums or address activity
- **Send & Fuse** — send tokens and fuse QSR for plasma from the bot wallet

### PM Connections
- **Remote management** — connect to a group from PM and run admin commands remotely
- **Auto-revalidation** — connections are deactivated if admin status is lost

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 20+ (ESM) |
| Language | TypeScript 5.4+ (strict mode) |
| Bot Framework | [grammY](https://grammy.dev) 1.x |
| Database | PostgreSQL 16 via [Prisma](https://prisma.io) ORM 5.x |
| Cache | Redis 7 via [ioredis](https://github.com/redis/ioredis) |
| Blockchain | [znn-typescript-sdk](https://github.com/digitalSloth/znn-typescript-sdk) |
| Validation | [zod](https://zod.dev) |
| Testing | [vitest](https://vitest.dev) |
| Logging | [pino](https://getpino.io) |

## Prerequisites

- Node.js >= 20
- PostgreSQL 16+
- Redis 7+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- (Optional) Zenon Network node access for blockchain features

## Quick Start

### With Docker Compose (recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/ms-kaine-admin-bot.git
cd ms-kaine-admin-bot

# Configure environment
cp .env.example .env
# Edit .env — at minimum set BOT_TOKEN and POSTGRES_PASSWORD

# Start everything
docker compose up -d
```

Docker Compose provides PostgreSQL, Redis, and the bot. The bot container waits for both services to be healthy before starting.

### Manual Setup

```bash
# Install dependencies
npm ci

# Generate Prisma client
npx prisma generate

# Push database schema (or use migrations)
npx prisma db push

# Configure environment
cp .env.example .env
# Edit .env with your values

# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `BOT_TOKEN` | Yes | — | Telegram Bot API token |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | Yes | — | PostgreSQL password (used by Docker Compose) |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection URL |
| `REDIS_PASSWORD` | No | — | Redis password (Docker Compose auto-builds REDIS_URL) |
| `BOT_OWNER_ID` | No | `0` | Telegram user ID for owner-only commands |
| `ZENON_NODE_HTTP` | No | `https://node.zenonhub.io:35997` | Zenon HTTP endpoint |
| `ZENON_NODE_WS` | No | `wss://node.zenonhub.io:35998` | Zenon WebSocket endpoint |
| `ZENON_MNEMONIC` | No | — | Bot wallet mnemonic for send/fuse features |
| `HEALTH_PORT` | No | `0` | HTTP health check port (0 = disabled) |
| `LOG_LEVEL` | No | `info` | Log level: trace, debug, info, warn, error |
| `NODE_ENV` | No | `development` | Environment: development or production |

## Development

```bash
npm run dev              # Development with hot reload (tsx watch)
npm run build            # TypeScript compilation
npm start                # Run compiled build
npm run lint             # ESLint
npm test                 # Run all tests
npm run test:watch       # Watch mode
npx tsc --noEmit         # Type-check without emitting
```

### Database

```bash
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:migrate       # Create and apply a migration (interactive)
npm run db:push          # Push schema directly (no migration file)
```

After any change to `prisma/schema.prisma`, run `npm run db:generate` before building or testing.

### Project Structure

```
src/
├── index.ts                 # Entry point
├── bot.ts                   # Bot creation and middleware chain
├── context.ts               # Extended BotContext type
├── core/                    # Singletons: database, redis, logger, zenon-client
├── middleware/               # Auth, connection, antiflood, rate-limit, etc.
├── modules/                 # Feature modules (each a grammY Composer)
│   ├── start/               # /start, /help
│   ├── admin/               # Admin management
│   ├── bans/                # Bans, mutes, kicks
│   ├── warnings/            # Warning system
│   ├── reports/             # User reporting
│   ├── purges/              # Message purging
│   ├── log-channels/        # Audit logging
│   ├── pins/                # Pin management
│   ├── approvals/           # User approvals
│   ├── disabling/           # Command toggling
│   ├── locks/               # Content type locks
│   ├── captcha/             # Join verification
│   ├── blocklist/           # Word/pattern blocking
│   ├── antiflood/           # Flood protection
│   ├── antiraid/            # Raid protection
│   ├── greetings/           # Welcome/goodbye messages
│   ├── rules/               # Group rules
│   ├── notes/               # Saved notes
│   ├── filters/             # Auto-reply filters
│   ├── connections/         # PM-to-group connections
│   ├── echo/                # Echo/say/broadcast
│   ├── cleaning/            # Auto-cleaning
│   ├── info/                # User/chat info
│   ├── federations/         # Cross-group federations
│   └── zenon/               # Zenon blockchain integration
│       ├── wallet.handler.ts
│       ├── network.handler.ts
│       ├── token.handler.ts
│       ├── pillar.handler.ts
│       ├── stake.handler.ts
│       ├── plasma.handler.ts
│       ├── send.handler.ts
│       ├── bridge.handler.ts
│       ├── htlc.handler.ts
│       ├── accelerator.handler.ts
│       ├── subscription.handler.ts
│       └── gating.handler.ts
├── utils/                   # Shared utilities
│   ├── time-parser.ts       # Duration parsing (1d 2h 30m)
│   ├── user-resolver.ts     # Resolve user from reply/@username/ID
│   ├── message-builder.ts   # HTML escaping, mentions, button parsing
│   └── permissions.ts       # Admin permission guards
├── scheduler/               # Deferred action execution (unban, unmute, etc.)
prisma/
└── schema.prisma            # Database schema (~20 models)
tests/                       # Unit and integration tests (vitest)
docs/                        # Security audit and other documentation
```

### Architecture

The bot follows a middleware chain pattern. Each middleware enriches the `BotContext` before handlers run:

1. **Session** — grammY session management
2. **Connection** — PM-to-group forwarding resolution
3. **Chat Settings** — loads per-group settings from the database
4. **Auth** — resolves permissions (isAdmin, isOwner, isCreator, isApproved)
5. **Silent Action** — flags for suppressed bot responses
6. **Command State** — tracks disabled/enabled commands per chat
7. **Antiflood** — message rate limiting per user
8. **Rate Limit** — global command rate limiting

Modules are registered after middleware. Each module is a `Composer<BotContext>` that registers its own command handlers. Registration order (defined in `src/modules/index.ts`) determines command precedence.

Core singletons (`src/core/`) are lazy-initialized: `getDatabase()`, `getRedis()`, `getZenonClient()`, `logger`. Graceful shutdown tears down in order: scheduler, bot, zenon, redis, database.

## Command Reference

### Moderation

| Command | Description |
|---|---|
| `/ban`, `/tban`, `/dban`, `/sban` | Ban a user (temp/delete/silent variants) |
| `/unban` | Remove a ban |
| `/mute`, `/tmute`, `/dmute`, `/smute` | Mute a user |
| `/unmute` | Remove a mute |
| `/kick`, `/dkick`, `/skick` | Kick a user |
| `/warn`, `/dwarn`, `/swarn` | Warn a user |
| `/rmwarn`, `/resetwarn` | Remove warnings |
| `/warns`, `/warnings` | View warnings |
| `/setwarnlimit`, `/setwarnmode`, `/setwarntime` | Configure warning system |
| `/promote`, `/demote` | Manage admin status |
| `/adminlist` | List chat admins |
| `/purge`, `/spurge`, `/del` | Delete messages |
| `/report`, `@admin` | Report a message to admins |
| `/approve`, `/unapprove` | Manage approved users |

### Anti-Spam

| Command | Description |
|---|---|
| `/captcha on\|off` | Toggle CAPTCHA verification |
| `/captchamode button\|text\|math\|custom` | Set CAPTCHA type |
| `/lock`, `/unlock` | Lock/unlock content types |
| `/addblocklist`, `/rmblocklist` | Manage blocklist triggers |
| `/setflood`, `/setfloodmode` | Configure flood protection |
| `/antiraid on\|off` | Toggle raid protection |

### Content

| Command | Description |
|---|---|
| `/welcome`, `/setwelcome` | Welcome message settings |
| `/rules`, `/setrules` | Group rules |
| `/save`, `/get`, `#note` | Notes system |
| `/filter`, `/stop` | Auto-reply filters |
| `/connect`, `/disconnect` | PM connection management |
| `/echo`, `/say` | Send message as bot |
| `/setlog`, `/unsetlog` | Audit log channel |
| `/disable`, `/enable` | Toggle commands |
| `/pin`, `/unpin` | Pin management |

### Federations

| Command | Description |
|---|---|
| `/newfed`, `/delfed` | Create/delete a federation |
| `/joinfed`, `/leavefed` | Join/leave a federation |
| `/fban`, `/unfban` | Federation ban/unban |
| `/fedpromote`, `/feddemote` | Manage federation admins |
| `/subfed`, `/unsubfed` | Federation subscriptions |
| `/importfbans` | Bulk import bans from JSON |

### Zenon Network

| Command | Description |
|---|---|
| `/zwallet` | Link/verify/unlink a Zenon wallet |
| `/zbalance` | Check token balances |
| `/zstats` | Network status |
| `/ztoken`, `/ztokens` | Token info |
| `/zpillar`, `/zpillars` | Pillar info |
| `/zstakes`, `/zrewards` | Staking and rewards |
| `/zplasma`, `/zfuse` | Plasma info and QSR fusion |
| `/zsend` | Send tokens from bot wallet |
| `/zgate` | Token-gated group access |
| `/zsub`, `/zunsub` | Event subscriptions |
| `/zproposals`, `/zproposal` | Accelerator-Z proposals |
| `/zbridge`, `/zhtlc` | Bridge and HTLC info |

## Docker

### Building

```bash
docker build -t ms-kaine-admin-bot .
```

The Dockerfile uses a multi-stage build: dependency install, TypeScript compilation with Prisma generation, and a slim production image running as non-root (`USER node`).

### Docker Compose

```bash
docker compose up -d        # Start all services
docker compose logs -f bot  # Follow bot logs
docker compose down         # Stop everything
```

Services:
- **postgres** — PostgreSQL 16 Alpine with health checks
- **redis** — Redis 7 Alpine with optional password authentication
- **bot** — The bot application (waits for healthy DB and Redis)

Redis authentication is optional. Set `REDIS_PASSWORD` in `.env` to enable it — Docker Compose automatically constructs the `REDIS_URL` with credentials.

## Security

A comprehensive security audit has been performed. See [`docs/security-audit.md`](docs/security-audit.md) for the full report.

Key hardening measures:
- HTML escaping includes quote characters to prevent attribute breakout
- Blocklist regex patterns are bounded to prevent ReDoS attacks
- Federation imports are capped at 5MB / 10,000 entries
- Message purges are capped at 200 messages
- Sensitive data (mnemonics) is never logged as full error objects
- PM connections revalidate admin status on every request
- Docker container runs as non-root user
- Redis supports password authentication
