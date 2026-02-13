import { Middleware } from "grammy";
import type { BotContext } from "../context.js";
import { getDatabase } from "../core/database.js";

/**
 * Middleware that resolves the caller's permission level in the current chat.
 * Sets ctx.permissions with isAdmin, isOwner, isCreator, isApproved.
 */
export function authMiddleware(): Middleware<BotContext> {
  return async (ctx, next) => {
    ctx.permissions = {
      isAdmin: false,
      isOwner: false,
      isCreator: false,
      isApproved: false,
    };

    if (!ctx.from || !ctx.chat || ctx.chat.type === "private") {
      return next();
    }

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      const member = await ctx.api.getChatMember(chatId, userId);

      if (member.status === "creator") {
        ctx.permissions.isAdmin = true;
        ctx.permissions.isOwner = true;
        ctx.permissions.isCreator = true;
      } else if (member.status === "administrator") {
        ctx.permissions.isAdmin = true;
      }
    } catch {
      // If we can't get member info, fall back to cached admin list
      const db = getDatabase();
      const cachedAdmin = await db.chatAdmin.findUnique({
        where: { chatId_userId: { chatId: BigInt(chatId), userId: BigInt(userId) } },
      });
      if (cachedAdmin) {
        ctx.permissions.isAdmin = true;
      }
    }

    // Check approval status
    try {
      const db = getDatabase();
      const approval = await db.approvedUser.findUnique({
        where: {
          chatId_userId: {
            chatId: BigInt(chatId),
            userId: BigInt(userId),
          },
        },
      });
      if (approval) {
        ctx.permissions.isApproved = true;
      }
    } catch {
      // Ignore approval check errors
    }

    return next();
  };
}
