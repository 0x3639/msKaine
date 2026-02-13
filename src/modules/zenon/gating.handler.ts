import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { getDatabase } from "../../core/database.js";
import { escapeHtml, userMention } from "../../utils/message-builder.js";
import { requireZenon, getUserAddress, formatAmount } from "./zenon.service.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("zenon:gating");

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

// /zgate <enable|disable|check|info> - Token gating
composer.command("zgate", async (ctx) => {
  const args = (ctx.match as string).trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase();

  if (!subcommand || subcommand === "info") {
    const settings = ctx.chatSettings?.chat;
    if (!settings) return;

    await ctx.reply(
      `<b>Token Gating Settings:</b>\n\n` +
      `Status: <b>${settings.zenonGatingEnabled ? "enabled" : "disabled"}</b>\n` +
      `Token: <b>${settings.zenonGatingToken ? `<code>${settings.zenonGatingToken}</code>` : "not set"}</b>\n` +
      `Min amount: <b>${settings.zenonGatingMinAmount ?? "not set"}</b>\n\n` +
      `Usage:\n` +
      `/zgate enable <zts> <min_amount> - Enable token gating\n` +
      `/zgate disable - Disable token gating\n` +
      `/zgate check - Check your eligibility`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (subcommand === "enable") {
    if (!requireAdmin(ctx)) return;

    const ztsStr = args[1];
    const minAmount = args[2];

    if (!ztsStr || !minAmount) {
      await ctx.reply("Usage: /zgate enable <zts_address> <min_amount>\nExample: /zgate enable zts1znnxxxxxxxxxxxxx9z4ulx 100");
      return;
    }

    const db = getDatabase();
    await db.chat.update({
      where: { id: BigInt(ctx.chat!.id) },
      data: {
        zenonGatingEnabled: true,
        zenonGatingToken: ztsStr,
        zenonGatingMinAmount: minAmount,
      },
    });

    await ctx.reply(
      `Token gating <b>enabled</b>.\n` +
      `Token: <code>${escapeHtml(ztsStr)}</code>\n` +
      `Min amount: <b>${minAmount}</b>\n\n` +
      `Users must have a linked and verified wallet with the required balance.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (subcommand === "disable") {
    if (!requireAdmin(ctx)) return;

    const db = getDatabase();
    await db.chat.update({
      where: { id: BigInt(ctx.chat!.id) },
      data: { zenonGatingEnabled: false },
    });

    await ctx.reply("Token gating <b>disabled</b>.", { parse_mode: "HTML" });
    return;
  }

  if (subcommand === "check") {
    if (!requireZenon(ctx)) return;

    const settings = ctx.chatSettings?.chat;
    if (!settings?.zenonGatingEnabled) {
      await ctx.reply("Token gating is not enabled in this group.");
      return;
    }

    const address = await getUserAddress(BigInt(ctx.from!.id));
    if (!address) {
      await ctx.reply("You don't have a verified Zenon wallet linked. Use /zwallet to link one.");
      return;
    }

    try {
      const { Address } = await import("znn-typescript-sdk");
      const addr = Address.parse(address);
      const accountInfo = await ctx.zenon.ledger.getAccountInfoByAddress(addr);

      if (!accountInfo || !accountInfo.balanceInfoMap) {
        await ctx.reply("Could not check your balance. You may not meet the requirement.");
        return;
      }

      const requiredZts = settings.zenonGatingToken!;
      const requiredAmount = settings.zenonGatingMinAmount ?? "0";

      // Find the balance for the required token
      let hasBalance = false;
      const balanceMap = accountInfo.balanceInfoMap as Record<string, any>;

      for (const [zts, info] of Object.entries(balanceMap)) {
        if (zts === requiredZts || info.token?.tokenStandard?.toString() === requiredZts) {
          const decimals = info.token?.decimals ?? 8;
          const balance = formatAmount(info.balance ?? "0", decimals);
          const required = parseFloat(requiredAmount);
          const actual = parseFloat(balance);

          if (actual >= required) {
            hasBalance = true;
            await ctx.reply(
              `You meet the requirement!\n\n` +
              `Required: <b>${requiredAmount}</b> ${escapeHtml(info.token?.symbol ?? zts)}\n` +
              `Your balance: <b>${balance}</b>`,
              { parse_mode: "HTML" }
            );
          } else {
            await ctx.reply(
              `You do <b>not</b> meet the requirement.\n\n` +
              `Required: <b>${requiredAmount}</b> ${escapeHtml(info.token?.symbol ?? zts)}\n` +
              `Your balance: <b>${balance}</b>`,
              { parse_mode: "HTML" }
            );
          }
          break;
        }
      }

      if (!hasBalance) {
        await ctx.reply(
          `You do <b>not</b> hold the required token.\n` +
          `Required token: <code>${escapeHtml(requiredZts)}</code>\n` +
          `Required amount: <b>${requiredAmount}</b>`,
          { parse_mode: "HTML" }
        );
      }
    } catch (err) {
      log.error({ err }, "Failed to check token gate");
      await ctx.reply("Failed to verify balance.");
    }
    return;
  }

  await ctx.reply("Unknown subcommand. Use /zgate info for help.");
});

// Chat member handler: enforce token gating on new joins
composer.on("chat_member", async (ctx, next) => {
  if (!ctx.chatSettings?.loaded) return next();
  if (!ctx.chatSettings.chat.zenonGatingEnabled) return next();
  if (!ctx.zenon.initialized) return next();

  const update = ctx.chatMember;
  if (!update) return next();

  const oldStatus = update.old_chat_member.status;
  const newStatus = update.new_chat_member.status;

  // Only check on join
  if (
    !(
      (oldStatus === "left" || oldStatus === "kicked") &&
      (newStatus === "member" || newStatus === "restricted")
    )
  ) {
    return next();
  }

  const user = update.new_chat_member.user;
  if (user.is_bot) return next();

  const address = await getUserAddress(BigInt(user.id));
  if (!address) {
    // No linked wallet - kick with message
    try {
      await ctx.api.banChatMember(ctx.chat!.id, user.id);
      await ctx.api.unbanChatMember(ctx.chat!.id, user.id, { only_if_banned: true });
      await ctx.api.sendMessage(
        ctx.chat!.id,
        `${userMention(user.id, user.first_name)} was removed - token gating requires a linked Zenon wallet.`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      log.warn({ err, userId: user.id }, "Failed to enforce token gate");
    }
    return next();
  }

  // Check balance
  try {
    const { Address } = await import("znn-typescript-sdk");
    const addr = Address.parse(address);
    const accountInfo = await ctx.zenon.ledger.getAccountInfoByAddress(addr);

    const settings = ctx.chatSettings.chat;
    const requiredZts = settings.zenonGatingToken!;
    const requiredAmount = parseFloat(settings.zenonGatingMinAmount ?? "0");

    let meetsRequirement = false;

    if (accountInfo?.balanceInfoMap) {
      const balanceMap = accountInfo.balanceInfoMap as Record<string, any>;
      for (const [zts, info] of Object.entries(balanceMap)) {
        if (zts === requiredZts || info.token?.tokenStandard?.toString() === requiredZts) {
          const decimals = info.token?.decimals ?? 8;
          const balance = parseFloat(formatAmount(info.balance ?? "0", decimals));
          if (balance >= requiredAmount) {
            meetsRequirement = true;
          }
          break;
        }
      }
    }

    if (!meetsRequirement) {
      await ctx.api.banChatMember(ctx.chat!.id, user.id);
      await ctx.api.unbanChatMember(ctx.chat!.id, user.id, { only_if_banned: true });
      await ctx.api.sendMessage(
        ctx.chat!.id,
        `${userMention(user.id, user.first_name)} was removed - insufficient token balance for gated access.`,
        { parse_mode: "HTML" }
      );
    }
  } catch (err) {
    log.error({ err, userId: user.id }, "Token gate balance check failed");
  }

  return next();
});

export default composer;
