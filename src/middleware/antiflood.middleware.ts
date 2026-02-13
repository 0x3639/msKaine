import { Middleware } from "grammy";
import type { BotContext } from "../context.js";
import { getRedis } from "../core/redis.js";
import { createChildLogger } from "../core/logger.js";

const log = createChildLogger("antiflood");

/**
 * Middleware that detects message flooding and takes action.
 * Uses Redis sliding window counters per user per chat.
 * Must run after chatSettingsMiddleware and authMiddleware.
 */
export function antifloodMiddleware(): Middleware<BotContext> {
  return async (ctx, next) => {
    // Only check messages in groups
    if (
      !ctx.message ||
      !ctx.chat ||
      ctx.chat.type === "private" ||
      !ctx.from
    ) {
      return next();
    }

    // Skip if antiflood is disabled or user is admin/approved
    if (!ctx.chatSettings?.loaded) return next();

    const { floodLimit, floodTimer } = ctx.chatSettings.chat;
    if (floodLimit <= 0) return next();
    if (ctx.permissions.isAdmin || ctx.permissions.isApproved) return next();

    const redis = getRedis();
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const key = `flood:${chatId}:${userId}`;

    try {
      const now = Date.now();
      const windowMs = floodTimer > 0 ? floodTimer * 1000 : 5000; // default 5s window

      // Add current message timestamp and trim old entries
      await redis
        .multi()
        .zadd(key, now, `${now}`)
        .zremrangebyscore(key, 0, now - windowMs)
        .expire(key, Math.ceil(windowMs / 1000) + 1)
        .exec();

      const count = await redis.zcard(key);

      if (count >= floodLimit) {
        log.info(
          { chatId, userId, count, limit: floodLimit },
          "Flood detected"
        );
        // Clean the counter so we don't re-trigger
        await redis.del(key);

        // Action will be handled by the antiflood module handler
        // Set a flag so the antiflood module can act
        (ctx as any)._floodTriggered = true;
      }
    } catch (err) {
      log.error({ err, chatId, userId }, "Antiflood check failed");
    }

    return next();
  };
}
