import { Middleware } from "grammy";
import type { BotContext } from "../context.js";
import { createChildLogger } from "../core/logger.js";
import { getDatabase } from "../core/database.js";
import { escapeHtml } from "../utils/message-builder.js";

const log = createChildLogger("log-channel");

export interface LogAction {
  category: string;
  action: string;
  actorId?: bigint;
  actorName?: string;
  targetId?: bigint;
  targetName?: string;
  details?: string;
}

/**
 * Send a moderation log entry to the configured log channel.
 */
export async function sendLogEntry(
  ctx: BotContext,
  logAction: LogAction
): Promise<void> {
  if (!ctx.chatSettings?.loaded) return;

  const { logChannelId, logCategories } = ctx.chatSettings.chat;
  if (!logChannelId) return;

  // Check if this category is enabled
  if (
    logCategories.length > 0 &&
    !logCategories.includes(logAction.category)
  ) {
    return;
  }

  const db = getDatabase();

  // Save to database
  try {
    await db.logEntry.create({
      data: {
        chatId: ctx.chatSettings.chat.id,
        category: logAction.category,
        actorId: logAction.actorId,
        targetId: logAction.targetId,
        action: logAction.action,
        details: logAction.details ? { text: logAction.details } : undefined,
      },
    });
  } catch (err) {
    log.error({ err }, "Failed to save log entry");
  }

  // Send to log channel
  try {
    const chatTitle = escapeHtml(ctx.chat?.title ?? "Unknown Chat");
    const actor = logAction.actorName
      ? escapeHtml(logAction.actorName)
      : "Unknown";
    const target = logAction.targetName
      ? escapeHtml(logAction.targetName)
      : logAction.targetId
        ? String(logAction.targetId)
        : "";

    let message = `<b>${chatTitle}</b>\n`;
    message += `<b>#${logAction.category.toUpperCase()}</b>\n`;
    message += `<b>Action:</b> ${escapeHtml(logAction.action)}\n`;
    message += `<b>By:</b> ${actor}`;
    if (logAction.actorId) message += ` (<code>${logAction.actorId}</code>)`;
    message += "\n";
    if (target) {
      message += `<b>Target:</b> ${target}`;
      if (logAction.targetId)
        message += ` (<code>${logAction.targetId}</code>)`;
      message += "\n";
    }
    if (logAction.details) {
      message += `<b>Details:</b> ${escapeHtml(logAction.details)}\n`;
    }

    await ctx.api.sendMessage(Number(logChannelId), message, {
      parse_mode: "HTML",
    });
  } catch (err) {
    log.error({ err, logChannelId }, "Failed to send log to channel");
  }
}

/**
 * Middleware placeholder - log channel sending is done via the sendLogEntry helper,
 * not as middleware. This just ensures the log-channel module is importable.
 */
export function logChannelMiddleware(): Middleware<BotContext> {
  return async (_ctx, next) => next();
}
