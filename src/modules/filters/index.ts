import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml, parseButtons } from "../../utils/message-builder.js";
import { applyFillings } from "../formatting/filling-parser.js";
import { pickRandom } from "../formatting/random-content.js";
import type { FilterTriggerType } from "@prisma/client";

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
 * Parse trigger type prefix from filter keyword.
 */
function parseFilterTrigger(keyword: string): { type: FilterTriggerType; value: string } {
  if (keyword.startsWith("prefix:")) return { type: "PREFIX", value: keyword.slice(7) };
  if (keyword.startsWith("exact:")) return { type: "EXACT", value: keyword.slice(6) };
  if (keyword.startsWith("command:")) return { type: "COMMAND", value: keyword.slice(8) };
  return { type: "CONTAINS", value: keyword };
}

// /filter <keyword> <response> - Add a filter
composer.command("filter", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const raw = (ctx.match as string).trim();
  if (!raw) {
    await ctx.reply(
      "Usage: /filter <keyword> <response>\n\n" +
      "Prefixes: prefix:, exact:, command:\n" +
      "Default is substring match."
    );
    return;
  }

  // Handle quoted keywords
  let keyword: string;
  let content: string;

  const quotedMatch = raw.match(/^"(.+?)"\s+([\s\S]+)/);
  if (quotedMatch) {
    keyword = quotedMatch[1].toLowerCase();
    content = quotedMatch[2].trim();
  } else {
    const firstSpace = raw.indexOf(" ");
    if (firstSpace === -1) {
      // Check for reply
      if (ctx.message?.reply_to_message) {
        keyword = raw.toLowerCase();
        content = ctx.message.reply_to_message.text ?? ctx.message.reply_to_message.caption ?? "";
      } else {
        await ctx.reply("Usage: /filter <keyword> <response>");
        return;
      }
    } else {
      keyword = raw.slice(0, firstSpace).toLowerCase();
      content = raw.slice(firstSpace + 1).trim();
    }
  }

  if (!keyword || !content) {
    await ctx.reply("Usage: /filter <keyword> <response>");
    return;
  }

  const { type, value } = parseFilterTrigger(keyword);
  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);

  // Check for media in reply
  let mediaType: string | null = null;
  let mediaId: string | null = null;
  let buttons: any = null;

  if (ctx.message?.reply_to_message) {
    const reply = ctx.message.reply_to_message;
    if (reply.photo) {
      mediaType = "photo";
      mediaId = reply.photo[reply.photo.length - 1].file_id;
    } else if (reply.animation) {
      mediaType = "animation";
      mediaId = reply.animation.file_id;
    } else if (reply.video) {
      mediaType = "video";
      mediaId = reply.video.file_id;
    } else if (reply.document) {
      mediaType = "document";
      mediaId = reply.document.file_id;
    } else if (reply.sticker) {
      mediaType = "sticker";
      mediaId = reply.sticker.file_id;
    } else if (reply.audio) {
      mediaType = "audio";
      mediaId = reply.audio.file_id;
    }
  }

  // Parse button syntax
  const { text: cleanContent, keyboard } = parseButtons(content);
  if (keyboard) {
    buttons = keyboard.inline_keyboard;
  }

  // Check if filter already exists, update it
  const existing = await db.filter.findFirst({
    where: { chatId, keyword: value, triggerType: type },
  });

  if (existing) {
    await db.filter.update({
      where: { id: existing.id },
      data: { content: cleanContent, mediaType, mediaId, buttons },
    });
  } else {
    await db.filter.create({
      data: { chatId, keyword: value, triggerType: type, content: cleanContent, mediaType, mediaId, buttons },
    });
  }

  const prefix = type !== "CONTAINS" ? `${type.toLowerCase()}:` : "";
  await ctx.reply(`Filter <code>${prefix}${escapeHtml(value)}</code> saved.`, { parse_mode: "HTML" });
});

// /stop <keyword> - Remove a filter
composer.command("stop", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const raw = (ctx.match as string).trim().toLowerCase();
  if (!raw) {
    await ctx.reply("Usage: /stop <keyword>");
    return;
  }

  const { type, value } = parseFilterTrigger(raw);
  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);

  const result = await db.filter.deleteMany({
    where: { chatId, keyword: value, triggerType: type },
  });

  if (result.count > 0) {
    await ctx.reply(`Filter "${value}" removed.`);
  } else {
    await ctx.reply(`No filter found for "${value}".`);
  }
});

// /stopall - Remove all filters (owner only)
composer.command("stopall", async (ctx) => {
  if (!ctx.permissions.isCreator) {
    await ctx.reply("Only the group creator can remove all filters.");
    return;
  }

  const db = getDatabase();
  const result = await db.filter.deleteMany({
    where: { chatId: BigInt(ctx.chat!.id) },
  });

  await ctx.reply(`Removed all ${result.count} filter(s).`);
});

// /filters - List all filters
composer.command("filters", async (ctx) => {
  const db = getDatabase();
  const filters = await db.filter.findMany({
    where: { chatId: BigInt(ctx.chat!.id) },
    select: { keyword: true, triggerType: true },
    orderBy: { keyword: "asc" },
  });

  if (filters.length === 0) {
    await ctx.reply("No filters in this group.");
    return;
  }

  let text = `<b>Filters in this group (${filters.length}):</b>\n\n`;
  for (const f of filters) {
    const prefix = f.triggerType !== "CONTAINS" ? `${f.triggerType.toLowerCase()}:` : "";
    text += ` - <code>${prefix}${escapeHtml(f.keyword)}</code>\n`;
  }

  await ctx.reply(text, { parse_mode: "HTML" });
});

// Message handler: match filters
composer.on("message", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded || !ctx.message) return next();
  if (ctx.permissions.isAdmin || ctx.permissions.isApproved) return next();

  const text = (ctx.message.text ?? ctx.message.caption ?? "").toLowerCase();
  if (!text) return next();

  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);
  const filters = await db.filter.findMany({ where: { chatId } });

  if (filters.length === 0) return next();

  for (const filter of filters) {
    let matched = false;

    switch (filter.triggerType) {
      case "CONTAINS":
        matched = text.includes(filter.keyword);
        break;
      case "PREFIX":
        matched = text.startsWith(filter.keyword);
        break;
      case "EXACT":
        matched = text === filter.keyword;
        break;
      case "COMMAND":
        matched = text === `/${filter.keyword}` || text.startsWith(`/${filter.keyword} `) || text.startsWith(`/${filter.keyword}@`);
        break;
    }

    if (matched) {
      await sendFilterResponse(ctx, filter);
      return; // Stop after first match
    }
  }

  return next();
});

async function sendFilterResponse(
  ctx: BotContext,
  filter: { content: string; mediaType: string | null; mediaId: string | null; buttons: any }
): Promise<void> {
  let content = pickRandom(filter.content);

  const fillResult = applyFillings(content, {
    user: ctx.from ? {
      id: ctx.from.id,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      username: ctx.from.username,
    } : undefined,
    chatTitle: ctx.chat!.title ?? "this group",
    rules: ctx.chatSettings?.chat?.rules ?? undefined,
  });

  content = fillResult.text;

  let replyMarkup: any = undefined;
  if (filter.buttons && Array.isArray(filter.buttons)) {
    replyMarkup = { inline_keyboard: filter.buttons };
  }

  try {
    if (filter.mediaType && filter.mediaId) {
      switch (filter.mediaType) {
        case "photo":
          await ctx.replyWithPhoto(filter.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
          });
          break;
        case "animation":
          await ctx.replyWithAnimation(filter.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
          });
          break;
        case "video":
          await ctx.replyWithVideo(filter.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
          });
          break;
        case "document":
          await ctx.replyWithDocument(filter.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
          });
          break;
        case "audio":
          await ctx.replyWithAudio(filter.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
          });
          break;
        case "sticker":
          await ctx.replyWithSticker(filter.mediaId, { reply_markup: replyMarkup });
          if (content) {
            await ctx.reply(content, { parse_mode: "HTML" });
          }
          break;
      }
    } else {
      await ctx.reply(content, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
        link_preview_options: fillResult.noPreview ? { is_disabled: true } : undefined,
      });
    }
  } catch { /* ignore send failures */ }
}

export default composer;
