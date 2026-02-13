import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { DISABLEABLE_COMMANDS } from "../../utils/permissions.js";

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

// /disabled - List disabled commands
composer.command("disabled", async (ctx) => {
  const db = getDatabase();
  const disabled = await db.disabledCommand.findMany({
    where: { chatId: BigInt(ctx.chat!.id) },
  });

  if (disabled.length === 0) {
    await ctx.reply("No commands are currently disabled in this group.");
    return;
  }

  let text = `<b>Disabled commands:</b>\n\n`;
  for (const cmd of disabled) {
    text += ` - /${cmd.command}`;
    if (cmd.deleteMsg) text += " (auto-delete)";
    if (cmd.disableAdmin) text += " (admins too)";
    text += "\n";
  }

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /disableable - List commands that can be disabled
composer.command("disableable", async (ctx) => {
  let text = `<b>Commands that can be disabled:</b>\n\n`;
  text += DISABLEABLE_COMMANDS.map((c) => `/${c}`).join(", ");
  await ctx.reply(text, { parse_mode: "HTML" });
});

// /disable <command> - Disable a command
composer.command("disable", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const cmd = (ctx.match as string).trim().toLowerCase().replace(/^\//, "");
  if (!cmd) {
    await ctx.reply("Usage: /disable <command>\nSee /disableable for available commands.");
    return;
  }

  if (!DISABLEABLE_COMMANDS.includes(cmd as any)) {
    await ctx.reply(
      `<code>${cmd}</code> can't be disabled.\nSee /disableable for available commands.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const db = getDatabase();
  await db.disabledCommand.upsert({
    where: {
      chatId_command: { chatId: BigInt(ctx.chat!.id), command: cmd },
    },
    create: {
      chatId: BigInt(ctx.chat!.id),
      command: cmd,
    },
    update: {},
  });

  await ctx.reply(`Disabled /${cmd} for non-admin users.`);
});

// /enable <command> - Re-enable a command
composer.command("enable", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const cmd = (ctx.match as string).trim().toLowerCase().replace(/^\//, "");
  if (!cmd) {
    await ctx.reply("Usage: /enable <command>");
    return;
  }

  const db = getDatabase();
  try {
    await db.disabledCommand.delete({
      where: {
        chatId_command: { chatId: BigInt(ctx.chat!.id), command: cmd },
      },
    });
    await ctx.reply(`Re-enabled /${cmd}.`);
  } catch {
    await ctx.reply(`/${cmd} wasn't disabled.`);
  }
});

// /disabledel on|off - Toggle auto-deletion of disabled commands
composer.command("disabledel", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /disabledel on|off\nWhen enabled, disabled command messages are automatically deleted.");
    return;
  }

  const db = getDatabase();
  // Update all disabled commands for this chat
  await db.disabledCommand.updateMany({
    where: { chatId: BigInt(ctx.chat!.id) },
    data: { deleteMsg: arg === "on" },
  });

  await ctx.reply(`Disabled command deletion ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /disableadmin on|off - Toggle whether disabled commands apply to admins
composer.command("disableadmin", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /disableadmin on|off\nWhen enabled, disabled commands also affect admins.");
    return;
  }

  const db = getDatabase();
  await db.disabledCommand.updateMany({
    where: { chatId: BigInt(ctx.chat!.id) },
    data: { disableAdmin: arg === "on" },
  });

  await ctx.reply(
    `Disabled commands ${arg === "on" ? "now also apply to" : "no longer apply to"} admins.`
  );
});

export default composer;
