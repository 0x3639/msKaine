import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml, userMention } from "../../utils/message-builder.js";
import { sendLogEntry } from "../../middleware/log-channel.middleware.js";

const composer = new Composer<BotContext>();

// /reports on|off - Toggle reporting
composer.command("reports", async (ctx) => {
  if (!ctx.permissions.isAdmin) {
    if (ctx.chatSettings?.chat?.adminError) {
      await ctx.reply("You need to be an admin to use this command.");
    }
    return;
  }

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    const current = ctx.chatSettings?.chat?.reportsEnabled ? "enabled" : "disabled";
    await ctx.reply(`Reports are currently <b>${current}</b>.\nUsage: /reports on|off`, { parse_mode: "HTML" });
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { reportsEnabled: arg === "on" },
  });

  await ctx.reply(`Reports ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /report - Report a message to admins
composer.command("report", async (ctx) => {
  await handleReport(ctx);
});

// @admin - Also triggers a report
composer.hears(/@admin/i, async (ctx) => {
  await handleReport(ctx);
});

async function handleReport(ctx: BotContext): Promise<void> {
  if (!ctx.chatSettings?.chat?.reportsEnabled) return;

  // Admins can't report
  if (ctx.permissions.isAdmin) {
    await ctx.reply("Admins can't use the report function.");
    return;
  }

  if (!ctx.message?.reply_to_message) {
    await ctx.reply("Reply to the message you want to report.");
    return;
  }

  const reported = ctx.message.reply_to_message;
  const reporter = ctx.from!;

  // Notify all admins
  try {
    const admins = await ctx.api.getChatAdministrators(ctx.chat!.id);
    const chatTitle = escapeHtml(ctx.chat!.title ?? "the chat");

    const text =
      `<b>Report in ${chatTitle}</b>\n\n` +
      `${userMention(reporter.id, reporter.first_name)} reported a message` +
      (reported.from
        ? ` from ${userMention(reported.from.id, reported.from.first_name)}`
        : "") +
      `.`;

    for (const admin of admins) {
      if (admin.user.is_bot) continue;
      try {
        await ctx.api.sendMessage(admin.user.id, text, { parse_mode: "HTML" });
      } catch {
        // Admin might not have started the bot
      }
    }

    await ctx.reply("Reported! Admins have been notified.", {
      reply_parameters: { message_id: ctx.message!.message_id },
    });

    await sendLogEntry(ctx, {
      category: "reports",
      action: "report",
      actorId: BigInt(reporter.id),
      actorName: reporter.first_name,
      targetId: reported.from ? BigInt(reported.from.id) : undefined,
      targetName: reported.from?.first_name,
    });
  } catch {
    await ctx.reply("Failed to send report.");
  }
}

export default composer;
