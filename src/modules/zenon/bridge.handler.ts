import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { escapeHtml } from "../../utils/message-builder.js";
import { requireZenon } from "./zenon.service.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("zenon:bridge");

const composer = new Composer<BotContext>();

// /zbridge [info|networks] - Bridge information
composer.command("zbridge", async (ctx) => {
  if (!requireZenon(ctx)) return;

  const arg = (ctx.match as string).trim().toLowerCase();

  if (arg === "networks") {
    try {
      const result = await ctx.zenon.embedded.bridge.getAllNetworks(0, 20);

      if (!result || !result.list || result.list.length === 0) {
        await ctx.reply("No bridge networks found.");
        return;
      }

      let text = `<b>Bridge Networks:</b>\n\n`;
      for (const network of result.list) {
        text += `<b>${escapeHtml(network.name ?? "Unknown")}</b>\n`;
        text += `  Class: ${network.networkClass}, Chain: ${network.chainId}\n`;
      }

      await ctx.reply(text, { parse_mode: "HTML" });
    } catch (err) {
      log.error({ err }, "Failed to list bridge networks");
      await ctx.reply("Failed to fetch bridge networks.");
    }
    return;
  }

  // Default: show bridge info
  try {
    const [bridgeInfo, orchestratorInfo] = await Promise.all([
      ctx.zenon.embedded.bridge.getBridgeInfo(),
      ctx.zenon.embedded.bridge.getOrchestratorInfo(),
    ]);

    let text = `<b>Zenon Bridge Info:</b>\n\n`;

    if (bridgeInfo) {
      text += `Halted: <b>${bridgeInfo.halted ? "yes" : "no"}</b>\n`;
      text += `Allow keygen: <b>${bridgeInfo.allowKeyGen ? "yes" : "no"}</b>\n`;
    }

    if (orchestratorInfo) {
      text += `\n<b>Orchestrator:</b>\n`;
      text += `Window size: <b>${orchestratorInfo.windowSize ?? "N/A"}</b>\n`;
      text += `Key gen threshold: <b>${orchestratorInfo.keyGenThreshold ?? "N/A"}</b>\n`;
      text += `Confirmations to finality: <b>${orchestratorInfo.confirmationsToFinality ?? "N/A"}</b>\n`;
    }

    text += `\nUse /zbridge networks to see available networks.`;

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    log.error({ err }, "Failed to get bridge info");
    await ctx.reply("Failed to fetch bridge info.");
  }
});

// /zwrap - Info about wrapping tokens
composer.command("zwrap", async (ctx) => {
  await ctx.reply(
    `<b>Wrapping Tokens:</b>\n\n` +
    `To wrap ZNN/QSR tokens to another network, use the Syrius wallet bridge interface.\n\n` +
    `Use /zbridge networks to see available bridge networks.`,
    { parse_mode: "HTML" }
  );
});

export default composer;
