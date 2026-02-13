import { getDatabase } from "../../core/database.js";
import type { BotContext } from "../../context.js";

/**
 * Helper to check if Zenon SDK is available.
 */
export function requireZenon(ctx: BotContext): boolean {
  if (!ctx.zenon.initialized) {
    ctx.reply("Zenon SDK is not connected. Please try again later.").catch(() => {});
    return false;
  }
  return true;
}

/**
 * Helper to check if bot wallet is available.
 */
export function requireWallet(ctx: BotContext): boolean {
  if (!requireZenon(ctx)) return false;
  if (!ctx.zenon.hasWallet) {
    ctx.reply("Bot wallet is not configured.").catch(() => {});
    return false;
  }
  return true;
}

/**
 * Get a user's linked Zenon address.
 */
export async function getUserAddress(userId: bigint): Promise<string | null> {
  const db = getDatabase();
  const link = await db.zenonWalletLink.findUnique({
    where: { userId },
  });
  return link?.verified ? link.address : null;
}

/**
 * Format a BigNumber-like value with decimals for display.
 */
export function formatAmount(amount: any, decimals: number = 8): string {
  try {
    const { addNumberDecimals } = require("znn-typescript-sdk");
    return addNumberDecimals(amount, decimals);
  } catch {
    // Fallback: manual conversion
    const str = String(amount);
    if (str.length <= decimals) {
      return `0.${str.padStart(decimals, "0")}`;
    }
    const intPart = str.slice(0, str.length - decimals);
    const decPart = str.slice(str.length - decimals).replace(/0+$/, "");
    return decPart ? `${intPart}.${decPart}` : intPart;
  }
}

/**
 * Parse a human amount (e.g. "1.5") to base units.
 */
export function parseAmount(amount: string, decimals: number = 8): string {
  try {
    const { extractNumberDecimals } = require("znn-typescript-sdk");
    return extractNumberDecimals(amount, decimals).toString();
  } catch {
    // Fallback: manual conversion
    const parts = amount.split(".");
    const intPart = parts[0] || "0";
    const decPart = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
    const result = intPart + decPart;
    return result.replace(/^0+/, "") || "0";
  }
}
