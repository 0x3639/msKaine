import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import {
  getActiveLocks,
  addLock,
  removeLock,
  detectLockedContent,
  isValidLockType,
} from "./lock.service.js";
import { LOCK_TYPES } from "../../utils/constants.js";
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

// /locks - Check active locks
composer.command("locks", async (ctx) => {
  const arg = (ctx.match as string).trim().toLowerCase();

  if (arg === "list") {
    let text = `<b>All lock types:</b>\n\n`;
    const active = await getActiveLocks(BigInt(ctx.chat!.id));
    const activeTypes = new Set(active.map((l) => l.lockType));

    for (const lt of LOCK_TYPES) {
      text += `${activeTypes.has(lt) ? "🔒" : "🔓"} <code>${lt}</code>\n`;
    }
    await ctx.reply(text, { parse_mode: "HTML" });
    return;
  }

  const locks = await getActiveLocks(BigInt(ctx.chat!.id));
  if (locks.length === 0) {
    await ctx.reply("No locks are currently active in this group.");
    return;
  }

  let text = `<b>Active locks:</b>\n\n`;
  for (const lock of locks) {
    text += `🔒 <code>${lock.lockType}</code>`;
    if (lock.lockMode) text += ` (${lock.lockMode})`;
    if (lock.lockWarns) text += ` [warns]`;
    text += "\n";
  }
  await ctx.reply(text, { parse_mode: "HTML" });
});

// /locktypes - List all available lock types
composer.command("locktypes", async (ctx) => {
  const text = `<b>Available lock types:</b>\n\n` + LOCK_TYPES.map((t) => `<code>${t}</code>`).join(", ");
  await ctx.reply(text, { parse_mode: "HTML" });
});

// /lock <type(s)> [### reason] [{mode}] - Lock content types
composer.command("lock", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const raw = (ctx.match as string).trim();
  if (!raw) {
    await ctx.reply("Usage: /lock <type> [type2] ...\nSee /locktypes for available types.");
    return;
  }

  // Parse optional reason (after ###) and mode (in {braces})
  let reason: string | undefined;
  let mode: string | undefined;
  let typesStr = raw;

  const reasonMatch = raw.match(/###\s*(.+?)(?:\{|$)/);
  if (reasonMatch) {
    reason = reasonMatch[1].trim();
    typesStr = raw.slice(0, raw.indexOf("###")).trim();
  }

  const modeMatch = raw.match(/\{(\w+(?:\s+\w+)?)\}/);
  if (modeMatch) {
    mode = modeMatch[1].trim();
    if (!reasonMatch) {
      typesStr = raw.slice(0, raw.indexOf("{")).trim();
    }
  }

  const types = typesStr.toLowerCase().split(/\s+/).filter(Boolean);
  const chatId = BigInt(ctx.chat!.id);
  const locked: string[] = [];
  const invalid: string[] = [];

  for (const t of types) {
    if (isValidLockType(t)) {
      await addLock(chatId, t, { mode, reason });
      locked.push(t);
    } else {
      invalid.push(t);
    }
  }

  let text = "";
  if (locked.length > 0) text += `Locked: ${locked.map((t) => `<code>${t}</code>`).join(", ")}`;
  if (invalid.length > 0) text += `\nInvalid types: ${invalid.join(", ")}`;

  await ctx.reply(text, { parse_mode: "HTML" });

  await sendLogEntry(ctx, {
    category: "settings",
    action: `lock: ${locked.join(", ")}`,
    actorId: BigInt(ctx.from!.id),
    actorName: ctx.from!.first_name,
  });
});

// /unlock <type(s)> - Unlock content types
composer.command("unlock", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const types = (ctx.match as string).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (types.length === 0) {
    await ctx.reply("Usage: /unlock <type> [type2] ...");
    return;
  }

  const chatId = BigInt(ctx.chat!.id);
  const unlocked: string[] = [];

  for (const t of types) {
    if (await removeLock(chatId, t)) {
      unlocked.push(t);
    }
  }

  if (unlocked.length > 0) {
    await ctx.reply(`Unlocked: ${unlocked.map((t) => `<code>${t}</code>`).join(", ")}`, { parse_mode: "HTML" });
  } else {
    await ctx.reply("None of those types were locked.");
  }
});

// /lockwarns on|off - Toggle warnings for lock violations
composer.command("lockwarns", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /lockwarns on|off");
    return;
  }

  const db = getDatabase();
  await db.chatLock.updateMany({
    where: { chatId: BigInt(ctx.chat!.id) },
    data: { lockWarns: arg === "on" },
  });

  await ctx.reply(`Lock warnings ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /allowlist - Display or add to allowlist
composer.command("allowlist", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = (ctx.match as string).trim();
  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);

  if (!args) {
    const entries = await db.allowlistEntry.findMany({ where: { chatId } });
    if (entries.length === 0) {
      await ctx.reply("The allowlist is empty.");
      return;
    }
    let text = `<b>Allowlisted items:</b>\n\n`;
    for (const e of entries) {
      text += ` - <code>${e.item}</code>\n`;
    }
    await ctx.reply(text, { parse_mode: "HTML" });
    return;
  }

  // Add items to allowlist
  const items = args.split(/\s+/).filter(Boolean);
  for (const item of items) {
    await db.allowlistEntry.upsert({
      where: { chatId_item: { chatId, item } },
      create: { chatId, item },
      update: {},
    });
  }

  await ctx.reply(`Added ${items.length} item(s) to the allowlist.`);
});

// /rmallowlist <item(s)> - Remove from allowlist
composer.command("rmallowlist", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const items = (ctx.match as string).trim().split(/\s+/).filter(Boolean);
  if (items.length === 0) {
    await ctx.reply("Usage: /rmallowlist <item> [item2] ...");
    return;
  }

  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);
  let removed = 0;

  for (const item of items) {
    try {
      await db.allowlistEntry.delete({ where: { chatId_item: { chatId, item } } });
      removed++;
    } catch { /* not found */ }
  }

  await ctx.reply(`Removed ${removed} item(s) from the allowlist.`);
});

// /rmallowlistall - Clear entire allowlist (owner only)
composer.command("rmallowlistall", async (ctx) => {
  if (!ctx.permissions.isCreator) {
    await ctx.reply("Only the group creator can clear the entire allowlist.");
    return;
  }

  const db = getDatabase();
  const result = await db.allowlistEntry.deleteMany({ where: { chatId: BigInt(ctx.chat!.id) } });
  await ctx.reply(`Cleared ${result.count} item(s) from the allowlist.`);
});

// Message handler: enforce locks
composer.on("message", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded || !ctx.message || !ctx.from) return next();
  if (ctx.permissions.isAdmin || ctx.permissions.isApproved) return next();

  const chatId = BigInt(ctx.chat!.id);
  const locks = await getActiveLocks(chatId);
  if (locks.length === 0) return next();

  const lockedTypes = new Set(locks.map((l) => l.lockType));
  const messageTypes = detectLockedContent(ctx.message);

  // Check "all" lock
  const hasAll = lockedTypes.has("all");
  const violated = messageTypes.find((t) => lockedTypes.has(t) || hasAll);

  if (!violated) return next();

  // Delete the message
  try {
    await ctx.deleteMessage();
  } catch { /* ignore */ }

  // Find the specific lock config
  const lockConfig = locks.find((l) => l.lockType === violated) ?? locks.find((l) => l.lockType === "all");

  // Warn if configured
  if (lockConfig?.lockWarns) {
    const { addWarning } = await import("../warnings/warning.service.js");
    await addWarning(
      ctx,
      BigInt(ctx.from.id),
      BigInt(ctx.me.id),
      lockConfig.lockReason ?? `Sent locked content: ${violated}`
    );
  }

  return; // Don't continue processing
});

export default composer;
