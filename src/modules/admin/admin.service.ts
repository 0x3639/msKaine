import { getDatabase } from "../../core/database.js";
import type { BotContext } from "../../context.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("admin-service");

/**
 * Refresh the cached admin list for a chat from the Telegram API.
 */
export async function refreshAdminCache(ctx: BotContext): Promise<void> {
  if (!ctx.chat) return;

  const db = getDatabase();
  const chatId = BigInt(ctx.chat.id);

  try {
    const admins = await ctx.api.getChatAdministrators(ctx.chat.id);

    // Clear old cache
    await db.chatAdmin.deleteMany({ where: { chatId } });

    // Insert fresh data
    for (const admin of admins) {
      await db.chatAdmin.create({
        data: {
          chatId,
          userId: BigInt(admin.user.id),
          isAnonymous:
            admin.status === "administrator"
              ? admin.is_anonymous
              : false,
          canPromote:
            admin.status === "administrator"
              ? (admin.can_promote_members ?? false)
              : true,
          canRestrict:
            admin.status === "administrator"
              ? (admin.can_restrict_members ?? false)
              : true,
          canDelete:
            admin.status === "administrator"
              ? (admin.can_delete_messages ?? false)
              : true,
          canPin:
            admin.status === "administrator"
              ? (admin.can_pin_messages ?? false)
              : true,
          customTitle:
            admin.status === "administrator"
              ? (admin.custom_title ?? null)
              : null,
        },
      });

      // Upsert user record
      await db.user.upsert({
        where: { id: BigInt(admin.user.id) },
        create: {
          id: BigInt(admin.user.id),
          username: admin.user.username ?? null,
          firstName: admin.user.first_name,
          lastName: admin.user.last_name ?? null,
        },
        update: {
          username: admin.user.username ?? null,
          firstName: admin.user.first_name,
          lastName: admin.user.last_name ?? null,
          lastSeenAt: new Date(),
        },
      });
    }

    // Update cache timestamp
    await db.chat.update({
      where: { id: chatId },
      data: { adminCacheUpdatedAt: new Date() },
    });

    log.debug({ chatId: ctx.chat.id, count: admins.length }, "Admin cache refreshed");
  } catch (err) {
    log.error({ err, chatId: ctx.chat.id }, "Failed to refresh admin cache");
    throw err;
  }
}
