import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { requireZenon, getUserAddress, formatAmount } from "./zenon.service.js";
import { createChildLogger } from "../../core/logger.js";
import { formatDuration } from "../../utils/time-parser.js";

const log = createChildLogger("zenon:stake");

const composer = new Composer<BotContext>();

// /zstakes [address] - Show staking entries
composer.command("zstakes", async (ctx) => {
  if (!requireZenon(ctx)) return;

  let addressStr = (ctx.match as string).trim();
  if (!addressStr) {
    const linked = await getUserAddress(BigInt(ctx.from!.id));
    if (!linked) {
      await ctx.reply("No address specified and no wallet linked.\nUsage: /zstakes <address>");
      return;
    }
    addressStr = linked;
  }

  try {
    const { Address } = await import("znn-typescript-sdk");
    const address = Address.parse(addressStr);
    const result = await ctx.zenon.embedded.stake.getEntriesByAddress(address, 0, 20);

    if (!result || !result.list || result.list.length === 0) {
      await ctx.reply("No staking entries found for this address.");
      return;
    }

    let text = `<b>Staking entries for</b> <code>${addressStr}</code>\n`;
    text += `Total staked: <b>${formatAmount(result.totalAmount)}</b> ZNN\n\n`;

    for (const entry of result.list.slice(0, 10)) {
      const amount = formatAmount(entry.amount);
      const expiry = new Date(entry.expirationTimestamp * 1000);
      const isActive = expiry > new Date();

      text += `${isActive ? "🟢" : "🔴"} <b>${amount}</b> ZNN`;
      if (isActive) {
        const remaining = Math.floor((expiry.getTime() - Date.now()) / 1000);
        text += ` - expires in ${formatDuration(remaining)}`;
      } else {
        text += ` - expired`;
      }
      text += `\n  ID: <code>${entry.id}</code>\n`;
    }

    if (result.count > 10) {
      text += `\n... and ${result.count - 10} more entries`;
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    log.error({ err, address: addressStr }, "Failed to get staking entries");
    await ctx.reply("Failed to fetch staking info.");
  }
});

// /zstake - Info about staking
composer.command("zstake", async (ctx) => {
  await ctx.reply(
    `<b>Zenon Staking Info:</b>\n\n` +
    `Staking ZNN generates QSR rewards.\n` +
    `Minimum stake: 1 ZNN\n` +
    `Minimum duration: 30 days\n\n` +
    `To stake, use Syrius wallet or the CLI.\n` +
    `Use /zstakes to check your current stakes.`,
    { parse_mode: "HTML" }
  );
});

// /zunstake - Info about unstaking
composer.command("zunstake", async (ctx) => {
  await ctx.reply(
    `<b>Unstaking:</b>\n\n` +
    `Stakes automatically expire after the lock period.\n` +
    `Once expired, you can cancel and reclaim your ZNN.\n\n` +
    `To cancel expired stakes, use Syrius wallet or the CLI.\n` +
    `Use /zstakes to check expiration times.`,
    { parse_mode: "HTML" }
  );
});

export default composer;
