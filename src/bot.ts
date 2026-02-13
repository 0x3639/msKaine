import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import type { BotContext } from "./context.js";
import { handleError } from "./core/error-handler.js";
import {
  sessionMiddleware,
  authMiddleware,
  chatSettingsMiddleware,
  commandStateMiddleware,
  antifloodMiddleware,
  connectionMiddleware,
  silentActionMiddleware,
  rateLimitMiddleware,
} from "./middleware/index.js";
import { registerModules } from "./modules/index.js";

export function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // Auto-retry on Telegram API rate limits
  bot.api.config.use(autoRetry());

  // Global error handler
  bot.catch(handleError);

  // Middleware chain (order matters!)
  bot.use(sessionMiddleware());
  bot.use(connectionMiddleware());
  bot.use(chatSettingsMiddleware());
  bot.use(authMiddleware());
  bot.use(silentActionMiddleware());
  bot.use(commandStateMiddleware());
  bot.use(antifloodMiddleware());
  bot.use(rateLimitMiddleware());

  // Register all feature modules
  registerModules(bot);

  // Ensure user info is saved/updated
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const { getDatabase } = await import("./core/database.js");
      const db = getDatabase();
      try {
        await db.user.upsert({
          where: { id: BigInt(ctx.from.id) },
          create: {
            id: BigInt(ctx.from.id),
            username: ctx.from.username ?? null,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name ?? null,
          },
          update: {
            username: ctx.from.username ?? null,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name ?? null,
            lastSeenAt: new Date(),
          },
        });
      } catch {
        // Non-critical - don't block the update
      }
    }
    return next();
  });

  return bot;
}
