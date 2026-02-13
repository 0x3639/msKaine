import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { formatDuration } from "../../utils/time-parser.js";
import { resolveUser } from "../../utils/user-resolver.js";
import { canTarget, botCanRestrict } from "../../utils/permissions.js";
import { userMention, escapeHtml } from "../../utils/message-builder.js";
import { sendLogEntry } from "../../middleware/log-channel.middleware.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("restriction-service");

export type RestrictionAction = "ban" | "mute" | "kick";

interface RestrictionResult {
  success: boolean;
  message: string;
  targetId?: bigint;
  targetName?: string;
}

/**
 * Execute a ban on a user.
 */
export async function banUser(
  ctx: BotContext,
  options: {
    targetId: number;
    targetName: string;
    reason?: string;
    duration?: number; // seconds
    silent?: boolean;
    deleteMessage?: boolean;
  }
): Promise<RestrictionResult> {
  const { targetId, targetName, reason, duration, deleteMessage } = options;

  // Check if bot can restrict
  if (!(await botCanRestrict(ctx))) {
    return { success: false, message: "I don't have permission to ban users." };
  }

  // Check if target can be acted on
  const check = await canTarget(ctx, targetId);
  if (!check.ok) {
    return { success: false, message: check.reason! };
  }

  try {
    const untilDate = duration ? Math.floor(Date.now() / 1000) + duration : 0;

    await ctx.api.banChatMember(ctx.chat!.id, targetId, {
      until_date: untilDate || undefined,
    });

    // Delete the replied message if requested
    if (deleteMessage && ctx.message?.reply_to_message) {
      try {
        await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.reply_to_message.message_id);
      } catch {
        // ignore
      }
    }

    // Schedule unban if temporary
    if (duration) {
      const db = getDatabase();
      await db.scheduledAction.create({
        data: {
          chatId: BigInt(ctx.chat!.id),
          userId: BigInt(targetId),
          actionType: "unban",
          executeAt: new Date(Date.now() + duration * 1000),
          metadata: { reason },
        },
      });
    }

    const durationText = duration ? ` for ${formatDuration(duration)}` : "";
    const reasonText = reason ? `\nReason: ${escapeHtml(reason)}` : "";
    const message = `${userMention(targetId, targetName)} has been banned${durationText}.${reasonText}`;

    // Log the action
    await sendLogEntry(ctx, {
      category: "admin",
      action: duration ? `tban (${formatDuration(duration)})` : "ban",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
      targetId: BigInt(targetId),
      targetName,
      details: reason,
    });

    return { success: true, message, targetId: BigInt(targetId), targetName };
  } catch (err) {
    log.error({ err, chatId: ctx.chat!.id, targetId }, "Failed to ban user");
    return { success: false, message: "Failed to ban that user." };
  }
}

/**
 * Execute a mute on a user.
 */
export async function muteUser(
  ctx: BotContext,
  options: {
    targetId: number;
    targetName: string;
    reason?: string;
    duration?: number;
    silent?: boolean;
    deleteMessage?: boolean;
  }
): Promise<RestrictionResult> {
  const { targetId, targetName, reason, duration, deleteMessage } = options;

  if (!(await botCanRestrict(ctx))) {
    return { success: false, message: "I don't have permission to mute users." };
  }

  const check = await canTarget(ctx, targetId);
  if (!check.ok) {
    return { success: false, message: check.reason! };
  }

  try {
    const untilDate = duration ? Math.floor(Date.now() / 1000) + duration : 0;

    await ctx.api.restrictChatMember(
      ctx.chat!.id,
      targetId,
      {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
      },
      { until_date: untilDate || undefined }
    );

    if (deleteMessage && ctx.message?.reply_to_message) {
      try {
        await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.reply_to_message.message_id);
      } catch {
        // ignore
      }
    }

    if (duration) {
      const db = getDatabase();
      await db.scheduledAction.create({
        data: {
          chatId: BigInt(ctx.chat!.id),
          userId: BigInt(targetId),
          actionType: "unmute",
          executeAt: new Date(Date.now() + duration * 1000),
          metadata: { reason },
        },
      });
    }

    const durationText = duration ? ` for ${formatDuration(duration)}` : "";
    const reasonText = reason ? `\nReason: ${escapeHtml(reason)}` : "";
    const message = `${userMention(targetId, targetName)} has been muted${durationText}.${reasonText}`;

    await sendLogEntry(ctx, {
      category: "admin",
      action: duration ? `tmute (${formatDuration(duration)})` : "mute",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
      targetId: BigInt(targetId),
      targetName,
      details: reason,
    });

    return { success: true, message, targetId: BigInt(targetId), targetName };
  } catch (err) {
    log.error({ err, chatId: ctx.chat!.id, targetId }, "Failed to mute user");
    return { success: false, message: "Failed to mute that user." };
  }
}

/**
 * Kick a user from the chat (they can rejoin).
 */
export async function kickUser(
  ctx: BotContext,
  options: {
    targetId: number;
    targetName: string;
    reason?: string;
    silent?: boolean;
    deleteMessage?: boolean;
  }
): Promise<RestrictionResult> {
  const { targetId, targetName, reason, deleteMessage } = options;

  if (!(await botCanRestrict(ctx))) {
    return { success: false, message: "I don't have permission to kick users." };
  }

  const check = await canTarget(ctx, targetId);
  if (!check.ok) {
    return { success: false, message: check.reason! };
  }

  try {
    // Ban then immediately unban to kick
    await ctx.api.banChatMember(ctx.chat!.id, targetId);
    await ctx.api.unbanChatMember(ctx.chat!.id, targetId, { only_if_banned: true });

    if (deleteMessage && ctx.message?.reply_to_message) {
      try {
        await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.reply_to_message.message_id);
      } catch {
        // ignore
      }
    }

    const reasonText = reason ? `\nReason: ${escapeHtml(reason)}` : "";
    const message = `${userMention(targetId, targetName)} has been kicked.${reasonText}`;

    await sendLogEntry(ctx, {
      category: "admin",
      action: "kick",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
      targetId: BigInt(targetId),
      targetName,
      details: reason,
    });

    return { success: true, message, targetId: BigInt(targetId), targetName };
  } catch (err) {
    log.error({ err, chatId: ctx.chat!.id, targetId }, "Failed to kick user");
    return { success: false, message: "Failed to kick that user." };
  }
}

/**
 * Unban a user.
 */
export async function unbanUser(
  ctx: BotContext,
  targetId: number,
  targetName: string
): Promise<RestrictionResult> {
  try {
    await ctx.api.unbanChatMember(ctx.chat!.id, targetId, { only_if_banned: true });

    const message = `${userMention(targetId, targetName)} has been unbanned.`;

    await sendLogEntry(ctx, {
      category: "admin",
      action: "unban",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
      targetId: BigInt(targetId),
      targetName,
    });

    return { success: true, message, targetId: BigInt(targetId), targetName };
  } catch (err) {
    log.error({ err, chatId: ctx.chat!.id, targetId }, "Failed to unban user");
    return { success: false, message: "Failed to unban that user." };
  }
}

/**
 * Unmute a user.
 */
export async function unmuteUser(
  ctx: BotContext,
  targetId: number,
  targetName: string
): Promise<RestrictionResult> {
  try {
    await ctx.api.restrictChatMember(ctx.chat!.id, targetId, {
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
    });

    const message = `${userMention(targetId, targetName)} has been unmuted.`;

    await sendLogEntry(ctx, {
      category: "admin",
      action: "unmute",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
      targetId: BigInt(targetId),
      targetName,
    });

    return { success: true, message, targetId: BigInt(targetId), targetName };
  } catch (err) {
    log.error({ err, chatId: ctx.chat!.id, targetId }, "Failed to unmute user");
    return { success: false, message: "Failed to unmute that user." };
  }
}

/**
 * Resolve a target user from the command context and args.
 */
export async function resolveTarget(
  ctx: BotContext,
  args: string
): Promise<{ id: number; name: string } | null> {
  const user = await resolveUser(ctx, args);
  if (!user) return null;
  return { id: Number(user.id), name: user.firstName ?? "User" };
}

/**
 * Get args after the user identifier (for reason/duration parsing).
 */
export function getArgsAfterUser(args: string): string {
  const reply = (args as string) || "";
  // If replying, the entire args is the reason/duration
  // If using @username or ID, skip the first token
  const parts = reply.trim().split(/\s+/);
  if (parts.length === 0) return "";

  const first = parts[0];
  if (first.startsWith("@") || /^\d+$/.test(first)) {
    return parts.slice(1).join(" ");
  }
  return reply.trim();
}
