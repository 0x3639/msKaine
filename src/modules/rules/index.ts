import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml } from "../../utils/message-builder.js";

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

// /rules - Display group rules
composer.command("rules", async (ctx) => {
  const settings = ctx.chatSettings?.chat;
  if (!settings) return;

  const rules = settings.rules;
  if (!rules) {
    await ctx.reply("No rules have been set for this group yet. Use /setrules to set them.");
    return;
  }

  // Private rules: send via PM with a button
  if (settings.privateRules && ctx.chat!.type !== "private") {
    const keyboard = new InlineKeyboard()
      .url("Read the rules", `https://t.me/${ctx.me.username}?start=rules_${ctx.chat!.id}`);

    await ctx.reply("Click the button below to read the rules in PM.", {
      reply_markup: keyboard,
    });
    return;
  }

  let text = `<b>Rules for ${escapeHtml(ctx.chat!.title ?? "this group")}:</b>\n\n${rules}`;

  // Add custom rules button if configured
  const keyboard = new InlineKeyboard();
  if (settings.rulesButton) {
    // Parse "Text|URL" format
    const parts = settings.rulesButton.split("|");
    if (parts.length === 2) {
      keyboard.url(parts[0].trim(), parts[1].trim());
    }
  }

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined,
  });
});

// /setrules <rules> - Set group rules
composer.command("setrules", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  let rules = (ctx.match as string).trim();

  // Support replying to a message
  if (!rules && ctx.message?.reply_to_message) {
    rules = ctx.message.reply_to_message.text ?? ctx.message.reply_to_message.caption ?? "";
  }

  if (!rules) {
    await ctx.reply("Usage: /setrules <rules text>\nYou can also reply to a message.");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { rules },
  });

  await ctx.reply("Rules updated.");
});

// /resetrules - Clear rules
composer.command("resetrules", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { rules: null },
  });

  await ctx.reply("Rules have been cleared.");
});

// /privaterules on|off - Toggle sending rules via PM
composer.command("privaterules", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /privaterules on|off");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { privateRules: arg === "on" },
  });

  await ctx.reply(`Private rules ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /setrulesbutton <text>|<url> - Add a custom button to rules
composer.command("setrulesbutton", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const raw = (ctx.match as string).trim();
  if (!raw || !raw.includes("|")) {
    await ctx.reply("Usage: /setrulesbutton Button Text|https://example.com");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { rulesButton: raw },
  });

  await ctx.reply("Rules button set.");
});

// /resetrulesbutton - Remove custom rules button
composer.command("resetrulesbutton", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { rulesButton: null },
  });

  await ctx.reply("Rules button removed.");
});

export default composer;
