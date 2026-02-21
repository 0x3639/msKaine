# Security Audit Report

**Date**: 2026-02-21
**Branch**: `feature/security-fixes`
**Auditor**: Claude (Senior Security Researcher)

---

## Summary

Comprehensive security audit of the Mr. Kaine Admin Bot codebase. Identified 10 vulnerabilities across input handling, authentication/authorization, secrets management, DoS vectors, and infrastructure.

| # | Vulnerability | Severity | Status |
|---|---|---|---|
| 1 | Echo HTML injection | HIGH | Accepted (by design for admins) |
| 2 | Incomplete `escapeHtml()` | MEDIUM | **Fixed** |
| 3 | ReDoS in blocklist glob/homoglyph | HIGH | **Fixed** |
| 4 | Federation import — no size/count limit | MEDIUM | **Fixed** |
| 5 | Unbounded purge (no max cap) | MEDIUM | **Fixed** |
| 6 | Mnemonic exposure in error logs | CRITICAL | **Fixed** |
| 7 | PM connection — no admin revalidation | MEDIUM | **Fixed** |
| 8 | Wallet auto-verify without on-chain proof | HIGH | Deferred (Zenon feature) |
| 9 | Dockerfile missing explicit non-root USER | LOW | **Fixed** |
| 10 | Redis without password in Docker | LOW | **Fixed** |

---

## Findings Detail

### 1. Echo HTML Injection (HIGH — Accepted Risk)

**File**: `src/modules/echo/index.ts`

**Description**: The `/echo` and `/say` commands pass user text directly to `ctx.reply(text, { parse_mode: "HTML" })` without escaping. An admin can inject arbitrary HTML tags.

**Decision**: This is intentionally designed for admin use — admins use `/echo` to send formatted messages with bold, italic, links, etc. The command is already guarded by `requireAdmin()`. Documented as accepted risk.

### 2. Incomplete `escapeHtml()` (MEDIUM — Fixed)

**File**: `src/utils/message-builder.ts`

**Description**: The `escapeHtml()` function only escaped `&`, `<`, and `>` but not `"` and `'`. While Telegram's HTML parse mode is limited, incomplete escaping could allow attribute breakout in edge cases where escaped text is used inside HTML attributes.

**Fix**: Added `.replace(/"/g, "&quot;")` and `.replace(/'/g, "&#39;")`.

### 3. ReDoS in Blocklist (HIGH — Fixed)

**File**: `src/modules/blocklist/index.ts`

**Description**: Two ReDoS vectors:
1. Glob-to-regex conversion used `trigger.replace(/\*/g, ".*")` creating unbounded `.*` patterns. A trigger like `*a*a*a*a*` causes catastrophic backtracking.
2. `containsLookalike()` builds complex regex from homoglyph character classes that can cause exponential backtracking.

**Fix**:
- Added 100-character limit on blocklist trigger length at add time
- Changed glob `*` conversion from `.*` (greedy) to `[^/]*?` (lazy, bounded)
- Wrapped all regex tests with input length bounds (text capped at 1000 chars for regex matching)
- Added try/catch around regex operations to prevent crashes

### 4. Federation Import — No Size/Count Limit (MEDIUM — Fixed)

**File**: `src/modules/federations/index.ts`

**Description**: `/importfbans` downloaded files with no size check, parsed unbounded JSON, and processed unlimited ban entries. Could cause memory exhaustion with large files.

**Fix**:
- Added 5MB file size check before download
- Limited import to 10,000 ban entries
- Added validation that each entry has a valid `user_id` number
- Better error handling with specific error messages

### 5. Unbounded Purge (MEDIUM — Fixed)

**File**: `src/modules/purges/index.ts`

**Description**: Without an explicit count argument, `/purge` would delete all messages between the reply and the command. In busy chats, the message ID range could span thousands.

**Fix**: Added 200-message hard cap. If the range exceeds 200 messages and no explicit count was provided, the bot warns the admin and refuses to proceed.

### 6. Mnemonic Exposure in Error Logs (CRITICAL — Fixed)

**File**: `src/core/zenon-client.ts`

**Description**: If `KeyStore.fromMnemonic()` threw an exception, the error object (which may contain the mnemonic in its message or stack trace) was logged via `log.error({ err }, "...")`. Pino serializes the full error object including message and stack.

**Fix**: Wrapped mnemonic usage in a nested try/catch that only logs `err.message` (as a string), never the full error object. Same pattern applied in wallet handler.

### 7. PM Connection — No Admin Revalidation (MEDIUM — Fixed)

**File**: `src/middleware/connection.middleware.ts`

**Description**: Once a PM connection was established, it persisted indefinitely. A user removed from admin or removed from the chat entirely could continue operating via their PM connection.

**Fix**: Added admin status revalidation via `getChatMember` API call on every PM request that uses a connection. If the user is no longer an admin (or not in the chat), the connection is deactivated.

### 8. Wallet Auto-Verify (HIGH — Deferred)

**File**: `src/modules/zenon/wallet.handler.ts`

**Description**: Wallet verification auto-verifies on `/zwallet verify` without checking for an on-chain transaction proving ownership. Any user can claim any Zenon address.

**Status**: Deferred — this was already identified in the roadmap audit. Proper fix requires on-chain transaction verification which is a substantial Zenon integration task.

### 9. Dockerfile Missing Non-Root USER (LOW — Fixed)

**File**: `Dockerfile`

**Description**: While `node:20-alpine` doesn't run as root by default in all configurations, best practice is to explicitly set `USER node` to ensure the container never runs as root.

**Fix**: Added `USER node` directive in the production stage.

### 10. Redis Without Password (LOW — Fixed)

**File**: `docker-compose.yml`

**Description**: Redis was running without authentication. In a compromised network, any process could connect to Redis and read/modify cached data.

**Fix**: Added `REDIS_PASSWORD` environment variable support. Redis now starts with `--requirepass` when a password is set. Updated `.env.example` and Redis URL format.
