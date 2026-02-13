import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { escapeHtml } from "../../utils/message-builder.js";
import { requireZenon, getUserAddress, formatAmount } from "./zenon.service.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("zenon:pillar");

const composer = new Composer<BotContext>();

// /zpillar <name> - Get pillar info
composer.command("zpillar", async (ctx) => {
  if (!requireZenon(ctx)) return;

  const name = (ctx.match as string).trim();
  if (!name) {
    await ctx.reply("Usage: /zpillar <pillar_name>");
    return;
  }

  try {
    const pillar = await ctx.zenon.embedded.pillar.getByName(name);
    if (!pillar) {
      await ctx.reply("Pillar not found.");
      return;
    }

    await ctx.reply(
      `<b>Pillar: ${escapeHtml(pillar.name)}</b>\n\n` +
      `Rank: <b>#${pillar.rank + 1}</b>\n` +
      `Weight: <b>${formatAmount(pillar.weight)}</b> ZNN\n` +
      `Owner: <code>${pillar.ownerAddress}</code>\n` +
      `Producer: <code>${pillar.producerAddress}</code>\n` +
      `Reward: <code>${pillar.withdrawAddress}</code>\n` +
      `Momentum reward: <b>${pillar.giveMomentumRewardPercentage}%</b>\n` +
      `Delegate reward: <b>${pillar.giveDelegateRewardPercentage}%</b>\n` +
      `Revocable: <b>${pillar.isRevocable ? "yes" : "no"}</b>`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    log.error({ err, name }, "Failed to get pillar info");
    await ctx.reply("Failed to fetch pillar info.");
  }
});

// /zpillars [page] - List all pillars
composer.command("zpillars", async (ctx) => {
  if (!requireZenon(ctx)) return;

  try {
    const page = parseInt((ctx.match as string).trim(), 10) || 0;
    const result = await ctx.zenon.embedded.pillar.getAll(page, 15);

    if (!result || !result.list || result.list.length === 0) {
      await ctx.reply("No pillars found.");
      return;
    }

    let text = `<b>Pillars (page ${page}, total: ${result.count}):</b>\n\n`;
    for (const pillar of result.list) {
      text += `#${pillar.rank + 1} <b>${escapeHtml(pillar.name)}</b> - ${formatAmount(pillar.weight)} ZNN\n`;
    }

    if (result.count > (page + 1) * 15) {
      text += `\nNext page: /zpillars ${page + 1}`;
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    log.error({ err }, "Failed to list pillars");
    await ctx.reply("Failed to fetch pillar list.");
  }
});

// /zdelegate <pillarName> - Delegate to a pillar (requires linked wallet + bot wallet)
composer.command("zdelegate", async (ctx) => {
  if (!requireZenon(ctx)) return;

  const name = (ctx.match as string).trim();
  if (!name) {
    // Show current delegation
    const address = await getUserAddress(BigInt(ctx.from!.id));
    if (!address) {
      await ctx.reply("No wallet linked. Use /zwallet to link your address.\nUsage: /zdelegate <pillar_name>");
      return;
    }

    try {
      const { Address } = await import("znn-typescript-sdk");
      const delegation = await ctx.zenon.embedded.pillar.getDelegatedPillar(Address.parse(address));

      if (!delegation || !delegation.name) {
        await ctx.reply("You are not currently delegating to any pillar.");
      } else {
        await ctx.reply(
          `Currently delegating to: <b>${escapeHtml(delegation.name)}</b>\n` +
          `Weight: <b>${formatAmount(delegation.weight)}</b> ZNN\n` +
          `Active: <b>${delegation.isPillarActive() ? "yes" : "no"}</b>`,
          { parse_mode: "HTML" }
        );
      }
    } catch (err) {
      log.error({ err }, "Failed to get delegation info");
      await ctx.reply("Failed to fetch delegation info.");
    }
    return;
  }

  await ctx.reply(
    `To delegate to <b>${escapeHtml(name)}</b>, use syrius wallet or the CLI.\n` +
    `This bot displays delegation info but cannot delegate on your behalf for security.`,
    { parse_mode: "HTML" }
  );
});

// /zrewards [address] - Show uncollected rewards
composer.command("zrewards", async (ctx) => {
  if (!requireZenon(ctx)) return;

  let addressStr = (ctx.match as string).trim();
  if (!addressStr) {
    const linked = await getUserAddress(BigInt(ctx.from!.id));
    if (!linked) {
      await ctx.reply("No address specified and no wallet linked.\nUsage: /zrewards <address>");
      return;
    }
    addressStr = linked;
  }

  try {
    const { Address } = await import("znn-typescript-sdk");
    const address = Address.parse(addressStr);

    const [pillarRewards, stakeRewards] = await Promise.all([
      ctx.zenon.embedded.pillar.getUncollectedReward(address).catch(() => null),
      ctx.zenon.embedded.stake.getUncollectedReward(address).catch(() => null),
    ]);

    let text = `<b>Uncollected Rewards for</b> <code>${addressStr}</code>\n\n`;

    if (pillarRewards) {
      text += `<b>Delegation rewards:</b>\n`;
      text += `  ZNN: <b>${formatAmount(pillarRewards.znnAmount ?? 0)}</b>\n`;
      text += `  QSR: <b>${formatAmount(pillarRewards.qsrAmount ?? 0)}</b>\n`;
    }

    if (stakeRewards) {
      text += `\n<b>Staking rewards:</b>\n`;
      text += `  QSR: <b>${formatAmount(stakeRewards.qsrAmount ?? 0)}</b>\n`;
    }

    if (!pillarRewards && !stakeRewards) {
      text += "No rewards data available.";
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    log.error({ err, address: addressStr }, "Failed to get rewards");
    await ctx.reply("Failed to fetch rewards info.");
  }
});

export default composer;
