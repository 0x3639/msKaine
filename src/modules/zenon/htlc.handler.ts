import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { requireZenon, formatAmount } from "./zenon.service.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("zenon:htlc");

const composer = new Composer<BotContext>();

// /zhtlc <subcommand> - HTLC operations
composer.command("zhtlc", async (ctx) => {
  if (!requireZenon(ctx)) return;

  const args = (ctx.match as string).trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase();

  if (!subcommand || subcommand === "help") {
    await ctx.reply(
      `<b>HTLC Commands:</b>\n\n` +
      `/zhtlc info <id> - Get HTLC info\n` +
      `/zhtlc create - Info on creating HTLCs\n` +
      `/zhtlc unlock - Info on unlocking HTLCs`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (subcommand === "info") {
    const htlcId = args[1];
    if (!htlcId) {
      await ctx.reply("Usage: /zhtlc info <htlc_id>");
      return;
    }

    try {
      const { Hash } = await import("znn-typescript-sdk");
      const hash = Hash.parse(htlcId);
      const htlc = await ctx.zenon.embedded.htlc.getById(hash);

      if (!htlc) {
        await ctx.reply("HTLC not found.");
        return;
      }

      await ctx.reply(
        `<b>HTLC Info:</b>\n\n` +
        `ID: <code>${htlcId}</code>\n` +
        `Amount: <b>${formatAmount(htlc.amount)}</b>\n` +
        `Token: <code>${htlc.tokenStandard}</code>\n` +
        `Hash locked: <code>${htlc.hashLocked}</code>\n` +
        `Time locked: <code>${htlc.timeLocked}</code>\n` +
        `Expiration: <b>${new Date(htlc.expirationTime * 1000).toISOString()}</b>\n` +
        `Hash type: <b>${htlc.hashType}</b>`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      log.error({ err, htlcId }, "Failed to get HTLC info");
      await ctx.reply("Failed to fetch HTLC info. Check the ID.");
    }
    return;
  }

  if (subcommand === "create") {
    await ctx.reply(
      `<b>Creating an HTLC:</b>\n\n` +
      `HTLC creation requires direct interaction with the Zenon network.\n` +
      `Use Syrius wallet or the CLI to create HTLCs.\n\n` +
      `Parameters needed:\n` +
      `- Token and amount\n` +
      `- Recipient address\n` +
      `- Hash lock\n` +
      `- Expiration time`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (subcommand === "unlock") {
    await ctx.reply(
      `<b>Unlocking an HTLC:</b>\n\n` +
      `To unlock an HTLC, you need the preimage that matches the hash lock.\n` +
      `Use Syrius wallet or the CLI to unlock HTLCs.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  await ctx.reply("Unknown subcommand. Use /zhtlc help");
});

export default composer;
