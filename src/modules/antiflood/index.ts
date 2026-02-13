import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { getRedis } from "../../core/redis.js";
import { formatDuration, parseDuration } from "../../utils/time-parser.js";
import { sendLogEntry } from "../../middleware/log-channel.middleware.js";

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

// /flood - Show antiflood settings
composer.command("flood", async (ctx) => {
  const settings = ctx.chatSettings?.chat;
  if (!settings) return;

  if (settings.floodLimit <= 0) {
    await ctx.reply("Antiflood is currently disabled.");
    return;
  }

  const window = settings.floodTimer > 0 ? formatDuration(settings.floodTimer) : "5s";
  await ctx.reply(
    `<b>Antiflood settings:</b>\n\n` +
    `Limit: <b>${settings.floodLimit}</b> messages\n` +
    `Window: <b>${window}</b>\n` +
    `Mode: <b>${settings.floodMode.toLowerCase()}</b>\n` +
    `Clear all: <b>${settings.floodClearAll ? "yes" : "no"}</b>`,
    { parse_mode: "HTML" }
  );
});

// /setflood <number|off>
composer.command("setflood", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();

  if (arg === "off" || arg === "0") {
    const db = getDatabase();
    await db.chat.update({
      where: { id: BigInt(ctx.chat!.id) },
      data: { floodLimit: 0 },
    });
    await ctx.reply("Antiflood disabled.");
    return;
  }

  const limit = parseInt(arg, 10);
  if (isNaN(limit) || limit < 2 || limit > 100) {
    await ctx.reply("Usage: /setflood <2-100|off>");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { floodLimit: limit },
  });

  await ctx.reply(`Antiflood set to <b>${limit}</b> messages.`, { parse_mode: "HTML" });

  await sendLogEntry(ctx, {
    category: "settings",
    action: `setflood: ${limit}`,
    actorId: BigInt(ctx.from!.id),
    actorName: ctx.from!.first_name,
  });
});

// /setfloodtimer <duration>
composer.command("setfloodtimer", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim();
  if (!arg) {
    await ctx.reply("Usage: /setfloodtimer <duration> (e.g. 5m, 1h)");
    return;
  }

  const duration = parseDuration(arg);
  if (!duration || duration < 5 || duration > 86400) {
    await ctx.reply("Timer must be between 5s and 1d. Example: /setfloodtimer 10m");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { floodTimer: duration },
  });

  await ctx.reply(`Antiflood window set to <b>${formatDuration(duration)}</b>.`, { parse_mode: "HTML" });
});

// /setfloodmode <mode>
composer.command("setfloodmode", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const mode = (ctx.match as string).trim().toLowerCase();
  const validModes: Record<string, string> = {
    ban: "BAN", mute: "MUTE", kick: "KICK", tban: "TBAN", tmute: "TMUTE",
  };

  if (!validModes[mode]) {
    await ctx.reply("Valid modes: ban, mute, kick, tban, tmute");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { floodMode: validModes[mode] as any },
  });

  await ctx.reply(`Antiflood mode set to <b>${mode}</b>.`, { parse_mode: "HTML" });
});

// /clearflood on|off - Toggle clearing all flood messages
composer.command("clearflood", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /clearflood on|off");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { floodClearAll: arg === "on" },
  });

  await ctx.reply(`Flood message clearing ${arg === "on" ? "enabled" : "disabled"}.`);
});

// Message handler: act on flood detection from middleware
composer.on("message", async (ctx, next) => {
  if (!(ctx as any)._floodTriggered) return next();
  if (!ctx.chatSettings?.loaded || !ctx.from) return next();

  const settings = ctx.chatSettings.chat;
  const userId = ctx.from.id;

  // Apply flood action
  switch (settings.floodMode) {
    case "BAN": {
      const { banUser } = await import("../bans/restriction.service.js");
      await banUser(ctx, { targetId: userId, targetName: ctx.from.first_name, reason: "Flooding" });
      break;
    }
    case "MUTE": {
      const { muteUser } = await import("../bans/restriction.service.js");
      await muteUser(ctx, { targetId: userId, targetName: ctx.from.first_name, reason: "Flooding" });
      break;
    }
    case "KICK": {
      const { kickUser } = await import("../bans/restriction.service.js");
      await kickUser(ctx, { targetId: userId, targetName: ctx.from.first_name, reason: "Flooding" });
      break;
    }
    case "TBAN": {
      const { banUser } = await import("../bans/restriction.service.js");
      await banUser(ctx, { targetId: userId, targetName: ctx.from.first_name, reason: "Flooding", duration: 86400 });
      break;
    }
    case "TMUTE": {
      const { muteUser } = await import("../bans/restriction.service.js");
      await muteUser(ctx, { targetId: userId, targetName: ctx.from.first_name, reason: "Flooding", duration: 86400 });
      break;
    }
  }

  // Clean flood messages if configured
  if (settings.floodClearAll) {
    try {
      const redis = getRedis();
      const key = `flood_msgs:${ctx.chat!.id}:${userId}`;
      const msgIds = await redis.lrange(key, 0, -1);
      await redis.del(key);
      for (const id of msgIds) {
        try { await ctx.api.deleteMessage(ctx.chat!.id, parseInt(id, 10)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  await sendLogEntry(ctx, {
    category: "automated",
    action: `antiflood: ${settings.floodMode.toLowerCase()} (${ctx.from.first_name})`,
    actorId: BigInt(ctx.me.id),
    actorName: ctx.me.first_name,
    targetId: BigInt(userId),
  });

  return; // Stop processing
});

export default composer;
