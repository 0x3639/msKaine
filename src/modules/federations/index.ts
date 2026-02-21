import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml, userMention } from "../../utils/message-builder.js";
import { resolveUser } from "../../utils/user-resolver.js";
import {
  getFederation,
  isFedAdmin,
  isFedOwner,
  getChatFederation,
  fedBanUser,
  isUserFedBanned,
} from "./federation.service.js";

const composer = new Composer<BotContext>();

// /newfed <name> - Create a new federation
composer.command("newfed", async (ctx) => {
  if (ctx.chat!.type !== "private") {
    await ctx.reply("Use this command in PM to create a federation.");
    return;
  }

  const name = (ctx.match as string).trim();
  if (!name) {
    await ctx.reply("Usage: /newfed <federation name>");
    return;
  }

  const db = getDatabase();
  const fed = await db.federation.create({
    data: { name, ownerId: BigInt(ctx.from!.id) },
  });

  await ctx.reply(
    `Federation <b>${escapeHtml(name)}</b> created!\n` +
    `ID: <code>${fed.id}</code>\n\n` +
    `Use /joinfed ${fed.id} in a group to add it.`,
    { parse_mode: "HTML" }
  );
});

// /renamefed <fedId> <newName> - Rename a federation
composer.command("renamefed", async (ctx) => {
  const args = (ctx.match as string).trim().split(/\s+/);
  if (args.length < 2) {
    await ctx.reply("Usage: /renamefed <fed_id> <new name>");
    return;
  }

  const fedId = args[0];
  const newName = args.slice(1).join(" ");

  if (!(await isFedOwner(fedId, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can rename it.");
    return;
  }

  const db = getDatabase();
  await db.federation.update({
    where: { id: fedId },
    data: { name: newName },
  });

  await ctx.reply(`Federation renamed to <b>${escapeHtml(newName)}</b>.`, { parse_mode: "HTML" });
});

// /delfed <fedId> - Delete a federation
composer.command("delfed", async (ctx) => {
  const fedId = (ctx.match as string).trim();
  if (!fedId) {
    await ctx.reply("Usage: /delfed <fed_id>");
    return;
  }

  if (!(await isFedOwner(fedId, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can delete it.");
    return;
  }

  const db = getDatabase();

  // Unlink all chats
  await db.chat.updateMany({
    where: { federationId: fedId },
    data: { federationId: null },
  });

  await db.federation.delete({ where: { id: fedId } });
  await ctx.reply("Federation deleted.");
});

// /fedinfo [fedId] - Show federation info
composer.command("fedinfo", async (ctx) => {
  let fedId = (ctx.match as string).trim();

  if (!fedId) {
    const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
    if (!chatFed) {
      await ctx.reply("This chat isn't in a federation. Provide a fed ID: /fedinfo <fed_id>");
      return;
    }
    fedId = chatFed.id;
  }

  const fed = await getFederation(fedId);
  if (!fed) {
    await ctx.reply("Federation not found.");
    return;
  }

  const db = getDatabase();
  const adminCount = await db.fedAdmin.count({ where: { federationId: fedId } });
  const banCount = await db.fedBan.count({ where: { federationId: fedId } });
  const chatCount = await db.chat.count({ where: { federationId: fedId } });
  const subCount = await db.fedSubscription.count({ where: { subscriberId: fedId } });

  await ctx.reply(
    `<b>Federation Info:</b>\n\n` +
    `Name: <b>${escapeHtml(fed.name)}</b>\n` +
    `ID: <code>${fed.id}</code>\n` +
    `Owner: <code>${fed.ownerId}</code>\n` +
    `Admins: <b>${adminCount}</b>\n` +
    `Bans: <b>${banCount}</b>\n` +
    `Chats: <b>${chatCount}</b>\n` +
    `Subscriptions: <b>${subCount}</b>\n` +
    `Reason required: <b>${fed.reasonRequired ? "yes" : "no"}</b>\n` +
    `Notify on ban: <b>${fed.notifyOnBan ? "yes" : "no"}</b>`,
    { parse_mode: "HTML" }
  );
});

// /fedadmins [fedId] - List federation admins
composer.command("fedadmins", async (ctx) => {
  let fedId = (ctx.match as string).trim();
  if (!fedId) {
    const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
    if (!chatFed) {
      await ctx.reply("This chat isn't in a federation.");
      return;
    }
    fedId = chatFed.id;
  }

  const fed = await getFederation(fedId);
  if (!fed) {
    await ctx.reply("Federation not found.");
    return;
  }

  const db = getDatabase();
  const admins = await db.fedAdmin.findMany({ where: { federationId: fedId } });

  let text = `<b>Federation admins for ${escapeHtml(fed.name)}:</b>\n\n`;
  text += `Owner: <code>${fed.ownerId}</code>\n`;
  for (const admin of admins) {
    text += `Admin: <code>${admin.userId}</code>\n`;
  }

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /chatfed - Show which federation this chat belongs to
composer.command("chatfed", async (ctx) => {
  const fed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!fed) {
    await ctx.reply("This chat isn't part of any federation.");
    return;
  }

  await ctx.reply(
    `This chat belongs to: <b>${escapeHtml(fed.name)}</b>\nID: <code>${fed.id}</code>`,
    { parse_mode: "HTML" }
  );
});

// /myfeds - List federations the user owns
composer.command("myfeds", async (ctx) => {
  const db = getDatabase();
  const feds = await db.federation.findMany({
    where: { ownerId: BigInt(ctx.from!.id) },
    orderBy: { createdAt: "desc" },
  });

  if (feds.length === 0) {
    await ctx.reply("You don't own any federations.");
    return;
  }

  let text = `<b>Your federations:</b>\n\n`;
  for (const fed of feds) {
    text += ` - <b>${escapeHtml(fed.name)}</b>\n   <code>${fed.id}</code>\n`;
  }

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /fedpromote <user> - Promote to fed admin
composer.command("fedpromote", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedOwner(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can promote admins.");
    return;
  }

  const target = await resolveUser(ctx, ctx.match as string);
  if (!target) {
    await ctx.reply("Usage: /fedpromote <user> (reply or username/ID)");
    return;
  }

  const db = getDatabase();
  await db.fedAdmin.upsert({
    where: { federationId_userId: { federationId: chatFed.id, userId: BigInt(Number(target.id)) } },
    create: { federationId: chatFed.id, userId: BigInt(Number(target.id)) },
    update: {},
  });

  await ctx.reply(
    `${userMention(Number(target.id), target.firstName ?? "User")} is now a federation admin.`,
    { parse_mode: "HTML" }
  );
});

// /feddemote <user> - Demote from fed admin
composer.command("feddemote", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedOwner(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can demote admins.");
    return;
  }

  const target = await resolveUser(ctx, ctx.match as string);
  if (!target) {
    await ctx.reply("Usage: /feddemote <user>");
    return;
  }

  const db = getDatabase();
  try {
    await db.fedAdmin.delete({
      where: { federationId_userId: { federationId: chatFed.id, userId: BigInt(Number(target.id)) } },
    });
    await ctx.reply(`${userMention(Number(target.id), target.firstName ?? "User")} demoted from federation admin.`, { parse_mode: "HTML" });
  } catch {
    await ctx.reply("That user isn't a federation admin.");
  }
});

// /feddemoteme - Self-demote from fed admin
composer.command("feddemoteme", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  const db = getDatabase();
  try {
    await db.fedAdmin.delete({
      where: { federationId_userId: { federationId: chatFed.id, userId: BigInt(ctx.from!.id) } },
    });
    await ctx.reply("You've demoted yourself from federation admin.");
  } catch {
    await ctx.reply("You're not a federation admin.");
  }
});

// /fedreason on|off - Require reason for fed bans
composer.command("fedreason", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedOwner(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can change this setting.");
    return;
  }

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /fedreason on|off");
    return;
  }

  const db = getDatabase();
  await db.federation.update({
    where: { id: chatFed.id },
    data: { reasonRequired: arg === "on" },
  });

  await ctx.reply(`Federation reason requirement ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /fednotif on|off - Toggle ban notifications
composer.command("fednotif", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedOwner(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can change this setting.");
    return;
  }

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /fednotif on|off");
    return;
  }

  const db = getDatabase();
  await db.federation.update({
    where: { id: chatFed.id },
    data: { notifyOnBan: arg === "on" },
  });

  await ctx.reply(`Federation ban notifications ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /setfedlog <chatId> - Set federation log channel
composer.command("setfedlog", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedOwner(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can set the log channel.");
    return;
  }

  const db = getDatabase();
  await db.federation.update({
    where: { id: chatFed.id },
    data: { logChannelId: BigInt(ctx.chat!.id) },
  });

  await ctx.reply("Federation log channel set to this chat.");
});

// /unsetfedlog - Remove federation log channel
composer.command("unsetfedlog", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedOwner(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can change this setting.");
    return;
  }

  const db = getDatabase();
  await db.federation.update({
    where: { id: chatFed.id },
    data: { logChannelId: null },
  });

  await ctx.reply("Federation log channel removed.");
});

// /fban <user> [reason] - Federation ban
composer.command("fban", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedAdmin(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("You need to be a federation admin to use this command.");
    return;
  }

  const target = await resolveUser(ctx, ctx.match as string);
  if (!target) {
    await ctx.reply("Usage: /fban <user> [reason]");
    return;
  }

  // Get reason from remaining args
  const raw = (ctx.match as string).trim();
  const parts = raw.split(/\s+/);
  const reason = parts.slice(1).join(" ") || undefined;

  if (chatFed.reasonRequired && !reason) {
    await ctx.reply("This federation requires a reason for bans.");
    return;
  }

  const result = await fedBanUser(chatFed.id, BigInt(Number(target.id)), BigInt(ctx.from!.id), reason);

  await ctx.reply(
    `${userMention(Number(target.id), target.firstName ?? "User")} has been federation banned.\n` +
    `Fed: <b>${escapeHtml(chatFed.name)}</b>\n` +
    (reason ? `Reason: ${escapeHtml(reason)}\n` : "") +
    `Affected chats: ${result.bannedInChats}`,
    { parse_mode: "HTML" }
  );

  // Ban in all fed chats
  const db = getDatabase();
  const fedChats = await db.chat.findMany({
    where: { federationId: chatFed.id },
    select: { id: true },
  });

  for (const chat of fedChats) {
    try {
      await ctx.api.banChatMember(Number(chat.id), Number(target.id));
    } catch { /* ignore - bot might not be admin */ }
  }

  // Log to federation log channel
  if (chatFed.logChannelId) {
    try {
      await ctx.api.sendMessage(
        Number(chatFed.logChannelId),
        `<b>Federation Ban</b>\n` +
        `Fed: ${escapeHtml(chatFed.name)}\n` +
        `User: ${userMention(Number(target.id), target.firstName ?? "User")}\n` +
        `By: ${userMention(ctx.from!.id, ctx.from!.first_name)}\n` +
        (reason ? `Reason: ${escapeHtml(reason)}` : ""),
        { parse_mode: "HTML" }
      );
    } catch { /* ignore */ }
  }
});

// /unfban <user> - Federation unban
composer.command("unfban", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedAdmin(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("You need to be a federation admin.");
    return;
  }

  const target = await resolveUser(ctx, ctx.match as string);
  if (!target) {
    await ctx.reply("Usage: /unfban <user>");
    return;
  }

  const db = getDatabase();
  try {
    await db.fedBan.delete({
      where: { federationId_userId: { federationId: chatFed.id, userId: BigInt(Number(target.id)) } },
    });
  } catch {
    await ctx.reply("That user isn't federation banned.");
    return;
  }

  await ctx.reply(
    `${userMention(Number(target.id), target.firstName ?? "User")} has been federation unbanned.`,
    { parse_mode: "HTML" }
  );

  // Unban in all fed chats
  const fedChats = await db.chat.findMany({
    where: { federationId: chatFed.id },
    select: { id: true },
  });

  for (const chat of fedChats) {
    try {
      await ctx.api.unbanChatMember(Number(chat.id), Number(target.id), { only_if_banned: true });
    } catch { /* ignore */ }
  }
});

// /fbanlist [fedId] - Export fed ban list
composer.command("fbanlist", async (ctx) => {
  let fedId = (ctx.match as string).trim();
  if (!fedId) {
    const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
    if (!chatFed) {
      await ctx.reply("This chat isn't in a federation.");
      return;
    }
    fedId = chatFed.id;
  }

  if (!(await isFedAdmin(fedId, BigInt(ctx.from!.id)))) {
    await ctx.reply("You need to be a federation admin.");
    return;
  }

  const db = getDatabase();
  const bans = await db.fedBan.findMany({
    where: { federationId: fedId },
    select: { userId: true, reason: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (bans.length === 0) {
    await ctx.reply("No federation bans.");
    return;
  }

  let text = `<b>Federation bans (${bans.length}):</b>\n\n`;
  for (const ban of bans.slice(0, 50)) {
    text += `<code>${ban.userId}</code>`;
    if (ban.reason) text += ` - ${escapeHtml(ban.reason)}`;
    text += "\n";
  }
  if (bans.length > 50) text += `\n... and ${bans.length - 50} more`;

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /fedstat [user] - Check federation ban status
composer.command("fedstat", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  const target = await resolveUser(ctx, ctx.match as string);
  const userId = target ? BigInt(Number(target.id)) : BigInt(ctx.from!.id);
  const name = target ? target.firstName ?? "User" : ctx.from!.first_name;

  const db = getDatabase();
  const ban = await db.fedBan.findUnique({
    where: { federationId_userId: { federationId: chatFed.id, userId } },
  });

  if (ban) {
    await ctx.reply(
      `${userMention(Number(userId), name)} <b>is banned</b> in ${escapeHtml(chatFed.name)}.\n` +
      (ban.reason ? `Reason: ${escapeHtml(ban.reason)}` : ""),
      { parse_mode: "HTML" }
    );
  } else {
    await ctx.reply(
      `${userMention(Number(userId), name)} is <b>not banned</b> in ${escapeHtml(chatFed.name)}.`,
      { parse_mode: "HTML" }
    );
  }
});

// /fbanstat - Alias for /fedstat
composer.command("fbanstat", async (ctx) => {
  // Delegate to fedstat logic
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  const target = await resolveUser(ctx, ctx.match as string);
  const userId = target ? BigInt(Number(target.id)) : BigInt(ctx.from!.id);
  const name = target ? target.firstName ?? "User" : ctx.from!.first_name;

  const db = getDatabase();
  const ban = await db.fedBan.findUnique({
    where: { federationId_userId: { federationId: chatFed.id, userId } },
  });

  if (ban) {
    await ctx.reply(
      `${userMention(Number(userId), name)} <b>is banned</b> in ${escapeHtml(chatFed.name)}.\n` +
      (ban.reason ? `Reason: ${escapeHtml(ban.reason)}` : ""),
      { parse_mode: "HTML" }
    );
  } else {
    await ctx.reply(
      `${userMention(Number(userId), name)} is <b>not banned</b> in ${escapeHtml(chatFed.name)}.`,
      { parse_mode: "HTML" }
    );
  }
});

// /subfed <fedId> - Subscribe to another federation's bans
composer.command("subfed", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedOwner(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can manage subscriptions.");
    return;
  }

  const targetFedId = (ctx.match as string).trim();
  if (!targetFedId) {
    await ctx.reply("Usage: /subfed <federation_id>");
    return;
  }

  const targetFed = await getFederation(targetFedId);
  if (!targetFed) {
    await ctx.reply("Target federation not found.");
    return;
  }

  if (targetFedId === chatFed.id) {
    await ctx.reply("A federation can't subscribe to itself.");
    return;
  }

  const db = getDatabase();
  await db.fedSubscription.upsert({
    where: {
      subscriberId_subscribedToId: { subscriberId: chatFed.id, subscribedToId: targetFedId },
    },
    create: { subscriberId: chatFed.id, subscribedToId: targetFedId },
    update: {},
  });

  await ctx.reply(
    `Subscribed to <b>${escapeHtml(targetFed.name)}</b>. Their bans will now apply here.`,
    { parse_mode: "HTML" }
  );
});

// /unsubfed <fedId> - Unsubscribe from a federation
composer.command("unsubfed", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedOwner(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can manage subscriptions.");
    return;
  }

  const targetFedId = (ctx.match as string).trim();
  if (!targetFedId) {
    await ctx.reply("Usage: /unsubfed <federation_id>");
    return;
  }

  const db = getDatabase();
  try {
    await db.fedSubscription.delete({
      where: {
        subscriberId_subscribedToId: { subscriberId: chatFed.id, subscribedToId: targetFedId },
      },
    });
    await ctx.reply("Unsubscribed from federation.");
  } catch {
    await ctx.reply("You're not subscribed to that federation.");
  }
});

// /fedsubs - List subscriptions
composer.command("fedsubs", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  const db = getDatabase();
  const subs = await db.fedSubscription.findMany({
    where: { subscriberId: chatFed.id },
    include: { subscribedTo: { select: { name: true, id: true } } },
  });

  if (subs.length === 0) {
    await ctx.reply("This federation has no subscriptions.");
    return;
  }

  let text = `<b>Federation subscriptions:</b>\n\n`;
  for (const sub of subs) {
    text += ` - <b>${escapeHtml(sub.subscribedTo.name)}</b>\n   <code>${sub.subscribedTo.id}</code>\n`;
  }

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /joinfed <fedId> - Join a federation
composer.command("joinfed", async (ctx) => {
  if (!ctx.permissions.isCreator) {
    await ctx.reply("Only the group creator can join a federation.");
    return;
  }

  const fedId = (ctx.match as string).trim();
  if (!fedId) {
    await ctx.reply("Usage: /joinfed <federation_id>");
    return;
  }

  const fed = await getFederation(fedId);
  if (!fed) {
    await ctx.reply("Federation not found.");
    return;
  }

  // Check if already in a fed
  const currentFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (currentFed) {
    await ctx.reply(
      `This chat is already in federation <b>${escapeHtml(currentFed.name)}</b>.\n` +
      `Use /leavefed first to leave.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { federationId: fedId },
  });

  await ctx.reply(`Joined federation <b>${escapeHtml(fed.name)}</b>.`, { parse_mode: "HTML" });
});

// /leavefed - Leave the current federation
composer.command("leavefed", async (ctx) => {
  if (!ctx.permissions.isCreator) {
    await ctx.reply("Only the group creator can leave a federation.");
    return;
  }

  const currentFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!currentFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { federationId: null },
  });

  await ctx.reply(`Left federation <b>${escapeHtml(currentFed.name)}</b>.`, { parse_mode: "HTML" });
});

// /quietfed on|off - Toggle quiet fed ban notifications
composer.command("quietfed", async (ctx) => {
  if (!ctx.permissions.isAdmin) {
    return;
  }

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /quietfed on|off");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { quietFed: arg === "on" },
  });

  await ctx.reply(`Quiet fed mode ${arg === "on" ? "enabled" : "disabled"}.`);
});

// /importfbans - Import bans from a file (placeholder)
composer.command("importfbans", async (ctx) => {
  const chatFed = await getChatFederation(BigInt(ctx.chat!.id));
  if (!chatFed) {
    await ctx.reply("This chat isn't in a federation.");
    return;
  }

  if (!(await isFedOwner(chatFed.id, BigInt(ctx.from!.id)))) {
    await ctx.reply("Only the federation owner can import bans.");
    return;
  }

  if (!ctx.message?.reply_to_message?.document) {
    await ctx.reply("Reply to a JSON file with ban data to import.\nFormat: [{\"user_id\": 123, \"reason\": \"spam\"}]");
    return;
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_IMPORT_BANS = 10_000;
  const doc = ctx.message.reply_to_message.document;

  if (doc.file_size && doc.file_size > MAX_FILE_SIZE) {
    await ctx.reply(`File too large (${(doc.file_size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`);
    return;
  }

  try {
    const file = await ctx.api.getFile(doc.file_id);
    const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(url);
    const text = await response.text();

    if (text.length > MAX_FILE_SIZE) {
      await ctx.reply("File content too large. Maximum is 5MB.");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      await ctx.reply("Invalid JSON file. Expected an array of objects.");
      return;
    }

    if (!Array.isArray(parsed)) {
      await ctx.reply("Invalid format. Expected a JSON array.");
      return;
    }

    const bans = parsed as Array<Record<string, unknown>>;

    if (bans.length > MAX_IMPORT_BANS) {
      await ctx.reply(`Too many entries (${bans.length}). Maximum is ${MAX_IMPORT_BANS.toLocaleString()}.`);
      return;
    }

    const db = getDatabase();
    let imported = 0;

    for (const ban of bans) {
      const userId = Number(ban.user_id);
      if (!userId || !Number.isFinite(userId) || userId <= 0) continue;
      const reason = typeof ban.reason === "string" ? ban.reason.slice(0, 500) : undefined;
      try {
        await db.fedBan.upsert({
          where: { federationId_userId: { federationId: chatFed.id, userId: BigInt(userId) } },
          create: {
            federationId: chatFed.id,
            userId: BigInt(userId),
            bannerId: BigInt(ctx.from!.id),
            reason,
          },
          update: { reason },
        });
        imported++;
      } catch { /* skip invalid entries */ }
    }

    await ctx.reply(`Imported ${imported} federation ban(s).`);
  } catch {
    await ctx.reply("Failed to import bans. Check the file format.");
  }
});

// /silentactions on|off - Toggle silent moderation actions
composer.command("silentactions", async (ctx) => {
  if (!ctx.permissions.isAdmin) {
    if (ctx.chatSettings?.chat?.adminError) {
      ctx.reply("You need to be an admin to use this command.").catch(() => {});
    }
    return;
  }

  const arg = (ctx.match as string).trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Usage: /silentactions on|off");
    return;
  }

  const db = getDatabase();
  await db.chat.update({
    where: { id: BigInt(ctx.chat!.id) },
    data: { silentActions: arg === "on" },
  });

  await ctx.reply(`Silent actions ${arg === "on" ? "enabled" : "disabled"}.`);
});

// Chat member handler: enforce federation bans on new joins
composer.on("chat_member", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded) return next();

  const update = ctx.chatMember;
  if (!update) return next();

  const oldStatus = update.old_chat_member.status;
  const newStatus = update.new_chat_member.status;

  // Only check on join
  if (
    !(
      (oldStatus === "left" || oldStatus === "kicked") &&
      (newStatus === "member" || newStatus === "restricted")
    )
  ) {
    return next();
  }

  const user = update.new_chat_member.user;
  if (user.is_bot) return next();

  const banInfo = await isUserFedBanned(BigInt(ctx.chat!.id), BigInt(user.id));
  if (!banInfo.banned) return next();

  // Ban the user
  try {
    await ctx.api.banChatMember(ctx.chat!.id, user.id);

    if (!ctx.chatSettings.chat.quietFed) {
      await ctx.api.sendMessage(
        ctx.chat!.id,
        `${userMention(user.id, user.first_name)} is federation banned` +
        (banInfo.fedName ? ` in <b>${escapeHtml(banInfo.fedName)}</b>` : "") +
        (banInfo.reason ? `.\nReason: ${escapeHtml(banInfo.reason)}` : "."),
        { parse_mode: "HTML" }
      );
    }
  } catch { /* ignore */ }

  return next();
});

export default composer;
