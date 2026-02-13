import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { CLEAN_COMMAND_TYPES, CLEAN_MSG_TYPES, CLEAN_SERVICE_TYPES } from "../../utils/constants.js";

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

// /cleancommand <type> - Enable auto-delete for command types
composer.command("cleancommand", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (!arg) {
    const current = ctx.chatSettings?.chat?.cleanCommands ?? [];
    await ctx.reply(
      `<b>Clean command types:</b>\n` +
      `Current: ${current.length > 0 ? current.map((t) => `<code>${t}</code>`).join(", ") : "none"}\n\n` +
      `Available: ${CLEAN_COMMAND_TYPES.map((t) => `<code>${t}</code>`).join(", ")}\n` +
      `Usage: /cleancommand <type>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (!CLEAN_COMMAND_TYPES.includes(arg as any)) {
    await ctx.reply(`Invalid type. Available: ${CLEAN_COMMAND_TYPES.join(", ")}`);
    return;
  }

  const db = getDatabase();
  const current = ctx.chatSettings?.chat?.cleanCommands ?? [];
  const updated = current.includes(arg) ? current : [...current, arg];

  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { cleanCommands: updated },
  });

  await ctx.reply(`Clean command type <code>${arg}</code> enabled.`, { parse_mode: "HTML" });
});

// /keepcommand <type> - Disable auto-delete for command types
composer.command("keepcommand", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (!arg) {
    await ctx.reply("Usage: /keepcommand <type>");
    return;
  }

  const db = getDatabase();
  const current = ctx.chatSettings?.chat?.cleanCommands ?? [];
  const updated = current.filter((t) => t !== arg);

  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { cleanCommands: updated },
  });

  await ctx.reply(`Clean command type <code>${arg}</code> disabled.`, { parse_mode: "HTML" });
});

// /cleancommandtypes - List available command types
composer.command("cleancommandtypes", async (ctx) => {
  await ctx.reply(
    `<b>Clean command types:</b>\n${CLEAN_COMMAND_TYPES.map((t) => `<code>${t}</code>`).join(", ")}`,
    { parse_mode: "HTML" }
  );
});

// /cleanmsg <type> - Enable auto-delete for message types
composer.command("cleanmsg", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (!arg) {
    const current = ctx.chatSettings?.chat?.cleanMsgTypes ?? [];
    await ctx.reply(
      `<b>Clean message types:</b>\n` +
      `Current: ${current.length > 0 ? current.map((t) => `<code>${t}</code>`).join(", ") : "none"}\n\n` +
      `Available: ${CLEAN_MSG_TYPES.map((t) => `<code>${t}</code>`).join(", ")}\n` +
      `Usage: /cleanmsg <type>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (!CLEAN_MSG_TYPES.includes(arg as any)) {
    await ctx.reply(`Invalid type. Available: ${CLEAN_MSG_TYPES.join(", ")}`);
    return;
  }

  const db = getDatabase();
  const current = ctx.chatSettings?.chat?.cleanMsgTypes ?? [];
  const updated = current.includes(arg) ? current : [...current, arg];

  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { cleanMsgTypes: updated },
  });

  await ctx.reply(`Clean message type <code>${arg}</code> enabled.`, { parse_mode: "HTML" });
});

// /keepmsg <type> - Disable auto-delete for message types
composer.command("keepmsg", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (!arg) {
    await ctx.reply("Usage: /keepmsg <type>");
    return;
  }

  const db = getDatabase();
  const current = ctx.chatSettings?.chat?.cleanMsgTypes ?? [];
  const updated = current.filter((t) => t !== arg);

  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { cleanMsgTypes: updated },
  });

  await ctx.reply(`Clean message type <code>${arg}</code> disabled.`, { parse_mode: "HTML" });
});

// /cleanmsgtypes - List available message types
composer.command("cleanmsgtypes", async (ctx) => {
  await ctx.reply(
    `<b>Clean message types:</b>\n${CLEAN_MSG_TYPES.map((t) => `<code>${t}</code>`).join(", ")}`,
    { parse_mode: "HTML" }
  );
});

// /cleanservice <type> - Enable auto-delete for service messages
composer.command("cleanservice", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (!arg) {
    const current = ctx.chatSettings?.chat?.cleanService ?? [];
    await ctx.reply(
      `<b>Clean service types:</b>\n` +
      `Current: ${current.length > 0 ? current.map((t) => `<code>${t}</code>`).join(", ") : "none"}\n\n` +
      `Available: ${CLEAN_SERVICE_TYPES.map((t) => `<code>${t}</code>`).join(", ")}\n` +
      `Usage: /cleanservice <type>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (!CLEAN_SERVICE_TYPES.includes(arg as any)) {
    await ctx.reply(`Invalid type. Available: ${CLEAN_SERVICE_TYPES.join(", ")}`);
    return;
  }

  const db = getDatabase();
  const current = ctx.chatSettings?.chat?.cleanService ?? [];
  const updated = current.includes(arg) ? current : [...current, arg];

  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { cleanService: updated },
  });

  await ctx.reply(`Clean service type <code>${arg}</code> enabled.`, { parse_mode: "HTML" });
});

// /nocleanservice <type> - Disable auto-delete for service messages
composer.command("nocleanservice", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (!arg) {
    await ctx.reply("Usage: /nocleanservice <type>");
    return;
  }

  const db = getDatabase();
  const current = ctx.chatSettings?.chat?.cleanService ?? [];
  const updated = current.filter((t) => t !== arg);

  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { cleanService: updated },
  });

  await ctx.reply(`Clean service type <code>${arg}</code> disabled.`, { parse_mode: "HTML" });
});

// /cleanservicetypes - List available service types
composer.command("cleanservicetypes", async (ctx) => {
  await ctx.reply(
    `<b>Clean service types:</b>\n${CLEAN_SERVICE_TYPES.map((t) => `<code>${t}</code>`).join(", ")}`,
    { parse_mode: "HTML" }
  );
});

// Service message handler - auto-delete configured service messages
composer.on("message", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded || !ctx.message) return next();

  const cleanTypes = ctx.chatSettings.chat.cleanService;
  if (cleanTypes.length === 0) return next();

  const msg = ctx.message;
  const shouldClean = cleanTypes.includes("all") || (
    (cleanTypes.includes("join") && msg.new_chat_members && msg.new_chat_members.length > 0) ||
    (cleanTypes.includes("leave") && msg.left_chat_member !== undefined) ||
    (cleanTypes.includes("photo") && msg.new_chat_photo !== undefined) ||
    (cleanTypes.includes("pin") && msg.pinned_message !== undefined) ||
    (cleanTypes.includes("title") && msg.new_chat_title !== undefined) ||
    (cleanTypes.includes("videochat") && (
      msg.video_chat_started !== undefined ||
      msg.video_chat_ended !== undefined ||
      msg.video_chat_participants_invited !== undefined
    ))
  );

  if (shouldClean) {
    try { await ctx.deleteMessage(); } catch { /* ignore */ }
  }

  return next();
});

export default composer;
