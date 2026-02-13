import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { resolveTarget, getArgsAfterUser } from "../bans/restriction.service.js";
import { userMention, escapeHtml } from "../../utils/message-builder.js";
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

// /approve - Make a user immune from automated actions
composer.command("approve", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to approve (reply or provide username/ID).");
    return;
  }

  const afterUser = ctx.message?.reply_to_message ? args : getArgsAfterUser(args);
  const reason = afterUser || undefined;

  const db = getDatabase();
  await db.approvedUser.upsert({
    where: {
      chatId_userId: {
        chatId: BigInt(ctx.chat!.id),
        userId: BigInt(target.id),
      },
    },
    create: {
      chatId: BigInt(ctx.chat!.id),
      userId: BigInt(target.id),
      reason,
    },
    update: { reason },
  });

  await ctx.reply(
    `${userMention(target.id, target.name)} has been approved.` +
    (reason ? ` Reason: ${escapeHtml(reason)}` : "") +
    `\nThey will be immune from automated actions (filters, antiflood, blocklists, etc.).`,
    { parse_mode: "HTML" }
  );

  await sendLogEntry(ctx, {
    category: "admin",
    action: "approve",
    actorId: BigInt(ctx.from!.id),
    actorName: ctx.from!.first_name,
    targetId: BigInt(target.id),
    targetName: target.name,
    details: reason,
  });
});

// /approval - Check if a user is approved
composer.command("approval", async (ctx) => {
  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to check (reply or provide username/ID).");
    return;
  }

  const db = getDatabase();
  const approval = await db.approvedUser.findUnique({
    where: {
      chatId_userId: {
        chatId: BigInt(ctx.chat!.id),
        userId: BigInt(target.id),
      },
    },
  });

  if (approval) {
    await ctx.reply(
      `${userMention(target.id, target.name)} is approved.` +
      (approval.reason ? `\nReason: ${escapeHtml(approval.reason)}` : ""),
      { parse_mode: "HTML" }
    );
  } else {
    await ctx.reply(
      `${userMention(target.id, target.name)} is <b>not</b> approved.`,
      { parse_mode: "HTML" }
    );
  }
});

// /approved - List all approved users
composer.command("approved", async (ctx) => {
  const db = getDatabase();
  const approved = await db.approvedUser.findMany({
    where: { chatId: BigInt(ctx.chat!.id) },
    include: { user: { select: { firstName: true, username: true } } },
  });

  if (approved.length === 0) {
    await ctx.reply("No approved users in this group.");
    return;
  }

  let text = `<b>Approved users (${approved.length}):</b>\n\n`;
  for (const a of approved) {
    const name = a.user?.firstName ?? "Unknown";
    const username = a.user?.username ? ` (@${a.user.username})` : "";
    text += ` - ${escapeHtml(name)}${username}`;
    if (a.reason) text += ` | <i>${escapeHtml(a.reason)}</i>`;
    text += "\n";
  }

  await ctx.reply(text, { parse_mode: "HTML" });
});

// /unapprove - Remove approval from a user
composer.command("unapprove", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = ctx.match as string;
  const target = await resolveTarget(ctx, args);
  if (!target) {
    await ctx.reply("Please specify a user to unapprove (reply or provide username/ID).");
    return;
  }

  const db = getDatabase();
  try {
    await db.approvedUser.delete({
      where: {
        chatId_userId: {
          chatId: BigInt(ctx.chat!.id),
          userId: BigInt(target.id),
        },
      },
    });

    await ctx.reply(
      `${userMention(target.id, target.name)} is no longer approved.`,
      { parse_mode: "HTML" }
    );

    await sendLogEntry(ctx, {
      category: "admin",
      action: "unapprove",
      actorId: BigInt(ctx.from!.id),
      actorName: ctx.from!.first_name,
      targetId: BigInt(target.id),
      targetName: target.name,
    });
  } catch {
    await ctx.reply("That user wasn't approved.");
  }
});

// /unapproveall - Remove all approvals (owner only)
composer.command("unapproveall", async (ctx) => {
  if (!ctx.permissions.isCreator) {
    await ctx.reply("Only the group creator can remove all approvals.");
    return;
  }

  const db = getDatabase();
  const result = await db.approvedUser.deleteMany({
    where: { chatId: BigInt(ctx.chat!.id) },
  });

  await ctx.reply(`Removed ${result.count} approval(s).`);
});

export default composer;
