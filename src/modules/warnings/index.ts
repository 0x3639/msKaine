import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { addWarning, removeLastWarning, resetWarnings, getWarnings } from "./warning.service.js";
import { resolveTarget, getArgsAfterUser } from "../bans/restriction.service.js";
import { userMention, escapeHtml } from "../../utils/message-builder.js";
import { sendLogEntry } from "../../middleware/log-channel.middleware.js";
import { formatDuration, parseDuration } from "../../utils/time-parser.js";

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

// /warn - Issue a warning
composer.command("warn", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to warn (reply or provide username/ID).");
    return;
  }

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);
  const reason = afterUser || undefined;

  const result = await addWarning(
    ctx,
    BigInt(target.id),
    BigInt(ctx.from!.id),
    reason
  );

  let text = `${userMention(target.id, target.name)} has been warned (${result.count}/${result.limit}).`;
  if (reason) text += `\nReason: ${escapeHtml(reason)}`;
  if (result.actionTriggered) {
    text += `\n\n⚠️ Warning limit reached! User has been ${result.actionText}.`;
  }

  await sendLogEntry(ctx, {
    category: "admin",
    action: "warn",
    actorId: BigInt(ctx.from!.id),
    actorName: ctx.from!.first_name,
    targetId: BigInt(target.id),
    targetName: target.name,
    details: reason,
  });

  if (!ctx.isSilent) {
    await ctx.reply(text, { parse_mode: "HTML" });
  }
});

// /dwarn - Warn and delete message (reply only)
composer.command("dwarn", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  if (!ctx.message?.reply_to_message?.from) {
    await ctx.reply("Reply to a user's message to use /dwarn.");
    return;
  }

  const target = {
    id: ctx.message.reply_to_message.from.id,
    name: ctx.message.reply_to_message.from.first_name,
  };
  const reason = (ctx.match as string) || undefined;

  // Delete the target message
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.reply_to_message.message_id);
  } catch { /* ignore */ }

  const result = await addWarning(
    ctx,
    BigInt(target.id),
    BigInt(ctx.from!.id),
    reason
  );

  let text = `${userMention(target.id, target.name)} has been warned (${result.count}/${result.limit}).`;
  if (reason) text += `\nReason: ${escapeHtml(reason)}`;
  if (result.actionTriggered) {
    text += `\n\n⚠️ Warning limit reached! User has been ${result.actionText}.`;
  }

  try { await ctx.deleteMessage(); } catch { /* ignore */ }
  await ctx.reply(text, { parse_mode: "HTML" });
});

// /swarn - Silent warning
composer.command("swarn", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) return;

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);

  // Delete target's message if replying
  if (ctx.message?.reply_to_message) {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.reply_to_message.message_id);
    } catch { /* ignore */ }
  }

  await addWarning(ctx, BigInt(target.id), BigInt(ctx.from!.id), afterUser || undefined);

  try { await ctx.deleteMessage(); } catch { /* ignore */ }
});

// /rmwarn - Remove the most recent warning
composer.command("rmwarn", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user (reply or provide username/ID).");
    return;
  }

  const removed = await removeLastWarning(BigInt(ctx.chat!.id), BigInt(target.id));
  if (removed) {
    await ctx.reply(`Removed the last warning for ${userMention(target.id, target.name)}.`, { parse_mode: "HTML" });
  } else {
    await ctx.reply("This user has no warnings.");
  }
});

// /resetwarn - Clear all warnings for a user
composer.command("resetwarn", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user (reply or provide username/ID).");
    return;
  }

  const count = await resetWarnings(BigInt(ctx.chat!.id), BigInt(target.id));
  await ctx.reply(
    `Reset ${count} warning(s) for ${userMention(target.id, target.name)}.`,
    { parse_mode: "HTML" }
  );
});

// /warns - View a user's warnings
composer.command("warns", async (ctx) => {
  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user (reply or provide username/ID).");
    return;
  }

  const warnings = await getWarnings(BigInt(ctx.chat!.id), BigInt(target.id));
  const limit = ctx.chatSettings?.chat?.warnLimit ?? 3;

  if (warnings.length === 0) {
    await ctx.reply(`${userMention(target.id, target.name)} has no warnings.`, { parse_mode: "HTML" });
    return;
  }

  let text = `${userMention(target.id, target.name)} has ${warnings.length}/${limit} warnings:\n\n`;
  warnings.forEach((w, i) => {
    text += `${i + 1}. ${w.reason ? escapeHtml(w.reason) : "No reason"}\n`;
  });

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /warnings - View warning configuration
composer.command("warnings", async (ctx) => {
  if (!ctx.chatSettings?.loaded) return;

  const { warnLimit, warnMode, warnTime } = ctx.chatSettings.chat;
  const modeText = warnMode.toLowerCase();
  const timeText = warnTime ? formatDuration(warnTime) : "never";

  let text = `<b>Warning Settings</b>\n\n`;
  text += `Warning limit: <b>${warnLimit}</b>\n`;
  text += `Action at limit: <b>${modeText}</b>\n`;
  text += `Warnings expire: <b>${timeText}</b>`;

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /setwarnlimit - Set max warnings
composer.command("setwarnlimit", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const num = parseInt(ctx.match as string, 10);
  if (isNaN(num) || num < 1 || num > 999) {
    await ctx.reply("Please provide a number between 1 and 999.");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { warnLimit: num },
  });

  await ctx.reply(`Warning limit set to <b>${num}</b>.`, { parse_mode: "HTML" });
});

// /setwarnmode - Set punishment action
composer.command("setwarnmode", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const mode = (ctx.match as string).trim().toLowerCase();
  const validModes: Record<string, string> = {
    ban: "BAN",
    mute: "MUTE",
    kick: "KICK",
    tban: "TBAN",
    tmute: "TMUTE",
  };

  if (!validModes[mode]) {
    await ctx.reply("Valid modes: ban, mute, kick, tban, tmute");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { warnMode: validModes[mode] as any },
  });

  await ctx.reply(`Warning mode set to <b>${mode}</b>.`, { parse_mode: "HTML" });
});

// /setwarntime - Set warning expiry
composer.command("setwarntime", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();

  if (arg === "off" || arg === "0") {
    const db = getDatabase();
    await db.chat.update({
      where: { id: BigInt(ctx.chat!.id) },
      data: { warnTime: null },
    });
    await ctx.reply("Warning expiry disabled. Warnings will not expire.");
    return;
  }

  const seconds = parseDuration(arg);
  if (!seconds) {
    await ctx.reply("Invalid time format. Use: Xm, Xh, Xd, Xw. Use 'off' to disable.");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { warnTime: seconds },
  });

  await ctx.reply(
    `Warnings will now expire after <b>${formatDuration(seconds)}</b>.`,
    { parse_mode: "HTML" }
  );
});

export default composer;
