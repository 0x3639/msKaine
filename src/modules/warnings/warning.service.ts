import { getDatabase } from "../../core/database.js";
import type { BotContext } from "../../context.js";
import { banUser, muteUser, kickUser } from "../bans/restriction.service.js";

/**
 * Add a warning to a user and check if the limit has been reached.
 * Returns the current warning count and whether the limit action was triggered.
 */
export async function addWarning(
  ctx: BotContext,
  userId: bigint,
  warnerId: bigint,
  reason?: string
): Promise<{ count: number; limit: number; actionTriggered: boolean; actionText?: string }> {
  const db = getDatabase();
  const chatId = ctx.chatSettings!.chat.id;

  // Create the warning
  await db.warning.create({
    data: { chatId, userId, warnerId, reason },
  });

  // Get current count
  const count = await db.warning.count({
    where: { chatId, userId },
  });

  const { warnLimit, warnMode } = ctx.chatSettings!.chat;

  if (count >= warnLimit) {
    // Execute the limit action
    const targetId = Number(userId);
    const targetName = "User";

    let actionText = "";

    switch (warnMode) {
      case "BAN":
        await banUser(ctx, { targetId, targetName, reason: `Exceeded ${warnLimit} warnings` });
        actionText = "banned";
        break;
      case "MUTE":
        await muteUser(ctx, { targetId, targetName, reason: `Exceeded ${warnLimit} warnings` });
        actionText = "muted";
        break;
      case "KICK":
        await kickUser(ctx, { targetId, targetName, reason: `Exceeded ${warnLimit} warnings` });
        actionText = "kicked";
        break;
      case "TBAN":
        await banUser(ctx, { targetId, targetName, reason: `Exceeded ${warnLimit} warnings`, duration: ctx.chatSettings!.chat.warnTime ?? 86400 });
        actionText = "temporarily banned";
        break;
      case "TMUTE":
        await muteUser(ctx, { targetId, targetName, reason: `Exceeded ${warnLimit} warnings`, duration: ctx.chatSettings!.chat.warnTime ?? 86400 });
        actionText = "temporarily muted";
        break;
    }

    // Clear warnings after action
    await db.warning.deleteMany({ where: { chatId, userId } });

    return { count, limit: warnLimit, actionTriggered: true, actionText };
  }

  return { count, limit: warnLimit, actionTriggered: false };
}

/**
 * Remove the most recent warning for a user.
 */
export async function removeLastWarning(
  chatId: bigint,
  userId: bigint
): Promise<boolean> {
  const db = getDatabase();
  const lastWarning = await db.warning.findFirst({
    where: { chatId, userId },
    orderBy: { createdAt: "desc" },
  });

  if (!lastWarning) return false;

  await db.warning.delete({ where: { id: lastWarning.id } });
  return true;
}

/**
 * Clear all warnings for a user.
 */
export async function resetWarnings(
  chatId: bigint,
  userId: bigint
): Promise<number> {
  const db = getDatabase();
  const result = await db.warning.deleteMany({
    where: { chatId, userId },
  });
  return result.count;
}

/**
 * Get all warnings for a user.
 */
export async function getWarnings(
  chatId: bigint,
  userId: bigint
): Promise<Array<{ reason: string | null; createdAt: Date; warnerId: bigint }>> {
  const db = getDatabase();
  return db.warning.findMany({
    where: { chatId, userId },
    select: { reason: true, createdAt: true, warnerId: true },
    orderBy: { createdAt: "asc" },
  });
}
