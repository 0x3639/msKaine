import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { escapeHtml } from "../../utils/message-builder.js";
import { requireZenon, formatAmount } from "./zenon.service.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("zenon:token");

const composer = new Composer<BotContext>();

// /ztoken <zts> - Get token info by ZTS
composer.command("ztoken", async (ctx) => {
  if (!requireZenon(ctx)) return;

  const ztsStr = (ctx.match as string).trim();
  if (!ztsStr) {
    await ctx.reply("Usage: /ztoken <zts_address>\nExample: /ztoken zts1znnxxxxxxxxxxxxx9z4ulx");
    return;
  }

  try {
    const { TokenStandard } = await import("znn-typescript-sdk");
    const zts = TokenStandard.parse(ztsStr);
    const token = await ctx.zenon.embedded.token.getByZts(zts);

    if (!token) {
      await ctx.reply("Token not found.");
      return;
    }

    await ctx.reply(
      `<b>Token Info:</b>\n\n` +
      `Name: <b>${escapeHtml(token.name)}</b>\n` +
      `Symbol: <b>${escapeHtml(token.symbol)}</b>\n` +
      `ZTS: <code>${token.tokenStandard}</code>\n` +
      `Decimals: <b>${token.decimals}</b>\n` +
      `Total supply: <b>${formatAmount(token.totalSupply, token.decimals)}</b>\n` +
      `Max supply: <b>${formatAmount(token.maxSupply, token.decimals)}</b>\n` +
      `Owner: <code>${token.owner}</code>\n` +
      `Mintable: <b>${token.isMintable ? "yes" : "no"}</b>\n` +
      `Burnable: <b>${token.isBurnable ? "yes" : "no"}</b>\n` +
      `Utility: <b>${token.isUtility ? "yes" : "no"}</b>`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    log.error({ err, zts: ztsStr }, "Failed to get token info");
    await ctx.reply("Failed to fetch token info. Check the ZTS address.");
  }
});

// /ztokens [page] - List all tokens
composer.command("ztokens", async (ctx) => {
  if (!requireZenon(ctx)) return;

  try {
    const page = parseInt((ctx.match as string).trim(), 10) || 0;
    const result = await ctx.zenon.embedded.token.getAll(page, 10);

    if (!result || !result.list || result.list.length === 0) {
      await ctx.reply("No tokens found.");
      return;
    }

    let text = `<b>Tokens (page ${page}, total: ${result.count}):</b>\n\n`;
    for (const token of result.list) {
      text += `<b>${escapeHtml(token.symbol)}</b> - ${escapeHtml(token.name)}\n`;
      text += `  <code>${token.tokenStandard}</code>\n`;
    }

    if (result.count > (page + 1) * 10) {
      text += `\nNext page: /ztokens ${page + 1}`;
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    log.error({ err }, "Failed to list tokens");
    await ctx.reply("Failed to fetch token list.");
  }
});

export default composer;
