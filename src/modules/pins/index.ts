import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
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

// /pin [loud] - Pin a message
composer.command("pin", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  if (!ctx.message?.reply_to_message) {
    await ctx.reply("Reply to a message to pin it.");
    return;
  }

  const loud = (ctx.match as string).trim().toLowerCase() === "loud";

  try {
    await ctx.api.pinChatMessage(
      ctx.chat!.id,
      ctx.message.reply_to_message.message_id,
      { disable_notification: !loud }
    );

    await sendLogEntry(ctx, {
      category: "admin",
      action: loud ? "pin (loud)" : "pin",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
    });
  } catch {
    await ctx.reply("Failed to pin that message. Do I have pin permissions?");
  }
});

// /permapin <message> - Pin a new message
composer.command("permapin", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const text = (ctx.match as string).trim();
  if (!text) {
    await ctx.reply("Usage: /permapin <message to pin>");
    return;
  }

  try {
    const msg = await ctx.reply(text, { parse_mode: "HTML" });
    await ctx.api.pinChatMessage(ctx.chat!.id, msg.message_id, {
      disable_notification: true,
    });
  } catch {
    await ctx.reply("Failed to send and pin the message.");
  }
});

// /unpin - Unpin the most recent pin
composer.command("unpin", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  try {
    await ctx.api.unpinChatMessage(ctx.chat!.id);
    await ctx.reply("Unpinned the most recent message.");

    await sendLogEntry(ctx, {
      category: "admin",
      action: "unpin",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
    });
  } catch {
    await ctx.reply("Failed to unpin. Do I have the right permissions?");
  }
});

// /unpinall - Unpin all messages
composer.command("unpinall", async (ctx) => {
  if (!ctx.permissions.isCreator) {
    await ctx.reply("Only the group creator can unpin all messages.");
    return;
  }

  try {
    await ctx.api.unpinAllChatMessages(ctx.chat!.id);
    await ctx.reply("All pinned messages have been unpinned.");

    await sendLogEntry(ctx, {
      category: "admin",
      action: "unpinall",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
    });
  } catch {
    await ctx.reply("Failed to unpin all messages.");
  }
});

// /antichannelpin on|off - Toggle auto-pin of linked channel posts
composer.command("antichannelpin", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    const current = ctx.chatSettings?.chat?.antiChannelPin ? "enabled" : "disabled";
    await ctx.reply(
      `Anti-channel pin is currently <b>${current}</b>.\n` +
      `When enabled, auto-pins from linked channels are unpinned.\n` +
      `Usage: /antichannelpin on|off`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { antiChannelPin: arg === "on" },
  });

  await ctx.reply(`Anti-channel pin ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /cleanlinked on|off - Toggle deletion of linked channel messages
composer.command("cleanlinked", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    const current = ctx.chatSettings?.chat?.cleanLinked ? "enabled" : "disabled";
    await ctx.reply(
      `Clean linked is currently <b>${current}</b>.\n` +
      `When enabled, messages from linked channels are automatically deleted.\n` +
      `Usage: /cleanlinked on|off`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { cleanLinked: arg === "on" },
  });

  await ctx.reply(`Clean linked ${arg === "on" ? "enabled" : "disabled"}.`);
});

// Handle anti-channel-pin and clean-linked events
composer.on("message:pinned_message", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded) return next();

  // Anti-channel pin: unpin automatic channel pins
  if (ctx.chatSettings.chat.antiChannelPin) {
    const pinned = ctx.message?.pinned_message;
    if (pinned?.sender_chat && pinned.sender_chat.id !== ctx.chat!.id) {
      try {
        await ctx.api.unpinChatMessage(ctx.chat!.id, pinned.message_id);
      } catch { /* ignore */ }
    }
  }

  return next();
});

// Handle clean linked channel messages
composer.on("message", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded) return next();

  if (ctx.chatSettings.chat.cleanLinked && ctx.message?.sender_chat) {
    // Check if sender is a linked channel (not the group itself)
    if (ctx.message.sender_chat.id !== ctx.chat!.id) {
      try {
        await ctx.deleteMessage();
      } catch { /* ignore */ }
      return; // Don't process further
    }
  }

  return next();
});

export default composer;
