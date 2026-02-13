import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml, userMention, parseButtons } from "../../utils/message-builder.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("greetings");

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
 * Apply filling replacements to a greeting template.
 */
function applyFillings(template: string, user: { id: number; first_name: string; last_name?: string; username?: string }, chatTitle: string): string {
  let result = template;
  result = result.replace(/\{first\}/gi, escapeHtml(user.first_name));
  result = result.replace(/\{last\}/gi, escapeHtml(user.last_name ?? ""));
  result = result.replace(/\{fullname\}/gi, escapeHtml(`${user.first_name} ${user.last_name ?? ""}`.trim()));
  result = result.replace(/\{username\}/gi, user.username ? `@${escapeHtml(user.username)}` : userMention(user.id, user.first_name));
  result = result.replace(/\{mention\}/gi, userMention(user.id, user.first_name));
  result = result.replace(/\{id\}/gi, String(user.id));
  result = result.replace(/\{chatname\}/gi, escapeHtml(chatTitle));
  return result;
}

// /welcome on|off - Show or toggle welcome messages
composer.command("welcome", async (ctx) => {
  const arg = (ctx.match as string).trim().toLowerCase();

  if (arg === "on" || arg === "off") {
    if (!requireAdmin(ctx)) return;

    const db = getDatabase();
    await db.chat.update({
      where: { id: BigInt(ctx.chat!.id) },
      data: { welcomeEnabled: arg === "on" },
    });
    await ctx.reply(`Welcome messages ${arg === "on" ? "enabled" : "disabled"}.`);
    return;
  }

  const settings = ctx.chatSettings?.chat;
  if (!settings) return;

  const text = settings.welcomeText ?? "Hey {first}, welcome to {chatname}!";
  await ctx.reply(
    `<b>Welcome settings:</b>\n\n` +
    `Status: <b>${settings.welcomeEnabled ? "enabled" : "disabled"}</b>\n` +
    `Clean welcome: <b>${settings.cleanWelcome ? "yes" : "no"}</b>\n\n` +
    `Current welcome message:\n<code>${escapeHtml(text)}</code>`,
    { parse_mode: "HTML" }
  );
});

// /setwelcome <text> - Set custom welcome message
composer.command("setwelcome", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  let text = (ctx.match as string).trim();

  // Also support replying to a message to set its content as welcome
  if (!text && ctx.message?.reply_to_message) {
    text = ctx.message.reply_to_message.text ?? ctx.message.reply_to_message.caption ?? "";
  }

  if (!text) {
    await ctx.reply(
      "Usage: /setwelcome <message>\n\n" +
      "Fillings: {first}, {last}, {fullname}, {username}, {mention}, {id}, {chatname}\n" +
      "Buttons: [text](buttonurl://url)"
    );
    return;
  }

  const db = getDatabase();
  const updateData: Record<string, any> = { welcomeText: text };

  // Check for media in replied message
  if (ctx.message?.reply_to_message) {
    const reply = ctx.message.reply_to_message;
    if (reply.photo) {
      updateData.welcomeMediaType = "photo";
      updateData.welcomeMediaId = reply.photo[reply.photo.length - 1].file_id;
    } else if (reply.animation) {
      updateData.welcomeMediaType = "animation";
      updateData.welcomeMediaId = reply.animation.file_id;
    } else if (reply.video) {
      updateData.welcomeMediaType = "video";
      updateData.welcomeMediaId = reply.video.file_id;
    } else if (reply.document) {
      updateData.welcomeMediaType = "document";
      updateData.welcomeMediaId = reply.document.file_id;
    } else if (reply.sticker) {
      updateData.welcomeMediaType = "sticker";
      updateData.welcomeMediaId = reply.sticker.file_id;
    }
  }

  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: updateData,
  });

  await ctx.reply("Welcome message updated.");
});

// /resetwelcome - Reset to default
composer.command("resetwelcome", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: {
      welcomeText: null,
      welcomeMediaType: null,
      welcomeMediaId: null,
    },
  });

  await ctx.reply("Welcome message reset to default.");
});

// /goodbye on|off - Show or toggle goodbye messages
composer.command("goodbye", async (ctx) => {
  const arg = (ctx.match as string).trim().toLowerCase();

  if (arg === "on" || arg === "off") {
    if (!requireAdmin(ctx)) return;

    const db = getDatabase();
    await db.chat.update({
      where: { id: BigInt(ctx.chat!.id) },
      data: { goodbyeEnabled: arg === "on" },
    });
    await ctx.reply(`Goodbye messages ${arg === "on" ? "enabled" : "disabled"}.`);
    return;
  }

  const settings = ctx.chatSettings?.chat;
  if (!settings) return;

  const text = settings.goodbyeText ?? "Goodbye {first}!";
  await ctx.reply(
    `<b>Goodbye settings:</b>\n\n` +
    `Status: <b>${settings.goodbyeEnabled ? "enabled" : "disabled"}</b>\n\n` +
    `Current goodbye message:\n<code>${escapeHtml(text)}</code>`,
    { parse_mode: "HTML" }
  );
});

// /setgoodbye <text>
composer.command("setgoodbye", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  let text = (ctx.match as string).trim();

  if (!text && ctx.message?.reply_to_message) {
    text = ctx.message.reply_to_message.text ?? ctx.message.reply_to_message.caption ?? "";
  }

  if (!text) {
    await ctx.reply("Usage: /setgoodbye <message>\nFillings: {first}, {last}, {fullname}, {username}, {mention}, {id}, {chatname}");
    return;
  }

  const db = getDatabase();
  const updateData: Record<string, any> = { goodbyeText: text };

  if (ctx.message?.reply_to_message) {
    const reply = ctx.message.reply_to_message;
    if (reply.photo) {
      updateData.goodbyeMediaType = "photo";
      updateData.goodbyeMediaId = reply.photo[reply.photo.length - 1].file_id;
    } else if (reply.animation) {
      updateData.goodbyeMediaType = "animation";
      updateData.goodbyeMediaId = reply.animation.file_id;
    } else if (reply.video) {
      updateData.goodbyeMediaType = "video";
      updateData.goodbyeMediaId = reply.video.file_id;
    } else if (reply.document) {
      updateData.goodbyeMediaType = "document";
      updateData.goodbyeMediaId = reply.document.file_id;
    }
  }

  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: updateData,
  });

  await ctx.reply("Goodbye message updated.");
});

// /resetgoodbye
composer.command("resetgoodbye", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: {
      goodbyeText: null,
      goodbyeMediaType: null,
      goodbyeMediaId: null,
    },
  });

  await ctx.reply("Goodbye message reset to default.");
});

// /cleanwelcome on|off - Auto-delete previous welcome message
composer.command("cleanwelcome", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /cleanwelcome on|off");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { cleanWelcome: arg === "on" },
  });

  await ctx.reply(`Clean welcome ${arg === "on" ? "enabled" : "disabled"}.`);
});

// Handle new chat members - send welcome
composer.on("chat_member", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded) return next();

  const update = ctx.chatMember;
  if (!update) return next();

  const oldStatus = update.old_chat_member.status;
  const newStatus = update.new_chat_member.status;

  // New member joined
  if (
    (oldStatus === "left" || oldStatus === "kicked") &&
    (newStatus === "member" || newStatus === "restricted")
  ) {
    const user = update.new_chat_member.user;
    if (user.is_bot) return next();
    if (!ctx.chatSettings.chat.welcomeEnabled) return next();

    const settings = ctx.chatSettings.chat;
    const template = settings.welcomeText ?? "Hey {first}, welcome to {chatname}!";
    const chatTitle = ctx.chat!.title ?? "this group";
    const filledText = applyFillings(template, user, chatTitle);
    const { text: messageText, keyboard } = parseButtons(filledText);

    try {
      // Clean previous welcome if enabled
      if (settings.cleanWelcome && settings.lastWelcomeMessageId) {
        try {
          await ctx.api.deleteMessage(ctx.chat!.id, settings.lastWelcomeMessageId);
        } catch { /* ignore */ }
      }

      let sentMsg;

      // Send with media if configured
      if (settings.welcomeMediaType && settings.welcomeMediaId) {
        const replyMarkup = keyboard ? keyboard : undefined;
        switch (settings.welcomeMediaType) {
          case "photo":
            sentMsg = await ctx.api.sendPhoto(ctx.chat!.id, settings.welcomeMediaId, {
              caption: messageText, parse_mode: "HTML", reply_markup: replyMarkup,
            });
            break;
          case "animation":
            sentMsg = await ctx.api.sendAnimation(ctx.chat!.id, settings.welcomeMediaId, {
              caption: messageText, parse_mode: "HTML", reply_markup: replyMarkup,
            });
            break;
          case "video":
            sentMsg = await ctx.api.sendVideo(ctx.chat!.id, settings.welcomeMediaId, {
              caption: messageText, parse_mode: "HTML", reply_markup: replyMarkup,
            });
            break;
          case "document":
            sentMsg = await ctx.api.sendDocument(ctx.chat!.id, settings.welcomeMediaId, {
              caption: messageText, parse_mode: "HTML", reply_markup: replyMarkup,
            });
            break;
          case "sticker":
            sentMsg = await ctx.api.sendSticker(ctx.chat!.id, settings.welcomeMediaId, {
              reply_markup: replyMarkup,
            });
            break;
          default:
            sentMsg = await ctx.api.sendMessage(ctx.chat!.id, messageText, {
              parse_mode: "HTML", reply_markup: replyMarkup,
            });
        }
      } else {
        sentMsg = await ctx.api.sendMessage(ctx.chat!.id, messageText, {
          parse_mode: "HTML",
          reply_markup: keyboard ?? undefined,
        });
      }

      // Store last welcome message ID for clean_welcome
      if (sentMsg && settings.cleanWelcome) {
        const db = getDatabase();
        await db.chat.update({
          where: { id: BigInt(ctx.chat!.id) },
          data: { lastWelcomeMessageId: sentMsg.message_id },
        });
      }
    } catch (err) {
      log.error({ err, chatId: ctx.chat!.id }, "Failed to send welcome message");
    }
  }

  // Member left
  if (
    (oldStatus === "member" || oldStatus === "restricted" || oldStatus === "administrator") &&
    (newStatus === "left" || newStatus === "kicked")
  ) {
    const user = update.old_chat_member.user;
    if (user.is_bot) return next();
    if (!ctx.chatSettings.chat.goodbyeEnabled) return next();

    const settings = ctx.chatSettings.chat;
    const template = settings.goodbyeText ?? "Goodbye {first}!";
    const chatTitle = ctx.chat!.title ?? "this group";
    const filledText = applyFillings(template, user, chatTitle);
    const { text: messageText, keyboard } = parseButtons(filledText);

    try {
      if (settings.goodbyeMediaType && settings.goodbyeMediaId) {
        const replyMarkup = keyboard ? keyboard : undefined;
        switch (settings.goodbyeMediaType) {
          case "photo":
            await ctx.api.sendPhoto(ctx.chat!.id, settings.goodbyeMediaId, {
              caption: messageText, parse_mode: "HTML", reply_markup: replyMarkup,
            });
            break;
          case "animation":
            await ctx.api.sendAnimation(ctx.chat!.id, settings.goodbyeMediaId, {
              caption: messageText, parse_mode: "HTML", reply_markup: replyMarkup,
            });
            break;
          case "video":
            await ctx.api.sendVideo(ctx.chat!.id, settings.goodbyeMediaId, {
              caption: messageText, parse_mode: "HTML", reply_markup: replyMarkup,
            });
            break;
          case "document":
            await ctx.api.sendDocument(ctx.chat!.id, settings.goodbyeMediaId, {
              caption: messageText, parse_mode: "HTML", reply_markup: replyMarkup,
            });
            break;
          default:
            await ctx.api.sendMessage(ctx.chat!.id, messageText, {
              parse_mode: "HTML", reply_markup: replyMarkup,
            });
        }
      } else {
        await ctx.api.sendMessage(ctx.chat!.id, messageText, {
          parse_mode: "HTML",
          reply_markup: keyboard ?? undefined,
        });
      }
    } catch (err) {
      log.error({ err, chatId: ctx.chat!.id }, "Failed to send goodbye message");
    }
  }

  return next();
});

export default composer;
