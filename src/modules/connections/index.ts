import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml } from "../../utils/message-builder.js";

const composer = new Composer<BotContext>();

// /connect <chatId> - Connect to a group from PM
composer.command("connect", async (ctx) => {
  if (ctx.chat!.type !== "private") {
    // In group: show connection info
    await ctx.reply(
      `To connect to this group from PM, use:\n<code>/connect ${ctx.chat!.id}</code>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const chatIdStr = (ctx.match as string).trim();
  if (!chatIdStr) {
    await ctx.reply("Usage: /connect <chat_id>\nGet the chat ID by using /connect in the group.");
    return;
  }

  const targetChatId = BigInt(chatIdStr);

  // Verify user is admin in target chat
  try {
    const member = await ctx.api.getChatMember(Number(targetChatId), ctx.from!.id);
    if (member.status !== "administrator" && member.status !== "creator") {
      await ctx.reply("You need to be an admin in that group to connect.");
      return;
    }
  } catch {
    await ctx.reply("Could not verify your admin status. Make sure the bot is in that group.");
    return;
  }

  // Get chat info
  let chatTitle = "Unknown";
  try {
    const chat = await ctx.api.getChat(Number(targetChatId));
    if ("title" in chat) chatTitle = chat.title ?? "Unknown";
  } catch { /* ignore */ }

  const db = getDatabase();

  // Deactivate existing connections
  await db.connection.updateMany({
    where: { userId: BigInt(ctx.from!.id), isActive: true },
    data: { isActive: false },
  });

  // Create or reactivate connection
  await db.connection.upsert({
    where: { userId_chatId: { userId: BigInt(ctx.from!.id), chatId: targetChatId } },
    create: {
      userId: BigInt(ctx.from!.id),
      chatId: targetChatId,
      isActive: true,
    },
    update: { isActive: true },
  });

  await ctx.reply(
    `Connected to <b>${escapeHtml(chatTitle)}</b>.\nYou can now use admin commands in PM.`,
    { parse_mode: "HTML" }
  );
});

// /disconnect - Disconnect from current group
composer.command("disconnect", async (ctx) => {
  if (ctx.chat!.type !== "private") {
    await ctx.reply("Use this command in PM to disconnect.");
    return;
  }

  const db = getDatabase();
  const result = await db.connection.updateMany({
    where: { userId: BigInt(ctx.from!.id), isActive: true },
    data: { isActive: false },
  });

  if (result.count > 0) {
    await ctx.reply("Disconnected from group.");
  } else {
    await ctx.reply("You're not connected to any group.");
  }
});

// /connection - Show active connection
composer.command("connection", async (ctx) => {
  if (ctx.chat!.type !== "private") {
    await ctx.reply("Use this command in PM.");
    return;
  }

  const db = getDatabase();
  const conn = await db.connection.findFirst({
    where: { userId: BigInt(ctx.from!.id), isActive: true },
    include: { chat: { select: { title: true } } },
  });

  if (!conn) {
    await ctx.reply("You're not connected to any group.\nUse /connect <chat_id> to connect.");
    return;
  }

  await ctx.reply(
    `Connected to: <b>${escapeHtml(conn.chat.title ?? "Unknown")}</b>\n` +
    `Chat ID: <code>${conn.chatId}</code>`,
    { parse_mode: "HTML" }
  );
});

// /reconnect - Reconnect to last used group
composer.command("reconnect", async (ctx) => {
  if (ctx.chat!.type !== "private") {
    await ctx.reply("Use this command in PM.");
    return;
  }

  const db = getDatabase();

  // Find most recent connection
  const lastConn = await db.connection.findFirst({
    where: { userId: BigInt(ctx.from!.id) },
    orderBy: { connectedAt: "desc" },
    include: { chat: { select: { title: true } } },
  });

  if (!lastConn) {
    await ctx.reply("No previous connections found.");
    return;
  }

  // Deactivate all
  await db.connection.updateMany({
    where: { userId: BigInt(ctx.from!.id), isActive: true },
    data: { isActive: false },
  });

  // Reactivate
  await db.connection.update({
    where: { id: lastConn.id },
    data: { isActive: true },
  });

  await ctx.reply(
    `Reconnected to <b>${escapeHtml(lastConn.chat.title ?? "Unknown")}</b>.`,
    { parse_mode: "HTML" }
  );
});

export default composer;
