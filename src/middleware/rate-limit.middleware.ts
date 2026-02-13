import type { Middleware } from "grammy";
import type { BotContext } from "../context.js";
import { getRedis } from "../core/redis.js";
import { createChildLogger } from "../core/logger.js";

const log = createChildLogger("rate-limit");

/**
 * Per-user per-command rate limiting via Redis.
 * Limits users to a configurable number of commands per window.
 */
export function rateLimitMiddleware(opts?: {
  maxRequests?: number;
  windowMs?: number;
}): Middleware<BotContext> {
  const maxRequests = opts?.maxRequests ?? 20;
  const windowMs = opts?.windowMs ?? 60_000; // 1 minute

  return async (ctx, next) => {
    // Only rate limit commands from users
    if (!ctx.from || !ctx.message?.text?.startsWith("/")) {
      return next();
    }

    // Don't rate limit admins
    if (ctx.permissions?.isAdmin) {
      return next();
    }

    const redis = getRedis();
    const userId = ctx.from.id;
    const chatId = ctx.chat?.id ?? 0;
    const key = `ratelimit:${chatId}:${userId}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }

      if (current > maxRequests) {
        log.debug({ userId, chatId, count: current }, "Rate limited");
        // Silently drop the command
        return;
      }
    } catch (err) {
      log.error({ err }, "Rate limit check failed");
      // On Redis failure, allow the request
    }

    return next();
  };
}
