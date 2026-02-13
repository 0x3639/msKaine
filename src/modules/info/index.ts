import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { escapeHtml, userMention } from "../../utils/message-builder.js";
import { resolveUser } from "../../utils/user-resolver.js";

const composer = new Composer<BotContext>();

// /id - Get IDs
composer.command("id", async (ctx) => {
  let text = "";

  if (ctx.message?.reply_to_message) {
    const reply = ctx.message.reply_to_message;
    const from = reply.from;
    if (from) {
      text += `Replied user ID: <code>${from.id}</code>\n`;
    }
    if (reply.forward_origin && "sender_user" in reply.forward_origin) {
      text += `Original sender ID: <code>${(reply.forward_origin as any).sender_user.id}</code>\n`;
    }
    if (reply.sender_chat) {
      text += `Sender chat ID: <code>${reply.sender_chat.id}</code>\n`;
    }
  } else if (ctx.from) {
    text += `Your ID: <code>${ctx.from.id}</code>\n`;
  }

  if (ctx.chat) {
    text += `Chat ID: <code>${ctx.chat.id}</code>\n`;
  }

  if (ctx.message?.message_thread_id) {
    text += `Thread ID: <code>${ctx.message.message_thread_id}</code>\n`;
  }

  await ctx.reply(text.trim() || "No ID information available.", { parse_mode: "HTML" });
});

// /info [user] - Get user info
composer.command("info", async (ctx) => {
  const target = await resolveUser(ctx, ctx.match as string);
  if (!target) {
    // Show own info
    if (!ctx.from) return;

    const text = buildUserInfo(ctx.from.id, ctx.from.first_name, ctx.from.last_name, ctx.from.username);
    await ctx.reply(text, { parse_mode: "HTML" });
    return;
  }

  try {
    const member = await ctx.api.getChatMember(ctx.chat!.id, Number(target.id));
    const user = member.user;

    let text = buildUserInfo(user.id, user.first_name, user.last_name, user.username);
    text += `\nStatus: <b>${member.status}</b>`;

    if ("custom_title" in member && member.custom_title) {
      text += `\nTitle: <b>${escapeHtml(member.custom_title)}</b>`;
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch {
    // User not in chat or can't resolve - show basic info
    const text = `${userMention(Number(target.id), target.firstName ?? "User")}\nID: <code>${Number(target.id)}</code>`;
    await ctx.reply(text, { parse_mode: "HTML" });
  }
});

function buildUserInfo(id: number, firstName: string, lastName?: string, username?: string): string {
  let text = `<b>User info:</b>\n\n`;
  text += `ID: <code>${id}</code>\n`;
  text += `First name: ${escapeHtml(firstName)}\n`;
  if (lastName) text += `Last name: ${escapeHtml(lastName)}\n`;
  if (username) text += `Username: @${escapeHtml(username)}\n`;
  text += `Link: ${userMention(id, firstName)}\n`;
  return text;
}

export default composer;
