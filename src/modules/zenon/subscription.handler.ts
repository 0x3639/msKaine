import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { requireZenon } from "./zenon.service.js";

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

// /zsub <type> [target] - Subscribe to Zenon events
composer.command("zsub", async (ctx) => {
  if (!requireAdmin(ctx)) return;
  if (!requireZenon(ctx)) return;

  const args = (ctx.match as string).trim().split(/\s+/);
  const subType = args[0]?.toLowerCase();

  if (!subType) {
    await ctx.reply(
      `<b>Zenon Subscriptions:</b>\n\n` +
      `Usage:\n` +
      `/zsub momentum - Subscribe to new momentums\n` +
      `/zsub address <z1_address> - Subscribe to address activity\n\n` +
      `Use /zunsub to manage subscriptions.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const validTypes = ["momentum", "address"];
  if (!validTypes.includes(subType)) {
    await ctx.reply(`Valid subscription types: ${validTypes.join(", ")}`);
    return;
  }

  const targetAddress = subType === "address" ? args[1] : null;
  if (subType === "address" && !targetAddress) {
    await ctx.reply("Usage: /zsub address <z1_address>");
    return;
  }

  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);

  await db.zenonSubscription.upsert({
    where: {
      chatId_subscriptionType_targetAddress: {
        chatId,
        subscriptionType: subType,
        targetAddress: targetAddress ?? "",
      },
    },
    create: {
      chatId,
      subscriptionType: subType,
      targetAddress: targetAddress ?? "",
      isActive: true,
    },
    update: { isActive: true },
  });

  await ctx.reply(
    `Subscribed to <b>${subType}</b>` +
    (targetAddress ? ` for <code>${targetAddress}</code>` : "") + ".",
    { parse_mode: "HTML" }
  );
});

// /zunsub [type] [target] - Unsubscribe or list subscriptions
composer.command("zunsub", async (ctx) => {
  if (!requireAdmin(ctx)) return;

  const args = (ctx.match as string).trim().split(/\s+/);
  const subType = args[0]?.toLowerCase();

  const db = getDatabase();
  const chatId = BigInt(ctx.chat!.id);

  if (!subType || subType === "list") {
    // List current subscriptions
    const subs = await db.zenonSubscription.findMany({
      where: { chatId, isActive: true },
    });

    if (subs.length === 0) {
      await ctx.reply("No active Zenon subscriptions.");
      return;
    }

    let text = `<b>Active Zenon subscriptions:</b>\n\n`;
    for (const sub of subs) {
      text += ` - <b>${sub.subscriptionType}</b>`;
      if (sub.targetAddress) text += ` (<code>${sub.targetAddress}</code>)`;
      text += "\n";
    }

    await ctx.reply(text, { parse_mode: "HTML" });
    return;
  }

  if (subType === "all") {
    const result = await db.zenonSubscription.updateMany({
      where: { chatId, isActive: true },
      data: { isActive: false },
    });
    await ctx.reply(`Unsubscribed from ${result.count} subscription(s).`);
    return;
  }

  const targetAddress = args[1] ?? "";
  await db.zenonSubscription.updateMany({
    where: { chatId, subscriptionType: subType, targetAddress, isActive: true },
    data: { isActive: false },
  });

  await ctx.reply(`Unsubscribed from <b>${subType}</b>.`, { parse_mode: "HTML" });
});

export default composer;
