import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../../context.js";
import { requireWallet } from "./zenon.service.js";
import { escapeHtml } from "../../utils/message-builder.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("zenon:send");

const composer = new Composer<BotContext>();

// Pending sends awaiting confirmation
const pendingSends = new Map<string, {
  to: string;
  amount: string;
  zts: string;
  expiresAt: number;
}>();

// /zsend <address> <amount> <zts> - Send tokens from bot wallet
composer.command("zsend", async (ctx) => {
  if (!requireWallet(ctx)) return;

  const args = (ctx.match as string).trim().split(/\s+/);
  if (args.length < 2) {
    await ctx.reply(
      "Usage: /zsend <address> <amount> [zts]\n\n" +
      "Default token is ZNN.\n" +
      "Example: /zsend z1qz... 1.5\n" +
      "Example: /zsend z1qz... 10 zts1qsr..."
    );
    return;
  }

  const [toAddress, amountStr] = args;
  const ztsStr = args[2] || "zts1znnxxxxxxxxxxxxx9z4ulx"; // ZNN default

  // Validate address
  if (!toAddress.startsWith("z1") || toAddress.length !== 40) {
    await ctx.reply("Invalid destination address.");
    return;
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply("Invalid amount.");
    return;
  }

  // Store pending send with confirmation
  const confirmKey = `${ctx.from!.id}:${Date.now()}`;
  pendingSends.set(confirmKey, {
    to: toAddress,
    amount: amountStr,
    zts: ztsStr,
    expiresAt: Date.now() + 60000, // 1 minute to confirm
  });

  const keyboard = new InlineKeyboard()
    .text("Confirm Send", `zsend_confirm:${confirmKey}`)
    .text("Cancel", `zsend_cancel:${confirmKey}`);

  await ctx.reply(
    `<b>Confirm transaction:</b>\n\n` +
    `To: <code>${toAddress}</code>\n` +
    `Amount: <b>${amountStr}</b>\n` +
    `Token: <code>${escapeHtml(ztsStr)}</code>\n\n` +
    `This will send from the bot's wallet. Confirm within 60 seconds.`,
    { parse_mode: "HTML", reply_markup: keyboard }
  );
});

// Confirm send callback
composer.callbackQuery(/^zsend_confirm:(.+)$/, async (ctx) => {
  const key = ctx.match![1];
  const pending = pendingSends.get(key);

  if (!pending) {
    await ctx.answerCallbackQuery({ text: "Transaction expired or not found.", show_alert: true });
    return;
  }

  if (Date.now() > pending.expiresAt) {
    pendingSends.delete(key);
    await ctx.answerCallbackQuery({ text: "Transaction expired.", show_alert: true });
    return;
  }

  // Verify the user who initiated the send
  const userId = key.split(":")[0];
  if (String(ctx.from.id) !== userId) {
    await ctx.answerCallbackQuery({ text: "This isn't your transaction.", show_alert: true });
    return;
  }

  pendingSends.delete(key);

  try {
    const { Address, TokenStandard, AccountBlockTemplate, extractNumberDecimals } = await import("znn-typescript-sdk");

    const toAddress = Address.parse(pending.to);
    const tokenStandard = TokenStandard.parse(pending.zts);
    const bnAmount = extractNumberDecimals(pending.amount, 8);

    const block = AccountBlockTemplate.send(toAddress, tokenStandard, bnAmount);
    await ctx.zenon.send(block);

    await ctx.answerCallbackQuery({ text: "Transaction sent!" });
    await ctx.editMessageText(
      `Transaction sent!\n\n` +
      `To: <code>${pending.to}</code>\n` +
      `Amount: <b>${pending.amount}</b>`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    log.error({ err }, "Failed to send transaction");
    await ctx.answerCallbackQuery({ text: "Transaction failed.", show_alert: true });
    await ctx.editMessageText("Transaction failed. Check logs for details.");
  }
});

// Cancel send callback
composer.callbackQuery(/^zsend_cancel:(.+)$/, async (ctx) => {
  const key = ctx.match![1];
  pendingSends.delete(key);
  await ctx.answerCallbackQuery({ text: "Transaction cancelled." });
  await ctx.editMessageText("Transaction cancelled.");
});

export default composer;
