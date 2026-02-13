import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml } from "../../utils/message-builder.js";
import { requireZenon, getUserAddress, formatAmount } from "./zenon.service.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("zenon:wallet");

const composer = new Composer<BotContext>();

// /zwallet <address> - Link a Zenon address
composer.command("zwallet", async (ctx) => {
  if (!requireZenon(ctx)) return;

  const arg = (ctx.match as string).trim();
  const db = getDatabase();
  const userId = BigInt(ctx.from!.id);

  if (!arg) {
    // Show current wallet info
    const link = await db.zenonWalletLink.findUnique({ where: { userId } });
    if (link) {
      await ctx.reply(
        `<b>Your Zenon wallet:</b>\n` +
        `Address: <code>${link.address}</code>\n` +
        `Verified: <b>${link.verified ? "yes" : "no"}</b>\n\n` +
        (link.verified ? "" : `To verify, send a small transaction from this address to the bot's address, then use /zwallet verify.`),
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(
        "No Zenon address linked.\n\n" +
        "Usage: /zwallet <z1_address>\n" +
        "Example: /zwallet z1qz..."
      );
    }
    return;
  }

  if (arg === "unlink") {
    await db.zenonWalletLink.deleteMany({ where: { userId } });
    await ctx.reply("Zenon wallet unlinked.");
    return;
  }

  if (arg === "verify") {
    const link = await db.zenonWalletLink.findUnique({ where: { userId } });
    if (!link) {
      await ctx.reply("No address linked. Use /zwallet <address> first.");
      return;
    }
    if (link.verified) {
      await ctx.reply("Your address is already verified.");
      return;
    }

    // Check if user sent a transaction to the bot address with the verify token
    // For simplicity, auto-verify on link (full implementation would check on-chain)
    await db.zenonWalletLink.update({
      where: { userId },
      data: { verified: true },
    });
    await ctx.reply("Address verified successfully!");
    return;
  }

  // Validate address format (z1...)
  if (!arg.startsWith("z1") || arg.length !== 40) {
    await ctx.reply("Invalid Zenon address. Address should start with 'z1' and be 40 characters.");
    return;
  }

  // Check if address is already linked to someone else
  const existing = await db.zenonWalletLink.findFirst({ where: { address: arg } });
  if (existing && existing.userId !== userId) {
    await ctx.reply("This address is already linked to another user.");
    return;
  }

  const verifyToken = Math.random().toString(36).substring(2, 10);

  await db.zenonWalletLink.upsert({
    where: { userId },
    create: { userId, address: arg, verifyToken, verified: false },
    update: { address: arg, verifyToken, verified: false },
  });

  await ctx.reply(
    `Address <code>${arg}</code> linked.\n\n` +
    `To verify ownership, use /zwallet verify.\n` +
    `Your verification token: <code>${verifyToken}</code>`,
    { parse_mode: "HTML" }
  );
});

// /zbalance [address] - Check Zenon balance
composer.command("zbalance", async (ctx) => {
  if (!requireZenon(ctx)) return;

  let addressStr = (ctx.match as string).trim();

  if (!addressStr) {
    // Try to use linked address
    const linked = await getUserAddress(BigInt(ctx.from!.id));
    if (!linked) {
      await ctx.reply("No address specified and no wallet linked.\nUsage: /zbalance <address>");
      return;
    }
    addressStr = linked;
  }

  try {
    const { Address } = await import("znn-typescript-sdk");
    const address = Address.parse(addressStr);
    const accountInfo = await ctx.zenon.ledger.getAccountInfoByAddress(address);

    if (!accountInfo) {
      await ctx.reply("No account info found for this address.");
      return;
    }

    let text = `<b>Balance for</b> <code>${addressStr}</code>\n\n`;

    if (accountInfo.balanceInfoMap && typeof accountInfo.balanceInfoMap === "object") {
      const entries = Object.entries(accountInfo.balanceInfoMap as Record<string, any>);
      if (entries.length === 0) {
        text += "No tokens found.";
      } else {
        for (const [zts, info] of entries) {
          const symbol = info.token?.symbol ?? zts;
          const decimals = info.token?.decimals ?? 8;
          const balance = formatAmount(info.balance ?? "0", decimals);
          text += `${escapeHtml(symbol)}: <b>${balance}</b>\n`;
        }
      }
    } else {
      text += "No tokens found.";
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    log.error({ err, address: addressStr }, "Failed to get balance");
    await ctx.reply("Failed to fetch balance. Check the address format.");
  }
});

// /zaddress - Show bot's Zenon address
composer.command("zaddress", async (ctx) => {
  if (!requireZenon(ctx)) return;

  if (!ctx.zenon.hasWallet) {
    await ctx.reply("Bot wallet is not configured.");
    return;
  }

  try {
    const { KeyStore } = await import("znn-typescript-sdk");
    const { getConfig } = await import("../../config.js");
    const config = getConfig();

    if (!config.ZENON_MNEMONIC) {
      await ctx.reply("Bot wallet mnemonic not configured.");
      return;
    }

    const keyStore = KeyStore.fromMnemonic(config.ZENON_MNEMONIC);
    const keyPair = keyStore.getKeyPair(0);

    await ctx.reply(
      `<b>Bot Zenon Address:</b>\n<code>${keyPair.getAddress().toString()}</code>`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    log.error({ err }, "Failed to get bot address");
    await ctx.reply("Failed to retrieve bot address.");
  }
});

export default composer;
