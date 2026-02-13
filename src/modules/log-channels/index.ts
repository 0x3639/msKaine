import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { LOG_CATEGORIES } from "../../utils/constants.js";

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

// /setlog - Set the log channel (send in channel, forward to group)
composer.command("setlog", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  // If used in a channel-like context, store the channel ID
  // The typical flow: send /setlog in the channel, then forward to the group
  // For simplicity, we accept a channel ID or use the current chat as the log target

  const args = (ctx.match as string).trim();

  if (args) {
    // Direct channel ID provided
    let channelId: number;
    if (args.startsWith("@")) {
      try {
        const chat = await ctx.api.getChat(args);
        channelId = chat.id;
      } catch {
        await ctx.reply("I can't find that channel. Make sure I'm an admin there.");
        return;
      }
    } else {
      channelId = parseInt(args, 10);
      if (isNaN(channelId)) {
        await ctx.reply("Please provide a valid channel ID or @username.");
        return;
      }
    }

    const db = getDatabase();
    await db.chat.update({
      where: { id: BigInt(ctx.chat!.id) },
      data: { logChannelId: BigInt(channelId) },
    });

    await ctx.reply(`Log channel set! Actions will be logged there.`);
    return;
  }

  // Check if this is a forwarded message from a channel
  if (ctx.message?.forward_origin && "chat" in ctx.message.forward_origin) {
    const channelId = (ctx.message.forward_origin as any).chat.id;
    const db = getDatabase();
    await db.chat.update({
      where: { id: BigInt(ctx.chat!.id) },
      data: { logChannelId: BigInt(channelId) },
    });
    await ctx.reply(`Log channel set to the forwarded channel.`);
    return;
  }

  await ctx.reply(
    "To set a log channel:\n" +
    "1. Add me to your log channel as admin\n" +
    "2. Send /setlog in the channel\n" +
    "3. Forward that message to this group\n\n" +
    "Or use: /setlog @channelname or /setlog <channel_id>"
  );
});

// /unsetlog - Disable logging
composer.command("unsetlog", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { logChannelId: null },
  });

  await ctx.reply("Logging has been disabled for this group.");
});

// /logchannel - Check current log channel
composer.command("logchannel", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const logChannelId = ctx.chatSettings?.chat?.logChannelId;
  if (!logChannelId) {
    await ctx.reply("No log channel is currently set for this group.");
    return;
  }

  try {
    const channel = await ctx.api.getChat(Number(logChannelId));
    const title = "title" in channel ? channel.title : "Unknown";
    await ctx.reply(`This group is currently being logged to: <b>${title}</b>`, { parse_mode: "HTML" });
  } catch {
    await ctx.reply(`Log channel is set (ID: <code>${logChannelId}</code>), but I can't access it.`, { parse_mode: "HTML" });
  }
});

// /logcategories - List available categories
composer.command("logcategories", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const current = ctx.chatSettings?.chat?.logCategories ?? [];
  let text = `<b>Available log categories:</b>\n\n`;

  for (const cat of LOG_CATEGORIES) {
    const enabled = current.length === 0 || current.includes(cat);
    text += `${enabled ? "✅" : "❌"} <code>${cat}</code>\n`;
  }

  text += `\nUse /log <category> to enable, /nolog <category> to disable.`;
  if (current.length === 0) {
    text += `\n\n<i>All categories are currently enabled (default).</i>`;
  }

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /log <categories> - Enable log categories
composer.command("log", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = (ctx.match as string).trim().toLowerCase().split(/\s+/);
  if (args.length === 0 || !args[0]) {
    await ctx.reply("Usage: /log <category> [category2] ...\nSee /logcategories for available types.");
    return;
  }

  const valid = args.filter((a): a is string => LOG_CATEGORIES.includes(a as any));
  if (valid.length === 0) {
    await ctx.reply(`Invalid categories. Available: ${LOG_CATEGORIES.join(", ")}`);
    return;
  }

  const db = getDatabase();
  const current = ctx.chatSettings?.chat?.logCategories ?? [];
  const updated = [...new Set([...current, ...valid])];

  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { logCategories: updated },
  });

  await ctx.reply(`Enabled log categories: ${valid.join(", ")}`);
});

// /nolog <categories> - Disable log categories
composer.command("nolog", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = (ctx.match as string).trim().toLowerCase().split(/\s+/);
  if (args.length === 0 || !args[0]) {
    await ctx.reply("Usage: /nolog <category> [category2] ...");
    return;
  }

  const db = getDatabase();
  const current = ctx.chatSettings?.chat?.logCategories ?? [];

  // If no categories were explicitly set, start with all
  const base = current.length === 0 ? [...LOG_CATEGORIES] : [...current];
  const updated = base.filter((c) => !args.includes(c));

  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { logCategories: updated },
  });

  await ctx.reply(`Disabled log categories: ${args.join(", ")}`);
});

export default composer;
