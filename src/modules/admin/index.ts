import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { refreshAdminCache } from "./admin.service.js";
import { escapeHtml, userMention } from "../../utils/message-builder.js";
import { sendLogEntry } from "../../middleware/log-channel.middleware.js";

const composer = new Composer<BotContext>();

// /promote - Promote a user to admin
composer.command("promote", async (ctx) => {
  if (!ctx.permissions.isAdmin) {
    if (ctx.chatSettings?.chat?.adminError) {
      await ctx.reply("You need to be an admin to use this command.");
    }
    return;
  }

  const reply = ctx.message?.reply_to_message;
  const args = ctx.match as string;
  let targetId: number | undefined;
  let targetName = "User";

  if (reply?.from) {
    targetId = reply.from.id;
    targetName = reply.from.first_name;
  } else if (args) {
    const target = args.trim().split(/\s+/)[0];
    if (target.startsWith("@")) {
      try {
        const chat = await ctx.api.getChat(target);
        if (chat.type === "private") {
          targetId = chat.id;
          targetName = chat.first_name ?? "User";
        }
      } catch {
        await ctx.reply("I can't find that user.");
        return;
      }
    } else {
      const num = parseInt(target, 10);
      if (!isNaN(num) && num > 0) targetId = num;
    }
  }

  if (!targetId) {
    await ctx.reply("Please specify a user to promote (reply or provide username/ID).");
    return;
  }

  try {
    await ctx.api.promoteChatMember(ctx.chat!.id, targetId, {
      can_change_info: true,
      can_delete_messages: true,
      can_invite_users: true,
      can_restrict_members: true,
      can_pin_messages: true,
      can_manage_video_chats: true,
      can_manage_chat: true,
    });

    await ctx.reply(
      `${userMention(targetId, targetName)} has been promoted!`,
      { parse_mode: "HTML" }
    );

    await sendLogEntry(ctx, {
      category: "admin",
      action: "promote",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
      targetId: BigInt(targetId),
      targetName,
    });

    // Refresh admin cache
    await refreshAdminCache(ctx);
  } catch {
    await ctx.reply("Failed to promote that user. Make sure I have the right permissions.");
  }
});

// /demote - Demote an admin
composer.command("demote", async (ctx) => {
  if (!ctx.permissions.isAdmin) {
    if (ctx.chatSettings?.chat?.adminError) {
      await ctx.reply("You need to be an admin to use this command.");
    }
    return;
  }

  const reply = ctx.message?.reply_to_message;
  const args = ctx.match as string;
  let targetId: number | undefined;
  let targetName = "User";

  if (reply?.from) {
    targetId = reply.from.id;
    targetName = reply.from.first_name;
  } else if (args) {
    const target = args.trim().split(/\s+/)[0];
    if (target.startsWith("@")) {
      try {
        const chat = await ctx.api.getChat(target);
        if (chat.type === "private") {
          targetId = chat.id;
          targetName = chat.first_name ?? "User";
        }
      } catch {
        await ctx.reply("I can't find that user.");
        return;
      }
    } else {
      const num = parseInt(target, 10);
      if (!isNaN(num) && num > 0) targetId = num;
    }
  }

  if (!targetId) {
    await ctx.reply("Please specify an admin to demote (reply or provide username/ID).");
    return;
  }

  try {
    await ctx.api.promoteChatMember(ctx.chat!.id, targetId, {
      can_change_info: false,
      can_delete_messages: false,
      can_invite_users: false,
      can_restrict_members: false,
      can_pin_messages: false,
      can_promote_members: false,
      can_manage_video_chats: false,
      can_manage_chat: false,
    });

    await ctx.reply(
      `${userMention(targetId, targetName)} has been demoted.`,
      { parse_mode: "HTML" }
    );

    await sendLogEntry(ctx, {
      category: "admin",
      action: "demote",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
      targetId: BigInt(targetId),
      targetName,
    });

    await refreshAdminCache(ctx);
  } catch {
    await ctx.reply("Failed to demote that user. Make sure I have the right permissions.");
  }
});

// /adminlist - List all admins
composer.command("adminlist", async (ctx) => {
  try {
    const admins = await ctx.api.getChatAdministrators(ctx.chat!.id);

    const creator = admins.find((a) => a.status === "creator");
    const adminList = admins.filter((a) => a.status === "administrator" && !a.is_anonymous);
    const anonCount = admins.filter(
      (a) => a.status === "administrator" && a.is_anonymous
    ).length;

    let text = `<b>Admins in ${escapeHtml(ctx.chat!.title ?? "this chat")}</b>\n\n`;

    if (creator) {
      text += `<b>Creator:</b>\n`;
      text += ` - ${escapeHtml(creator.user.first_name)}`;
      if (creator.user.username) text += ` (@${escapeHtml(creator.user.username)})`;
      text += "\n\n";
    }

    if (adminList.length > 0) {
      text += `<b>Admins:</b>\n`;
      for (const admin of adminList) {
        text += ` - ${escapeHtml(admin.user.first_name)}`;
        if (admin.user.username) text += ` (@${escapeHtml(admin.user.username)})`;
        if (admin.status === "administrator" && admin.custom_title) {
          text += ` | <i>${escapeHtml(admin.custom_title)}</i>`;
        }
        text += "\n";
      }
    }

    if (anonCount > 0) {
      text += `\n<i>${anonCount} anonymous admin(s) hidden.</i>`;
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch {
    await ctx.reply("Failed to get the admin list.");
  }
});

// /adminerror on|off - Toggle error messages for non-admin commands
composer.command("adminerror", async (ctx) => {
  if (!ctx.permissions.isAdmin) return;

  const args = (ctx.match as string).trim().toLowerCase();
  if (args !== "on" && args !== "off") {
    const current = ctx.chatSettings?.chat?.adminError ? "enabled" : "disabled";
    await ctx.reply(`Admin error messages are currently <b>${current}</b>.\nUsage: /adminerror on|off`, { parse_mode: "HTML" });
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { adminError: args === "on" },
  });

  await ctx.reply(`Admin error messages ${args === "on" ? "enabled" : "disabled"}.`);
});

// /anonadmin on|off - Toggle anonymous admin handling
composer.command("anonadmin", async (ctx) => {
  if (!ctx.permissions.isCreator) {
    await ctx.reply("Only the group creator can change this setting.");
    return;
  }

  const args = (ctx.match as string).trim().toLowerCase();
  if (args !== "on" && args !== "off") {
    const current = ctx.chatSettings?.chat?.anonAdmin ? "enabled" : "disabled";
    await ctx.reply(
      `Anonymous admin mode is currently <b>${current}</b>.\n` +
      `When enabled, all anonymous admins are assumed to have all permissions.\n` +
      `Usage: /anonadmin on|off`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { anonAdmin: args === "on" },
  });

  await ctx.reply(
    `Anonymous admin mode ${args === "on" ? "enabled" : "disabled"}.` +
    (args === "on" ? "\n⚠️ This is not recommended for security reasons." : "")
  );
});

// /admincache - Force refresh admin list cache
composer.command("admincache", async (ctx) => {
  if (!ctx.permissions.isAdmin) return;

  try {
    await refreshAdminCache(ctx);
    await ctx.reply("Admin cache refreshed successfully.");
  } catch {
    await ctx.reply("Failed to refresh the admin cache.");
  }
});

export default composer;
