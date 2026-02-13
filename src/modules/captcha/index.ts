import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml } from "../../utils/message-builder.js";
import { parseDuration, formatDuration } from "../../utils/time-parser.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("captcha");

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

// /captcha on|off
composer.command("captcha", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    const settings = ctx.chatSettings?.chat;
    const status = settings?.captchaEnabled ? "enabled" : "disabled";
    const mode = settings?.captchaMode ?? "BUTTON";
    await ctx.reply(
      `<b>CAPTCHA Settings</b>\n\n` +
      `Status: <b>${status}</b>\n` +
      `Mode: <b>${mode.toLowerCase()}</b>\n` +
      `Kick on fail: <b>${settings?.captchaKick ? "yes" : "no"}</b>\n` +
      `Kick timer: <b>${formatDuration(settings?.captchaKickTime ?? 120)}</b>\n` +
      `Rules required: <b>${settings?.captchaRules ? "yes" : "no"}</b>\n\n` +
      `Usage: /captcha on|off`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { captchaEnabled: arg === "on" },
  });

  await ctx.reply(`CAPTCHA verification ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /captchamode <mode>
composer.command("captchamode", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const mode = (ctx.match as string).trim().toLowerCase();
  const validModes: Record<string, string> = { button: "BUTTON", text: "TEXT", math: "MATH", custom: "CUSTOM" };

  if (!validModes[mode]) {
    await ctx.reply("Valid modes: button, text, math, custom");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { captchaMode: validModes[mode] as any },
  });

  await ctx.reply(`CAPTCHA mode set to <b>${mode}</b>.`, { parse_mode: "HTML" });
});

// /setcaptchatext <text>
composer.command("setcaptchatext", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const text = (ctx.match as string).trim();
  if (!text) {
    await ctx.reply("Usage: /setcaptchatext <button text>");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { captchaText: text },
  });

  await ctx.reply(`CAPTCHA button text set to: "${text}"`);
});

// /resetcaptchatext
composer.command("resetcaptchatext", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { captchaText: null },
  });

  await ctx.reply("CAPTCHA button text reset to default.");
});

// /captchakick on|off
composer.command("captchakick", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /captchakick on|off");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { captchaKick: arg === "on" },
  });

  await ctx.reply(`CAPTCHA kick ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /captchakicktime <time>
composer.command("captchakicktime", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const duration = parseDuration((ctx.match as string).trim());
  if (!duration || duration < 300 || duration > 86400) {
    await ctx.reply("Duration must be between 5m and 1d. Example: /captchakicktime 10m");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { captchaKickTime: duration },
  });

  await ctx.reply(`CAPTCHA kick timer set to <b>${formatDuration(duration)}</b>.`, { parse_mode: "HTML" });
});

// /captcharules on|off
composer.command("captcharules", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /captcharules on|off");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { captchaRules: arg === "on" },
  });

  await ctx.reply(`Rules acceptance during CAPTCHA ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /captchamutetime <time|off>
composer.command("captchamutetime", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg === "off") {
    const db = getDatabase();
    await db.chat.update({
      where: { id: BigInt(ctx.chat!.id) },
      data: { captchaMuteTime: 0 },
    });
    await ctx.reply("CAPTCHA auto-unmute disabled.");
    return;
  }

  const duration = parseDuration(arg);
  if (!duration) {
    await ctx.reply("Usage: /captchamutetime <time> or /captchamutetime off");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { captchaMuteTime: duration },
  });

  await ctx.reply(`CAPTCHA auto-unmute set to <b>${formatDuration(duration)}</b>.`, { parse_mode: "HTML" });
});

// Handle new chat members - send CAPTCHA challenge
composer.on("chat_member", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded) return next();
  if (!ctx.chatSettings.chat.captchaEnabled) return next();

  const update = ctx.chatMember;
  if (!update) return next();

  // Only trigger on new joins
  const oldStatus = update.old_chat_member.status;
  const newStatus = update.new_chat_member.status;

  if (
    (oldStatus === "left" || oldStatus === "kicked") &&
    (newStatus === "member" || newStatus === "restricted")
  ) {
    const user = update.new_chat_member.user;
    if (user.is_bot) return next();

    const chatId = BigInt(ctx.chat!.id);
    const db = getDatabase();
    const settings = ctx.chatSettings.chat;

    // Mute the user until they solve the CAPTCHA
    try {
      await ctx.api.restrictChatMember(ctx.chat!.id, user.id, {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
      });
    } catch {
      log.warn({ chatId: ctx.chat!.id, userId: user.id }, "Failed to mute for CAPTCHA");
    }

    let answer: string | null = null;
    let challengeText: string;
    const buttonText = settings.captchaText ?? "Click here to prove you're human";

    switch (settings.captchaMode) {
      case "MATH": {
        const a = Math.floor(Math.random() * 20) + 1;
        const b = Math.floor(Math.random() * 20) + 1;
        answer = String(a + b);
        challengeText = `Welcome ${escapeHtml(user.first_name)}! Please solve: <b>${a} + ${b} = ?</b>\nSend the answer in the chat.`;
        break;
      }
      case "TEXT": {
        answer = Math.random().toString(36).substring(2, 8);
        challengeText = `Welcome ${escapeHtml(user.first_name)}! Please type: <code>${answer}</code>`;
        break;
      }
      default: {
        // BUTTON mode
        challengeText = `Welcome ${escapeHtml(user.first_name)}! Please click the button below to verify.`;
        break;
      }
    }

    const keyboard = new InlineKeyboard();
    if (settings.captchaMode === "BUTTON" || settings.captchaMode === "CUSTOM") {
      keyboard.text(buttonText, `captcha:${user.id}`);
    }

    const msg = await ctx.api.sendMessage(ctx.chat!.id, challengeText, {
      parse_mode: "HTML",
      reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined,
    });

    // Store pending CAPTCHA
    const expiresAt = new Date(Date.now() + (settings.captchaKickTime * 1000));
    await db.captchaPending.upsert({
      where: { chatId_userId: { chatId, userId: BigInt(user.id) } },
      create: {
        chatId,
        userId: BigInt(user.id),
        messageId: msg.message_id,
        answer,
        expiresAt,
      },
      update: {
        messageId: msg.message_id,
        answer,
        expiresAt,
      },
    });

    // Schedule kick if CAPTCHA not solved
    if (settings.captchaKick) {
      await db.scheduledAction.create({
        data: {
          chatId,
          userId: BigInt(user.id),
          actionType: "captcha_kick",
          executeAt: expiresAt,
        },
      });
    }
  }

  return next();
});

// Handle button CAPTCHA callback
composer.callbackQuery(/^captcha:(\d+)$/, async (ctx) => {
  const expectedUserId = ctx.match![1];

  if (String(ctx.from.id) !== expectedUserId) {
    await ctx.answerCallbackQuery({ text: "This isn't for you!", show_alert: true });
    return;
  }

  await solveCaptcha(ctx, BigInt(ctx.from.id));
  await ctx.answerCallbackQuery({ text: "Verified! Welcome!" });
});

// Handle text/math CAPTCHA answers
composer.on("message:text", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded || !ctx.from) return next();
  if (!ctx.chatSettings.chat.captchaEnabled) return next();

  const db = getDatabase();
  const pending = await db.captchaPending.findUnique({
    where: {
      chatId_userId: {
        chatId: BigInt(ctx.chat!.id),
        userId: BigInt(ctx.from.id),
      },
    },
  });

  if (!pending || !pending.answer) return next();

  // Check answer
  if (ctx.message.text.trim() === pending.answer) {
    await solveCaptcha(ctx, BigInt(ctx.from.id));
    // Delete the answer message
    try { await ctx.deleteMessage(); } catch { /* ignore */ }
  } else {
    // Wrong answer - delete and let them try again
    try { await ctx.deleteMessage(); } catch { /* ignore */ }
  }

  return; // Don't process further for pending CAPTCHA users
});

async function solveCaptcha(ctx: BotContext, userId: bigint): Promise<void> {
  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);

  const pending = await db.captchaPending.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });

  if (!pending) return;

  // Unmute the user
  try {
    await ctx.api.restrictChatMember(ctx.chat!.id, Number(userId), {
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
    });
  } catch { /* ignore */ }

  // Delete the CAPTCHA message
  if (pending.messageId) {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, pending.messageId);
    } catch { /* ignore */ }
  }

  // Remove pending record
  await db.captchaPending.delete({ where: { id: pending.id } });

  // Cancel the scheduled kick
  await db.scheduledAction.updateMany({
    where: {
      chatId,
      userId,
      actionType: "captcha_kick",
      completed: false,
    },
    data: { completed: true },
  });
}

export default composer;
