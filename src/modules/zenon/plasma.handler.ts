import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { requireZenon, getUserAddress, formatAmount, requireWallet } from "./zenon.service.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("zenon:plasma");

const composer = new Composer<BotContext>();

// /zplasma [address] - Show plasma info
composer.command("zplasma", async (ctx) => {
  if (!requireZenon(ctx)) return;

  let addressStr = (ctx.match as string).trim();
  if (!addressStr) {
    const linked = await getUserAddress(BigInt(ctx.from!.id));
    if (!linked) {
      await ctx.reply("No address specified and no wallet linked.\nUsage: /zplasma <address>");
      return;
    }
    addressStr = linked;
  }

  try {
    const { Address } = await import("znn-typescript-sdk");
    const address = Address.parse(addressStr);

    const [plasmaInfo, fusionEntries] = await Promise.all([
      ctx.zenon.embedded.plasma.get(address),
      ctx.zenon.embedded.plasma.getEntriesByAddress(address, 0, 10),
    ]);

    let text = `<b>Plasma for</b> <code>${addressStr}</code>\n\n`;

    if (plasmaInfo) {
      text += `Current plasma: <b>${plasmaInfo.currentPlasma}</b>\n`;
      text += `Max plasma: <b>${plasmaInfo.maxPlasma}</b>\n`;
      text += `QSR fused: <b>${formatAmount(plasmaInfo.qsrAmount)}</b> QSR\n`;
    }

    if (fusionEntries && fusionEntries.list && fusionEntries.list.length > 0) {
      text += `\n<b>Fusion entries:</b>\n`;
      for (const entry of fusionEntries.list) {
        text += `  ${formatAmount(entry.qsrAmount)} QSR → <code>${entry.beneficiary}</code>\n`;
      }
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    log.error({ err, address: addressStr }, "Failed to get plasma info");
    await ctx.reply("Failed to fetch plasma info.");
  }
});

// /zfuse <address> <amount> - Fuse QSR for plasma (bot wallet)
composer.command("zfuse", async (ctx) => {
  if (!requireWallet(ctx)) return;

  const args = (ctx.match as string).trim().split(/\s+/);
  if (args.length < 2) {
    await ctx.reply("Usage: /zfuse <beneficiary_address> <qsr_amount>");
    return;
  }

  const [addressStr, amountStr] = args;

  try {
    const { Address } = await import("znn-typescript-sdk");
    const beneficiary = Address.parse(addressStr);

    const { extractNumberDecimals } = await import("znn-typescript-sdk");
    const bnAmount = extractNumberDecimals(amountStr, 8);
    const block = ctx.zenon.embedded.plasma.fuse(beneficiary, bnAmount);
    await ctx.zenon.send(block);

    await ctx.reply(
      `Fused <b>${amountStr}</b> QSR for <code>${addressStr}</code>.`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    log.error({ err }, "Failed to fuse QSR");
    await ctx.reply("Failed to fuse QSR. Check the address and amount.");
  }
});

export default composer;
