import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import {
  banUser,
  muteUser,
  kickUser,
  unbanUser,
  unmuteUser,
  resolveTarget,
  getArgsAfterUser,
} from "./restriction.service.js";
import { parseDuration } from "../../utils/time-parser.js";
import { extractDurationAndReason } from "../../utils/user-resolver.js";

const composer = new Composer<BotContext>();

function requireAdmin(ctx: BotContext): boolean {
  if (!ctx.permissions.isAdmin) {
    if (ctx.chatSettings?.chat?.adminError) {
      ctx.reply("You need to be an admin to use this command.").catch(() => {});
    }
    return false;
  }
  return true;
}

// === BAN COMMANDS ===

// /ban - Permanently ban a user
composer.command("ban", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to ban (reply or provide username/ID).");
    return;
  }

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);
  const reason = afterUser || undefined;

  const result = await banUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason,
  });

  if (!ctx.isSilent) {
    await ctx.reply(result.message, { parse_mode: "HTML" });
  }
});

// /tban - Temporary ban
composer.command("tban", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to ban (reply or provide username/ID).");
    return;
  }

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);
  const { durationStr, reason } = extractDurationAndReason(afterUser);

  if (!durationStr) {
    await ctx.reply("Please specify a duration. Example: /tban @user 1d reason");
    return;
  }

  const duration = parseDuration(durationStr);
  if (!duration) {
    await ctx.reply("Invalid duration format. Use: Xm, Xh, Xd, Xw (e.g., 1d, 2h, 30m)");
    return;
  }

  const result = await banUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason,
    duration,
  });

  if (!ctx.isSilent) {
    await ctx.reply(result.message, { parse_mode: "HTML" });
  }
});

// /dban - Delete message and ban (reply only)
composer.command("dban", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  if (!ctx.message?.reply_to_message?.from) {
    await ctx.reply("Reply to a user's message to use /dban.");
    return;
  }

  const target = {
    id: ctx.message.reply_to_message.from.id,
    name: ctx.message.reply_to_message.from.first_name,
  };
  const reason = (ctx.match as string) || undefined;

  const result = await banUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason,
    deleteMessage: true,
  });

  // Delete the command message too
  try { await ctx.deleteMessage(); } catch { /* ignore */ }

  if (!ctx.isSilent) {
    await ctx.reply(result.message, { parse_mode: "HTML" });
  }
});

// /sban - Silent ban
composer.command("sban", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) return;

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);

  // Parse potential duration for silent tban
  const { durationStr, reason } = extractDurationAndReason(afterUser);
  const duration = durationStr ? parseDuration(durationStr) ?? undefined : undefined;

  await banUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason,
    duration,
    silent: true,
  });

  // Delete the command message
  try { await ctx.deleteMessage(); } catch { /* ignore */ }
});

// /unban - Remove a ban
composer.command("unban", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to unban (reply or provide username/ID).");
    return;
  }

  const result = await unbanUser(ctx, target.id, target.name);
  await ctx.reply(result.message, { parse_mode: "HTML" });
});

// === MUTE COMMANDS ===

// /mute - Permanently mute a user
composer.command("mute", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to mute (reply or provide username/ID).");
    return;
  }

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);
  const reason = afterUser || undefined;

  const result = await muteUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason,
  });

  if (!ctx.isSilent) {
    await ctx.reply(result.message, { parse_mode: "HTML" });
  }
});

// /tmute - Temporary mute
composer.command("tmute", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to mute (reply or provide username/ID).");
    return;
  }

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);
  const { durationStr, reason } = extractDurationAndReason(afterUser);

  if (!durationStr) {
    await ctx.reply("Please specify a duration. Example: /tmute @user 1d reason");
    return;
  }

  const duration = parseDuration(durationStr);
  if (!duration) {
    await ctx.reply("Invalid duration format. Use: Xm, Xh, Xd, Xw (e.g., 1d, 2h, 30m)");
    return;
  }

  const result = await muteUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason,
    duration,
  });

  if (!ctx.isSilent) {
    await ctx.reply(result.message, { parse_mode: "HTML" });
  }
});

// /dmute - Delete message and mute (reply only)
composer.command("dmute", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  if (!ctx.message?.reply_to_message?.from) {
    await ctx.reply("Reply to a user's message to use /dmute.");
    return;
  }

  const target = {
    id: ctx.message.reply_to_message.from.id,
    name: ctx.message.reply_to_message.from.first_name,
  };
  const reason = (ctx.match as string) || undefined;

  const result = await muteUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason,
    deleteMessage: true,
  });

  try { await ctx.deleteMessage(); } catch { /* ignore */ }

  if (!ctx.isSilent) {
    await ctx.reply(result.message, { parse_mode: "HTML" });
  }
});

// /smute - Silent mute
composer.command("smute", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) return;

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);
  const { durationStr, reason } = extractDurationAndReason(afterUser);
  const duration = durationStr ? parseDuration(durationStr) ?? undefined : undefined;

  await muteUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason,
    duration,
    silent: true,
  });

  try { await ctx.deleteMessage(); } catch { /* ignore */ }
});

// /unmute - Remove a mute
composer.command("unmute", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to unmute (reply or provide username/ID).");
    return;
  }

  const result = await unmuteUser(ctx, target.id, target.name);
  await ctx.reply(result.message, { parse_mode: "HTML" });
});

// === KICK COMMANDS ===

// /kick - Kick a user
composer.command("kick", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to kick (reply or provide username/ID).");
    return;
  }

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);
  const reason = afterUser || undefined;

  const result = await kickUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason,
  });

  if (!ctx.isSilent) {
    await ctx.reply(result.message, { parse_mode: "HTML" });
  }
});

// /dkick - Delete message and kick (reply only)
composer.command("dkick", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  if (!ctx.message?.reply_to_message?.from) {
    await ctx.reply("Reply to a user's message to use /dkick.");
    return;
  }

  const target = {
    id: ctx.message.reply_to_message.from.id,
    name: ctx.message.reply_to_message.from.first_name,
  };
  const reason = (ctx.match as string) || undefined;

  const result = await kickUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason,
    deleteMessage: true,
  });

  try { await ctx.deleteMessage(); } catch { /* ignore */ }

  if (!ctx.isSilent) {
    await ctx.reply(result.message, { parse_mode: "HTML" });
  }
});

// /skick - Silent kick
composer.command("skick", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) return;

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);

  await kickUser(ctx, {
    targetId: target.id,
    targetName: target.name,
    reason: afterUser || undefined,
    silent: true,
  });

  try { await ctx.deleteMessage(); } catch { /* ignore */ }
});

export default composer;
