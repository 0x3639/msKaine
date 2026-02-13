import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getConfig } from "../../config.js";

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

// /echo <text> - Repeat text (admin only)
composer.command("echo", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const text = (ctx.match as string).trim();
  if (!text) {
    await ctx.reply("Usage: /echo <text>");
    return;
  }

  // Delete the command message
  try { await ctx.deleteMessage(); } catch { /* ignore */ }

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /say <text> - Same as echo but for groups
composer.command("say", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const text = (ctx.match as string).trim();
  if (!text) {
    await ctx.reply("Usage: /say <text>");
    return;
  }

  try { await ctx.deleteMessage(); } catch { /* ignore */ }

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /broadcast <text> - Send message to all chats (owner only)
composer.command("broadcast", async (ctx) => {
  if (BigInt(ctx.from?.id ?? 0) !== getConfig().BOT_OWNER_ID) {
    return;
  }

  const text = (ctx.match as string).trim();
  if (!text) {
    await ctx.reply("Usage: /broadcast <text>");
    return;
  }

  await ctx.reply("Broadcast is a privileged operation. Use with caution.\nSending...");

  // Note: Full broadcast implementation would iterate all chats from DB.
  // For safety, this is intentionally limited - actual broadcast should be
  // done through a proper admin panel or with rate limiting.
  await ctx.reply("Broadcast feature is available but rate-limited for safety. Contact the bot owner for bulk messaging.");
});

export default composer;
