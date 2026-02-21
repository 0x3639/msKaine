import { Middleware } from "grammy";
import type { BotContext } from "../context.js";
import { getDatabase } from "../core/database.js";
import { logger } from "../core/logger.js";

const log = logger.child({ module: "connection" });

/**
 * Middleware that resolves PM commands to a connected group.
 * When a user sends a command in PM, this looks up their active connection
 * and attaches it to ctx.connection so handlers can operate on the connected group.
 *
 * Revalidates admin status on each request to prevent stale access.
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
      // Revalidate: check that user is still an admin in the connected chat
      try {
        const member = await ctx.api.getChatMember(
          Number(connection.chatId),
          ctx.from.id,
        );
        if (member.status !== "administrator" && member.status !== "creator") {
          // User is no longer admin — deactivate the connection
          await db.connection.update({
            where: { id: connection.id },
            data: { isActive: false },
          });
          log.info(
            { userId: ctx.from.id, chatId: Number(connection.chatId) },
            "Deactivated stale PM connection (user no longer admin)",
          );
          return next();
        }
      } catch {
        // API error (bot removed from chat, etc.) — deactivate connection
        await db.connection.update({
          where: { id: connection.id },
          data: { isActive: false },
        });
        return next();
      }

      ctx.connection = {
        chatId: connection.chatId,
        chatTitle: connection.chat.title ?? "Unknown Chat",
      };
    }

    return next();
  };
}
