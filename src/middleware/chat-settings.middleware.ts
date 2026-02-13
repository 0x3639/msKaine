import { Middleware } from "grammy";
import type { BotContext } from "../context.js";
import { getDatabase } from "../core/database.js";

/**
 * Middleware that loads (or creates) the chat settings from the database
 * and attaches them to ctx.chatSettings.
 */
export function chatSettingsMiddleware(): Middleware<BotContext> {
  return async (ctx, next) => {
    ctx.chatSettings = { chat: null as any, loaded: false };

    if (!ctx.chat || ctx.chat.type === "private") {
      return next();
    }

    const db = getDatabase();
    const chatId = BigInt(ctx.chat.id);

    let chat = await db.chat.findUnique({ where: { id: chatId } });

    if (!chat) {
      chat = await db.chat.create({
        data: {
          id: chatId,
          title: ctx.chat.title ?? null,
          chatType: ctx.chat.type,
        },
      });
    } else if (ctx.chat.title && chat.title !== ctx.chat.title) {
      // Update title if it changed
      chat = await db.chat.update({
        where: { id: chatId },
        data: { title: ctx.chat.title },
      });
    }

    ctx.chatSettings = { chat, loaded: true };
    return next();
  };
}
