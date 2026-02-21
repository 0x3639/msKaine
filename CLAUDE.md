# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mr. Kaine Admin Bot is a Telegram group administration/moderation bot with Zenon Network blockchain integration. It replicates Miss Rose bot functionality using TypeScript and the grammY framework.

## Tech Stack

- **Runtime**: Node.js 20+ (ESM modules)
- **Language**: TypeScript 5.4+ (strict mode)
- **Bot Framework**: grammY 1.x
- **Database**: PostgreSQL 16 via Prisma ORM 5.x
- **Cache**: Redis 7 via ioredis
- **Blockchain**: znn-typescript-sdk (Zenon Network)
- **Validation**: zod
- **Testing**: vitest
- **Logging**: pino

## Commands

```bash
npm run dev              # Development with hot reload (tsx watch)
npm run build            # TypeScript compilation
npm start                # Run production build (dist/index.js)
npm run lint             # ESLint on src/
npm test                 # Run all tests (vitest run)
npm run test:watch       # Watch mode tests
npm run db:generate      # Generate Prisma client after schema changes
npm run db:migrate       # Create and apply a migration (interactive)
npm run db:push          # Push schema to DB without creating a migration file
```

Type-checking without emitting: `npx tsc --noEmit`

After any change to `prisma/schema.prisma`, run `npm run db:generate` before building or testing.

## Architecture

### Entry Flow

`src/index.ts` → `src/bot.ts` (createBot) → middleware chain → module registration → long polling

Graceful shutdown handles: scheduler → bot → zenon → redis → database (in order).

### Middleware Chain (order matters)

Defined in `src/bot.ts`. Each middleware enriches `BotContext` for downstream handlers:

1. **Session** — grammY session management
2. **Connection** — PM-to-group forwarding context
3. **Chat Settings** — loads `Chat` model from DB into `ctx.chatSettings`
4. **Auth** — resolves `ctx.permissions` (isAdmin, isOwner, isCreator, isApproved)
5. **Silent Action** — sets `ctx.isSilent` flag for suppressed responses
6. **Command State** — tracks disabled/enabled commands per chat
7. **Antiflood** — message rate limiting per user
8. **Rate Limit** — global command rate limiting

### BotContext

Extended context type (`src/context.ts`) adds: `chatSettings`, `permissions`, `connection`, `zenon`, `isSilent`.

### Module System

Each feature is a `Composer<BotContext>` registered in `src/modules/index.ts`. Registration order determines command precedence. Modules are grouped:

- **Core**: start (help/start commands)
- **Moderation**: admin, bans, warnings, reports, purges, log-channels, pins, approvals, disabling
- **Anti-spam**: locks, captcha, blocklist, antiflood, antiraid, greetings
- **Content**: rules, notes, filters, connections, echo, cleaning, info, federations
- **Blockchain**: zenon (wallet linking, token gating, balance checks, subscriptions)

### Core Singletons

`src/core/` contains lazy-initialized singletons: `database.ts` (Prisma), `redis.ts` (ioredis), `logger.ts` (pino), `zenon-client.ts` (SDK wrapper). Access via `getDatabase()`, `getRedis()`, etc.

### Key Utilities

- `src/utils/time-parser.ts` — duration parsing (`1d 2h 30m` ↔ seconds)
- `src/utils/user-resolver.ts` — resolve target user from reply, @username, or ID
- `src/utils/message-builder.ts` — HTML escaping, user mentions, Rose-style button parsing
- `src/utils/permissions.ts` — admin permission guard helpers

## Database

All Telegram IDs are stored as `BigInt`. Schema is in `prisma/schema.prisma` with ~20 models. Use `BigInt(ctx.from.id)` when querying. Column names use `@map("snake_case")` convention.

## Conventions

- All imports use `.js` extensions (ESM requirement even for .ts files)
- Barrel exports: each module has `index.ts` exporting its composer
- Handlers use early-return guard clauses for permission checks
- Non-critical operations (user upsert, logging) are wrapped in try-catch to avoid blocking
- Zenon SDK failures are non-fatal — the bot runs without blockchain features if unavailable
- Docker Compose provides PostgreSQL + Redis for local development
