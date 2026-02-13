import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { requireZenon } from "./zenon.service.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("zenon:network");

const composer = new Composer<BotContext>();

// /zstats - Show network stats
composer.command("zstats", async (ctx) => {
  if (!requireZenon(ctx)) return;

  try {
    const [syncInfo, networkInfo, processInfo] = await Promise.all([
      ctx.zenon.stats.syncInfo(),
      ctx.zenon.stats.networkInfo(),
      ctx.zenon.stats.processInfo(),
    ]);

    let text = `<b>Zenon Network Stats:</b>\n\n`;

    if (syncInfo) {
      text += `State: <b>${syncInfo.state ?? "unknown"}</b>\n`;
      text += `Current height: <b>${syncInfo.currentHeight ?? "N/A"}</b>\n`;
      text += `Target height: <b>${syncInfo.targetHeight ?? "N/A"}</b>\n`;
    }

    if (networkInfo) {
      text += `\nPeers: <b>${networkInfo.numPeers ?? "N/A"}</b>\n`;
    }

    if (processInfo) {
      text += `\nNode version: <b>${processInfo.version ?? "N/A"}</b>\n`;
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    log.error({ err }, "Failed to get network stats");
    await ctx.reply("Failed to fetch network stats.");
  }
});

// /zmomentum [height] - Show frontier momentum or specific momentum
composer.command("zmomentum", async (ctx) => {
  if (!requireZenon(ctx)) return;

  try {
    const arg = (ctx.match as string).trim();

    if (arg) {
      const height = parseInt(arg, 10);
      if (isNaN(height) || height <= 0) {
        await ctx.reply("Usage: /zmomentum [height]");
        return;
      }

      const result = await ctx.zenon.ledger.getMomentumsByHeight(height, 1);
      if (!result || !result.list || result.list.length === 0) {
        await ctx.reply("Momentum not found at that height.");
        return;
      }

      const momentum = result.list[0];
      await ctx.reply(
        `<b>Momentum #${momentum.height}</b>\n\n` +
        `Hash: <code>${momentum.hash}</code>\n` +
        `Timestamp: <b>${new Date(momentum.timestamp * 1000).toISOString()}</b>\n` +
        `Content: <b>${momentum.content?.length ?? 0}</b> account block(s)`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const momentum = await ctx.zenon.ledger.getFrontierMomentum();

    await ctx.reply(
      `<b>Frontier Momentum:</b>\n\n` +
      `Height: <b>${momentum.height}</b>\n` +
      `Hash: <code>${momentum.hash}</code>\n` +
      `Timestamp: <b>${new Date(momentum.timestamp * 1000).toISOString()}</b>`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    log.error({ err }, "Failed to get momentum");
    await ctx.reply("Failed to fetch momentum data.");
  }
});

export default composer;
