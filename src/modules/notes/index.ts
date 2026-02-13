import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml } from "../../utils/message-builder.js";
import { parseButtons } from "../../utils/message-builder.js";
import { applyFillings } from "../formatting/filling-parser.js";
import { pickRandom } from "../formatting/random-content.js";

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

// /save <name> <content> - Save a note
composer.command("save", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const raw = (ctx.match as string).trim();
  const firstSpace = raw.indexOf(" ");
  let name: string;
  let content: string;

  if (firstSpace === -1) {
    // Check for reply
    if (ctx.message?.reply_to_message) {
      name = raw.toLowerCase();
      content = ctx.message.reply_to_message.text ?? ctx.message.reply_to_message.caption ?? "";
    } else {
      await ctx.reply("Usage: /save <name> <content>\nOr reply to a message with /save <name>");
      return;
    }
  } else {
    name = raw.slice(0, firstSpace).toLowerCase();
    content = raw.slice(firstSpace + 1).trim();
  }

  if (!name || !content) {
    await ctx.reply("Usage: /save <name> <content>");
    return;
  }

  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);

  // Check for control fillings in content
  const isPrivate = /\{private\}/i.test(content);
  const isAdmin = /\{admin\}/i.test(content);
  content = content.replace(/\{private\}/gi, "").replace(/\{admin\}/gi, "").trim();

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
    } else if (reply.voice) {
      mediaType = "voice";
      mediaId = reply.voice.file_id;
    }

    // If content wasn't given explicitly, use reply content
    if (firstSpace === -1) {
      content = reply.text ?? reply.caption ?? "";
      content = content.replace(/\{private\}/gi, "").replace(/\{admin\}/gi, "").trim();
    }
  }

  // Parse button syntax from content
  const { text: cleanContent, keyboard } = parseButtons(content);
  if (keyboard) {
    buttons = keyboard.inline_keyboard;
  }

  await db.note.upsert({
    where: { chatId_name: { chatId, name } },
    create: {
      chatId,
      name,
      content: cleanContent,
      mediaType,
      mediaId,
      buttons,
      isPrivate,
      isAdmin,
    },
    update: {
      content: cleanContent,
      mediaType,
      mediaId,
      buttons,
      isPrivate,
      isAdmin,
    },
  });

  await ctx.reply(`Note <code>${escapeHtml(name)}</code> saved.`, { parse_mode: "HTML" });
});

// /get <name> - Get a note
composer.command("get", async (ctx) => {
  const name = (ctx.match as string).trim().toLowerCase();
  if (!name) {
    await ctx.reply("Usage: /get <notename>");
    return;
  }

  await sendNote(ctx, name);
});

// /notes - List all notes
composer.command("notes", async (ctx) => {
  const db = getDatabase();
  const notes = await db.note.findMany({
    where: { chatId: BigInt(ctx.chat!.id) },
    select: { name: true, isPrivate: true, isAdmin: true },
    orderBy: { name: "asc" },
  });

  if (notes.length === 0) {
    await ctx.reply("No notes saved in this group.");
    return;
  }

  let text = `<b>Notes in this group (${notes.length}):</b>\n\n`;
  for (const note of notes) {
    text += ` - <code>${escapeHtml(note.name)}</code>`;
    if (note.isPrivate) text += " (private)";
    if (note.isAdmin) text += " (admin)";
    text += "\n";
  }
  text += `\nUse <code>/get notename</code> or <code>#notename</code> to retrieve.`;

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /clear <name> - Delete a note
composer.command("clear", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const name = (ctx.match as string).trim().toLowerCase();
  if (!name) {
    await ctx.reply("Usage: /clear <notename>");
    return;
  }

  const db = getDatabase();
  try {
    await db.note.delete({
      where: { chatId_name: { chatId: BigInt(ctx.chat!.id), name } },
    });
    await ctx.reply(`Note <code>${escapeHtml(name)}</code> deleted.`, { parse_mode: "HTML" });
  } catch {
    await ctx.reply(`Note "${name}" not found.`);
  }
});

// /privatenotes on|off - Toggle sending notes via PM
composer.command("privatenotes", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /privatenotes on|off");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { privateNotes: arg === "on" },
  });

  await ctx.reply(`Private notes ${arg === "on" ? "enabled" : "disabled"}.`);
});

// #triggerword handler - match hashtag note triggers
composer.on("message:text", async (ctx, next) => {
  if (!ctx.message?.text) return next();
  if (!ctx.chatSettings?.loaded) return next();

  const text = ctx.message.text;
  if (!text.startsWith("#")) return next();

  // Extract note name from #trigger
  const match = text.match(/^#(\S+)/);
  if (!match) return next();

  const name = match[1].toLowerCase();
  const db = getDatabase();
  const note = await db.note.findUnique({
    where: { chatId_name: { chatId: BigInt(ctx.chat!.id), name } },
  });

  if (!note) return next();

  await sendNote(ctx, name);
});

/**
 * Send a note to the chat/PM with fillings and media support.
 */
async function sendNote(ctx: BotContext, name: string): Promise<void> {
  const db = getDatabase();
  const note = await db.note.findUnique({
    where: { chatId_name: { chatId: BigInt(ctx.chat!.id), name } },
  });

  if (!note) {
    await ctx.reply(`Note "${name}" not found.`);
    return;
  }

  // Admin-only note
  if (note.isAdmin && !ctx.permissions.isAdmin) {
    return;
  }

  // Pick random content if %%% is present
  let content = pickRandom(note.content);

  // Apply fillings
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

  // Reconstruct keyboard from stored buttons
  let replyMarkup: any = undefined;
  if (note.buttons && Array.isArray(note.buttons)) {
    replyMarkup = { inline_keyboard: note.buttons };
  }

  // Determine if sending to PM
  const sendToPm = (note.isPrivate || ctx.chatSettings?.chat?.privateNotes) && ctx.chat!.type !== "private";

  const targetChatId = sendToPm ? ctx.from!.id : ctx.chat!.id;

  try {
    if (note.mediaType && note.mediaId) {
      switch (note.mediaType) {
        case "photo":
          await ctx.api.sendPhoto(targetChatId, note.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
            disable_notification: fillResult.noNotif,
          });
          break;
        case "animation":
          await ctx.api.sendAnimation(targetChatId, note.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
            disable_notification: fillResult.noNotif,
          });
          break;
        case "video":
          await ctx.api.sendVideo(targetChatId, note.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
            disable_notification: fillResult.noNotif,
          });
          break;
        case "document":
          await ctx.api.sendDocument(targetChatId, note.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
            disable_notification: fillResult.noNotif,
          });
          break;
        case "audio":
          await ctx.api.sendAudio(targetChatId, note.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
            disable_notification: fillResult.noNotif,
          });
          break;
        case "voice":
          await ctx.api.sendVoice(targetChatId, note.mediaId, {
            caption: content, parse_mode: "HTML", reply_markup: replyMarkup,
            disable_notification: fillResult.noNotif,
          });
          break;
        case "sticker":
          await ctx.api.sendSticker(targetChatId, note.mediaId, {
            reply_markup: replyMarkup,
            disable_notification: fillResult.noNotif,
          });
          // Send text separately if present
          if (content) {
            await ctx.api.sendMessage(targetChatId, content, {
              parse_mode: "HTML",
              disable_notification: fillResult.noNotif,
            });
          }
          break;
      }
    } else {
      await ctx.api.sendMessage(targetChatId, content, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
        disable_notification: fillResult.noNotif,
        link_preview_options: fillResult.noPreview ? { is_disabled: true } : undefined,
      });
    }

    if (sendToPm) {
      await ctx.reply("Note sent to your PM.");
    }
  } catch {
    if (sendToPm) {
      await ctx.reply("Failed to send note to PM. Have you started the bot?");
    }
  }
}

export default composer;
