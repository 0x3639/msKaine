import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml } from "../../utils/message-builder.js";
import type { BlocklistTriggerType } from "@prisma/client";

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

/**
 * Parse trigger type prefix from a trigger string.
 */
function parseTriggerType(trigger: string): { type: BlocklistTriggerType; value: string } {
  const prefixes: Record<string, BlocklistTriggerType> = {
    "stickerpack:": "STICKERPACK",
    "file:": "FILE",
    "forward:": "FORWARD",
    "inline:": "INLINE",
    "username:": "USERNAME",
    "name:": "NAME",
    "prefix:": "PREFIX",
    "exact:": "EXACT",
    "lookalike:": "LOOKALIKE",
  };

  for (const [prefix, type] of Object.entries(prefixes)) {
    if (trigger.toLowerCase().startsWith(prefix)) {
      return { type, value: trigger.slice(prefix.length) };
    }
  }

  return { type: "TEXT", value: trigger };
}

// /blocklist - List active triggers
composer.command("blocklist", async (ctx) => {
  const db = getDatabase();
  const items = await db.blocklist.findMany({
    where: { chatId: BigInt(ctx.chat!.id) },
    orderBy: { createdAt: "asc" },
  });

  if (items.length === 0) {
    await ctx.reply("No blocklist triggers in this group.");
    return;
  }

  let text = `<b>Blocklist triggers (${items.length}):</b>\n\n`;
  for (const item of items) {
    const prefix = item.triggerType !== "TEXT" ? `${item.triggerType.toLowerCase()}:` : "";
    text += ` - <code>${prefix}${escapeHtml(item.trigger)}</code>`;
    if (item.mode) text += ` {${item.mode.toLowerCase()}}`;
    if (item.reason) text += ` | ${escapeHtml(item.reason)}`;
    text += "\n";
  }

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /addblocklist <trigger> [reason] [{mode}]
composer.command("addblocklist", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const raw = (ctx.match as string).trim();
  if (!raw) {
    await ctx.reply(
      "Usage:\n" +
      `/addblocklist word reason\n` +
      `/addblocklist "multi word" reason\n` +
      `/addblocklist (word1, "phrase 2") reason\n` +
      `/addblocklist stickerpack:packname reason\n` +
      `Add {ban}, {mute}, {kick}, etc. to override mode.`
    );
    return;
  }

  // Parse optional mode override
  let mode: string | null = null;
  const modeMatch = raw.match(/\{(\w+(?:\s+\w+)?)\}/);
  if (modeMatch) {
    mode = modeMatch[1].trim().toUpperCase();
  }
  const withoutMode = raw.replace(/\{[^}]*\}/, "").trim();

  const TRIGGER_MAX_LENGTH = 100;
  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);

  // Parse batch triggers: (trigger1, "trigger 2", trigger3)
  const batchMatch = withoutMode.match(/^\((.+?)\)\s*(.*)/);
  if (batchMatch) {
    const triggersRaw = batchMatch[1];
    const reason = batchMatch[2].trim() || null;

    // Split on commas, respecting quotes
    const triggers = triggersRaw.split(",").map((t) => t.trim().replace(/^"(.+)"$/, "$1")).filter(Boolean);

    let count = 0;
    for (const trigger of triggers) {
      const { type, value } = parseTriggerType(trigger);
      if (value.length > TRIGGER_MAX_LENGTH) {
        await ctx.reply(`Trigger too long (max ${TRIGGER_MAX_LENGTH} chars): ${value.slice(0, 20)}...`);
        return;
      }
      await db.blocklist.create({
        data: { chatId, trigger: value.toLowerCase(), triggerType: type, reason, mode: mode as any },
      });
      count++;
    }

    await ctx.reply(`Added ${count} blocklist trigger(s).`);
    return;
  }

  // Parse quoted phrase: "multi word" reason
  const quotedMatch = withoutMode.match(/^"(.+?)"\s*(.*)/);
  let trigger: string;
  let reason: string | null;

  if (quotedMatch) {
    trigger = quotedMatch[1];
    reason = quotedMatch[2].trim() || null;
  } else {
    const parts = withoutMode.split(/\s+/);
    trigger = parts[0];
    reason = parts.slice(1).join(" ") || null;
  }

  const { type, value } = parseTriggerType(trigger);

  if (value.length > TRIGGER_MAX_LENGTH) {
    await ctx.reply(`Trigger too long (max ${TRIGGER_MAX_LENGTH} chars).`);
    return;
  }

  await db.blocklist.create({
    data: { chatId, trigger: value.toLowerCase(), triggerType: type, reason, mode: mode as any },
  });

  await ctx.reply(
    `Added blocklist trigger: <code>${escapeHtml(value)}</code>` +
    (type !== "TEXT" ? ` (type: ${type.toLowerCase()})` : ""),
    { parse_mode: "HTML" }
  );
});

// /rmblocklist <trigger(s)>
composer.command("rmblocklist", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const raw = (ctx.match as string).trim();
  if (!raw) {
    await ctx.reply("Usage: /rmblocklist <trigger> or /rmblocklist (trigger1, trigger2)");
    return;
  }

  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);

  // Batch removal
  const batchMatch = raw.match(/^\((.+?)\)/);
  const triggers = batchMatch
    ? batchMatch[1].split(",").map((t) => t.trim().replace(/^"(.+)"$/, "$1").toLowerCase()).filter(Boolean)
    : [raw.replace(/^"(.+)"$/, "$1").toLowerCase()];

  let removed = 0;
  for (const trigger of triggers) {
    const result = await db.blocklist.deleteMany({
      where: { chatId, trigger },
    });
    removed += result.count;
  }

  await ctx.reply(`Removed ${removed} blocklist trigger(s).`);
});

// /rmblocklistall - Remove all triggers (owner only)
composer.command("rmblocklistall", async (ctx) => {
  if (!ctx.permissions.isCreator) {
    await ctx.reply("Only the group creator can remove all blocklist triggers.");
    return;
  }

  const db = getDatabase();
  const result = await db.blocklist.deleteMany({ where: { chatId: BigInt(ctx.chat!.id) } });
  await ctx.reply(`Removed all ${result.count} blocklist trigger(s).`);
});

// /blocklistmode <action>
composer.command("blocklistmode", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const mode = (ctx.match as string).trim().toLowerCase();
  const validModes: Record<string, string> = {
    nothing: "DELETE", warn: "WARN", kick: "KICK", ban: "BAN", mute: "MUTE", tban: "TBAN", tmute: "TMUTE",
  };

  if (!validModes[mode]) {
    await ctx.reply("Valid modes: nothing, warn, kick, ban, mute, tban, tmute");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { blocklistMode: validModes[mode] as any },
  });

  await ctx.reply(`Blocklist mode set to <b>${mode}</b>.`, { parse_mode: "HTML" });
});

// /blocklistdelete on|off
composer.command("blocklistdelete", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /blocklistdelete on|off");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { blocklistDelete: arg === "on" },
  });

  await ctx.reply(`Blocklist message deletion ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /setblocklistreason <reason>
composer.command("setblocklistreason", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const reason = (ctx.match as string).trim();
  if (!reason) {
    await ctx.reply("Usage: /setblocklistreason <default reason>");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { blocklistReason: reason },
  });

  await ctx.reply(`Default blocklist reason set.`);
});

// /resetblocklistreason
composer.command("resetblocklistreason", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { blocklistReason: null },
  });

  await ctx.reply("Blocklist reason reset to default.");
});

// Message handler: enforce blocklist
composer.on("message", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded || !ctx.message || !ctx.from) return next();
  if (ctx.permissions.isAdmin || ctx.permissions.isApproved) return next();

  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);
  const items = await db.blocklist.findMany({ where: { chatId } });
  if (items.length === 0) return next();

  const text = (ctx.message.text ?? ctx.message.caption ?? "").toLowerCase();
  const stickerPack = ctx.message.sticker?.set_name?.toLowerCase();
  const forwardFrom = ctx.message.forward_origin && "chat" in ctx.message.forward_origin
    ? (ctx.message.forward_origin as any).chat?.username?.toLowerCase()
    : undefined;
  const fileName = ctx.message.document?.file_name?.toLowerCase();
  const viaBot = ctx.message.via_bot?.id ? String(ctx.message.via_bot.id) : undefined;
  const senderUsername = ctx.from.username?.toLowerCase();
  const senderName = `${ctx.from.first_name} ${ctx.from.last_name ?? ""}`.toLowerCase().trim();

  for (const item of items) {
    const trigger = item.trigger.toLowerCase();
    let matched = false;

    switch (item.triggerType) {
      case "TEXT":
        matched = text.includes(trigger);
        break;
      case "STICKERPACK":
        matched = stickerPack === trigger;
        break;
      case "FILE":
        if (fileName) {
          matched = safeGlobTest(trigger, fileName);
        }
        break;
      case "FORWARD":
        matched = forwardFrom === trigger.replace("@", "");
        break;
      case "INLINE":
        matched = viaBot === trigger;
        break;
      case "USERNAME":
        if (senderUsername) {
          matched = safeGlobTest(trigger, senderUsername);
        }
        break;
      case "NAME":
        if (senderName) {
          matched = safeGlobTest(trigger, senderName);
        }
        break;
      case "PREFIX":
        matched = text.startsWith(trigger);
        break;
      case "EXACT":
        matched = text === trigger;
        break;
      case "LOOKALIKE":
        matched = containsLookalike(text, trigger);
        break;
    }

    if (matched) {
      // Delete if configured
      if (ctx.chatSettings.chat.blocklistDelete) {
        try { await ctx.deleteMessage(); } catch { /* ignore */ }
      }

      // Apply action
      const action = (item.mode ?? ctx.chatSettings.chat.blocklistMode).toString();
      const reason = item.reason ?? ctx.chatSettings.chat.blocklistReason ?? `Blocklisted: ${trigger}`;

      await applyBlocklistAction(ctx, action, reason);
      return; // Stop processing
    }
  }

  return next();
});

async function applyBlocklistAction(ctx: BotContext, action: string, reason: string): Promise<void> {
  const userId = ctx.from!.id;

  switch (action) {
    case "WARN": {
      const { addWarning } = await import("../warnings/warning.service.js");
      await addWarning(ctx, BigInt(userId), BigInt(ctx.me.id), reason);
      break;
    }
    case "KICK": {
      const { kickUser } = await import("../bans/restriction.service.js");
      await kickUser(ctx, { targetId: userId, targetName: ctx.from!.first_name, reason });
      break;
    }
    case "BAN": {
      const { banUser } = await import("../bans/restriction.service.js");
      await banUser(ctx, { targetId: userId, targetName: ctx.from!.first_name, reason });
      break;
    }
    case "MUTE": {
      const { muteUser } = await import("../bans/restriction.service.js");
      await muteUser(ctx, { targetId: userId, targetName: ctx.from!.first_name, reason });
      break;
    }
    case "TBAN": {
      const { banUser } = await import("../bans/restriction.service.js");
      await banUser(ctx, { targetId: userId, targetName: ctx.from!.first_name, reason, duration: 86400 });
      break;
    }
    case "TMUTE": {
      const { muteUser } = await import("../bans/restriction.service.js");
      await muteUser(ctx, { targetId: userId, targetName: ctx.from!.first_name, reason, duration: 86400 });
      break;
    }
    // DELETE - message already deleted above
  }
}

/**
 * Safe glob-to-regex test. Escapes special regex chars except *, converts * to
 * a lazy bounded pattern, and wraps execution in try/catch.
 */
function safeGlobTest(trigger: string, input: string): boolean {
  if (input.length > 1000) return false;
  try {
    // Escape all regex special chars except *, then convert * to lazy wildcard
    const escaped = trigger.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const pattern = escaped.replace(/\*/g, ".*?");
    return new RegExp(`^${pattern}$`, "i").test(input);
  } catch {
    return false;
  }
}

/**
 * Simple lookalike/homoglyph detection with safety bounds.
 */
function containsLookalike(text: string, target: string): boolean {
  // Bound input length to prevent ReDoS on long messages
  if (text.length > 1000 || target.length > 100) return false;

  const homoglyphs: Record<string, string> = {
    a: "[aаα@àáâãäå]", b: "[bвьъ]", c: "[cсçć]", d: "[dԁ]",
    e: "[eеéèêë]", g: "[gɡ]", h: "[hнһ]", i: "[iіíîïì1l!|]",
    k: "[kкκ]", l: "[l1iіΙ|]", m: "[mмṁ]", n: "[nпñ]",
    o: "[oоοσ0ôöòóõ]", p: "[pрρ]", r: "[rгṛ]", s: "[sѕ$5]",
    t: "[tтτ]", u: "[uυцúùûü]", v: "[vνѵ]", w: "[wωш]",
    x: "[xхχ]", y: "[yуγýÿ]", z: "[zζ]",
  };

  let pattern = "";
  for (const char of target.toLowerCase()) {
    pattern += homoglyphs[char] ?? char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  try {
    return new RegExp(pattern, "i").test(text);
  } catch {
    return false;
  }
}

export default composer;
