import { Middleware } from "grammy";
import type { BotContext } from "../context.js";
import { getDatabase } from "../core/database.js";

/**
 * Middleware that resolves PM commands to a connected group.
 * When a user sends a command in PM, this looks up their active connection
 * and attaches it to ctx.connection so handlers can operate on the connected group.
 */
export function connectionMiddleware(): Middleware<BotContext> {
  return async (ctx, next) => {
    ctx.connection = undefined;

    if (!ctx.from || ctx.chat?.type !== "private") {
      return next();
    }

    const db = getDatabase();
    const connection = await db.connection.findFirst({
      where: {
        userId: BigInt(ctx.from.id),
        isActive: true,
      },
      include: {
        chat: { select: { id: true, title: true } },
      },
      orderBy: { connectedAt: "desc" },
    });

    if (connection) {
      ctx.connection = {
        chatId: connection.chatId,
        chatTitle: connection.chat.title ?? "Unknown Chat",
      };
    }

    return next();
  };
}
