import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { botCanDelete } from "../../utils/permissions.js";
import { sendLogEntry } from "../../middleware/log-channel.middleware.js";
const composer = new Composer<BotContext>();

// Store purgefrom message IDs per chat
const purgeFromStore = new Map<number, number>();

function requireAdmin(ctx: BotContext): boolean {
  if (!ctx.permissions.isAdmin) {
    if (ctx.chatSettings?.chat?.adminError) {
      ctx.reply("You need to be an admin to use this command.").catch(() => {});
    }
    return false;
  }
  return true;
}

// /del - Delete a single message (reply to it)
composer.command("del", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  if (!ctx.message?.reply_to_message) {
    await ctx.reply("Reply to a message to delete it.");
    return;
  }

  try {
    await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.reply_to_message.message_id);
    await ctx.deleteMessage();
  } catch {
    await ctx.reply("Failed to delete that message. Do I have delete permissions?");
  }
});

// /purge [count] - Delete messages from reply to now
composer.command("purge", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  if (!ctx.message?.reply_to_message) {
    await ctx.reply("Reply to a message to start purging from that point.");
    return;
  }

  if (!(await botCanDelete(ctx))) {
    await ctx.reply("I need delete permissions to purge messages.");
    return;
  }

  const fromId = ctx.message.reply_to_message.message_id;
  const toId = ctx.message.message_id;
  const countArg = parseInt(ctx.match as string, 10);
  const maxCount = !isNaN(countArg) && countArg > 0 ? countArg : toId - fromId + 1;

  let deleted = 0;
  const messageIds: number[] = [];

  for (let id = fromId; id <= toId && deleted < maxCount; id++) {
    messageIds.push(id);
    deleted++;

    // Telegram allows deleting up to 100 messages at once
    if (messageIds.length >= 100) {
      try {
        await ctx.api.raw.deleteMessages({ chat_id: ctx.chat!.id, message_ids: messageIds });
      } catch {
        // Try one by one for any that failed
        for (const mid of messageIds) {
          try { await ctx.api.deleteMessage(ctx.chat!.id, mid); } catch { /* skip */ }
        }
      }
      messageIds.length = 0;
    }
  }

  // Delete remaining batch
  if (messageIds.length > 0) {
    try {
      await ctx.api.raw.deleteMessages({ chat_id: ctx.chat!.id, message_ids: messageIds });
    } catch {
      for (const mid of messageIds) {
        try { await ctx.api.deleteMessage(ctx.chat!.id, mid); } catch { /* skip */ }
      }
    }
  }

  const confirmMsg = await ctx.reply(`Purged ${deleted} messages.`);

  // Auto-delete confirmation after 3 seconds
  setTimeout(async () => {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, confirmMsg.message_id);
    } catch { /* ignore */ }
  }, 3000);

  await sendLogEntry(ctx, {
    category: "admin",
    action: `purge (${deleted} messages)`,
    actorId: BigInt(ctx.from!.id),
    actorName: ctx.from!.first_name,
  });
});

// /spurge [count] - Silent purge (no confirmation message)
composer.command("spurge", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  if (!ctx.message?.reply_to_message) {
    await ctx.reply("Reply to a message to start purging from that point.");
    return;
  }

  if (!(await botCanDelete(ctx))) {
    await ctx.reply("I need delete permissions to purge messages.");
    return;
  }

  const fromId = ctx.message.reply_to_message.message_id;
  const toId = ctx.message.message_id;
  const countArg = parseInt(ctx.match as string, 10);
  const maxCount = !isNaN(countArg) && countArg > 0 ? countArg : toId - fromId + 1;

  const messageIds: number[] = [];
  let deleted = 0;

  for (let id = fromId; id <= toId && deleted < maxCount; id++) {
    messageIds.push(id);
    deleted++;

    if (messageIds.length >= 100) {
      try {
        await ctx.api.raw.deleteMessages({ chat_id: ctx.chat!.id, message_ids: messageIds });
      } catch {
        for (const mid of messageIds) {
          try { await ctx.api.deleteMessage(ctx.chat!.id, mid); } catch { /* skip */ }
        }
      }
      messageIds.length = 0;
    }
  }

  if (messageIds.length > 0) {
    try {
      await ctx.api.raw.deleteMessages({ chat_id: ctx.chat!.id, message_ids: messageIds });
    } catch {
      for (const mid of messageIds) {
        try { await ctx.api.deleteMessage(ctx.chat!.id, mid); } catch { /* skip */ }
      }
    }
  }
});

// /purgefrom - Mark the start of a range purge
composer.command("purgefrom", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  if (!ctx.message?.reply_to_message) {
    await ctx.reply("Reply to the oldest message you want to delete.");
    return;
  }

  purgeFromStore.set(ctx.chat!.id, ctx.message.reply_to_message.message_id);
  await ctx.reply("Start point set. Now reply to the newest message and use /purgeto.");
  try { await ctx.deleteMessage(); } catch { /* ignore */ }
});

// /purgeto - Mark the end and execute range purge
composer.command("purgeto", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  if (!ctx.message?.reply_to_message) {
    await ctx.reply("Reply to the newest message you want to delete.");
    return;
  }

  const fromId = purgeFromStore.get(ctx.chat!.id);
  if (!fromId) {
    await ctx.reply("Use /purgefrom first to set the start point.");
    return;
  }

  if (!(await botCanDelete(ctx))) {
    await ctx.reply("I need delete permissions to purge messages.");
    return;
  }

  const toId = ctx.message.reply_to_message.message_id;
  purgeFromStore.delete(ctx.chat!.id);

  const start = Math.min(fromId, toId);
  const end = Math.max(fromId, toId);

  const messageIds: number[] = [];
  let deleted = 0;

  for (let id = start; id <= end; id++) {
    messageIds.push(id);
    deleted++;

    if (messageIds.length >= 100) {
      try {
        await ctx.api.raw.deleteMessages({ chat_id: ctx.chat!.id, message_ids: messageIds });
      } catch {
        for (const mid of messageIds) {
          try { await ctx.api.deleteMessage(ctx.chat!.id, mid); } catch { /* skip */ }
        }
      }
      messageIds.length = 0;
    }
  }

  if (messageIds.length > 0) {
    try {
      await ctx.api.raw.deleteMessages({ chat_id: ctx.chat!.id, message_ids: messageIds });
    } catch {
      for (const mid of messageIds) {
        try { await ctx.api.deleteMessage(ctx.chat!.id, mid); } catch { /* skip */ }
      }
    }
  }

  // Delete the command messages
  try { await ctx.deleteMessage(); } catch { /* ignore */ }

  const confirmMsg = await ctx.reply(`Purged ${deleted} messages.`);
  setTimeout(async () => {
    try { await ctx.api.deleteMessage(ctx.chat!.id, confirmMsg.message_id); } catch { /* ignore */ }
  }, 3000);
});

export default composer;
