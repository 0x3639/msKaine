import { Middleware } from "grammy";
import type { BotContext } from "../context.js";
import { getDatabase } from "../core/database.js";

/**
 * Middleware that blocks execution of disabled commands.
 * Must run after chatSettingsMiddleware and authMiddleware.
 */
export function commandStateMiddleware(): Middleware<BotContext> {
  return async (ctx, next) => {
    if (!ctx.message?.text || !ctx.chat || ctx.chat.type === "private") {
      return next();
    }

    const text = ctx.message.text;
    if (!text.startsWith("/")) return next();

    const command = text.split(/[\s@]/)[0].slice(1).toLowerCase();
    if (!command) return next();

    const chatId = BigInt(ctx.chat.id);
    const db = getDatabase();

    const disabled = await db.disabledCommand.findUnique({
      where: { chatId_command: { chatId, command } },
    });

    if (!disabled) return next();

    // Check if admin override is enabled
    if (ctx.permissions.isAdmin && !disabled.disableAdmin) {
      return next();
    }

    // Delete the command message if configured
    if (disabled.deleteMsg) {
      try {
        await ctx.deleteMessage();
      } catch {
        // Might not have delete permission
      }
    }

    // Block execution - don't call next()
  };
}
