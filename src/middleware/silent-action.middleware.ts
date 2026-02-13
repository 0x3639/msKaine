import { Middleware } from "grammy";
import type { BotContext } from "../context.js";

/**
 * Middleware that detects silent action prefixes (sban, skick, smute, swarn)
 * and sets ctx.isSilent = true so handlers can suppress output.
 */
export function silentActionMiddleware(): Middleware<BotContext> {
  return async (ctx, next) => {
    ctx.isSilent = false;

    if (!ctx.message?.text) return next();

    const text = ctx.message.text;
    if (!text.startsWith("/")) return next();

    const command = text.split(/[\s@]/)[0].slice(1).toLowerCase();
    const silentCommands = ["sban", "skick", "smute", "swarn"];

    if (silentCommands.includes(command)) {
      ctx.isSilent = true;

      // Delete the command message for silent actions
      if (ctx.chatSettings?.chat?.silentActions) {
        try {
          await ctx.deleteMessage();
        } catch {
          // ignore
        }
      }
    }

    return next();
  };
}
