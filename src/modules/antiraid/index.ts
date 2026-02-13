import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { getRedis } from "../../core/redis.js";
import { parseDuration, formatDuration } from "../../utils/time-parser.js";
import { sendLogEntry } from "../../middleware/log-channel.middleware.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("antiraid");

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

// /antiraid on|off
composer.command("antiraid", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();

  if (!arg || (arg !== "on" && arg !== "off")) {
    const settings = ctx.chatSettings?.chat;
    const active = settings?.antiraidEnabled && settings?.antiraidExpiresAt && new Date(settings.antiraidExpiresAt) > new Date();
    await ctx.reply(
      `<b>Antiraid settings:</b>\n\n` +
      `Status: <b>${active ? "active" : "inactive"}</b>\n` +
      `Raid time: <b>${formatDuration(settings?.raidTime ?? 21600)}</b>\n` +
      `Action time: <b>${formatDuration(settings?.raidActionTime ?? 3600)}</b>\n` +
      `Auto-antiraid: <b>${(settings?.autoAntiraidLimit ?? 0) > 0 ? `${settings!.autoAntiraidLimit} joins` : "disabled"}</b>\n\n` +
      `Usage: /antiraid on|off`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);

  if (arg === "on") {
    const raidTime = ctx.chatSettings!.chat.raidTime;
    const expiresAt = new Date(Date.now() + raidTime * 1000);

    await db.chat.update({
      where: { id: chatId },
      data: { antiraidEnabled: true, antiraidExpiresAt: expiresAt },
    });

    await ctx.reply(
      `Antiraid mode <b>enabled</b> for ${formatDuration(raidTime)}.\n` +
      `New members will be kicked during this period.`,
      { parse_mode: "HTML" }
    );

    // Schedule auto-disable
    await db.scheduledAction.create({
      data: {
        chatId,
        actionType: "antiraid_disable",
        executeAt: expiresAt,
      },
    });

    await sendLogEntry(ctx, {
      category: "settings",
      action: "antiraid enabled",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
    });
  } else {
    await db.chat.update({
      where: { id: chatId },
      data: { antiraidEnabled: false, antiraidExpiresAt: null },
    });

    await ctx.reply("Antiraid mode <b>disabled</b>.", { parse_mode: "HTML" });
  }
});

// /raidtime <duration>
composer.command("raidtime", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim();
  if (!arg) {
    await ctx.reply("Usage: /raidtime <duration> (e.g. 6h, 1d)");
    return;
  }

  const duration = parseDuration(arg);
  if (!duration || duration < 300 || duration > 604800) {
    await ctx.reply("Duration must be between 5m and 7d.");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { raidTime: duration },
  });

  await ctx.reply(`Antiraid duration set to <b>${formatDuration(duration)}</b>.`, { parse_mode: "HTML" });
});

// /raidactiontime <duration>
composer.command("raidactiontime", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim();
  if (!arg) {
    await ctx.reply("Usage: /raidactiontime <duration> (e.g. 1h, 30m)");
    return;
  }

  const duration = parseDuration(arg);
  if (!duration || duration < 60 || duration > 86400) {
    await ctx.reply("Duration must be between 1m and 1d.");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { raidActionTime: duration },
  });

  await ctx.reply(`Raid action time set to <b>${formatDuration(duration)}</b>.`, { parse_mode: "HTML" });
});

// /autoantiraid <number|off>
composer.command("autoantiraid", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();

  if (arg === "off" || arg === "0") {
    const db = getDatabase();
    await db.chat.update({
      where: { id: BigInt(ctx.chat!.id) },
      data: { autoAntiraidLimit: 0 },
    });
    await ctx.reply("Auto-antiraid disabled.");
    return;
  }

  const limit = parseInt(arg, 10);
  if (isNaN(limit) || limit < 2 || limit > 100) {
    await ctx.reply("Usage: /autoantiraid <2-100|off>\nAutomatically enables antiraid when this many users join within 1 minute.");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { autoAntiraidLimit: limit },
  });

  await ctx.reply(
    `Auto-antiraid set to <b>${limit}</b> joins per minute.`,
    { parse_mode: "HTML" }
  );
});

// Handle new chat members during antiraid
composer.on("chat_member", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded) return next();

  const update = ctx.chatMember;
  if (!update) return next();

  const oldStatus = update.old_chat_member.status;
  const newStatus = update.new_chat_member.status;

  // Only trigger on new joins
  if (
    !(
      (oldStatus === "left" || oldStatus === "kicked") &&
      (newStatus === "member" || newStatus === "restricted")
    )
  ) {
    return next();
  }

  const user = update.new_chat_member.user;
  if (user.is_bot) return next();

  const chatId = BigInt(ctx.chat!.id);
  const settings = ctx.chatSettings.chat;

  // Auto-antiraid: track join velocity
  if (settings.autoAntiraidLimit > 0 && !settings.antiraidEnabled) {
    try {
      const redis = getRedis();
      const key = `raid_joins:${ctx.chat!.id}`;
      const now = Date.now();
      await redis.multi()
        .zadd(key, now, `${user.id}:${now}`)
        .zremrangebyscore(key, 0, now - 60000) // 1 minute window
        .expire(key, 120)
        .exec();

      const joinCount = await redis.zcard(key);
      if (joinCount >= settings.autoAntiraidLimit) {
        // Auto-enable antiraid
        const db = getDatabase();
        const expiresAt = new Date(Date.now() + settings.raidTime * 1000);
        await db.chat.update({
          where: { id: chatId },
          data: { antiraidEnabled: true, antiraidExpiresAt: expiresAt },
        });

        await db.scheduledAction.create({
          data: {
            chatId,
            actionType: "antiraid_disable",
            executeAt: expiresAt,
          },
        });

        await ctx.api.sendMessage(
          ctx.chat!.id,
          `Raid detected! Antiraid mode automatically enabled for ${formatDuration(settings.raidTime)}.`
        );

        log.info({ chatId: ctx.chat!.id, joinCount }, "Auto-antiraid triggered");
      }
    } catch (err) {
      log.error({ err }, "Auto-antiraid check failed");
    }
  }

  // If antiraid is active, kick the new member
  if (settings.antiraidEnabled) {
    const expiresAt = settings.antiraidExpiresAt;
    if (expiresAt && new Date(expiresAt) > new Date()) {
      try {
        await ctx.api.banChatMember(ctx.chat!.id, user.id);
        // Immediately unban so they can rejoin later
        await ctx.api.unbanChatMember(ctx.chat!.id, user.id, { only_if_banned: true });

        log.info({ chatId: ctx.chat!.id, userId: user.id }, "Kicked user during antiraid");
      } catch (err) {
        log.warn({ err, userId: user.id }, "Failed to kick during antiraid");
      }
    }
  }

  return next();
});

export default composer;
