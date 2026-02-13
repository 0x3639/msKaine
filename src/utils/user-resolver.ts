import type { BotContext } from "../context.js";

export interface ResolvedUser {
  id: bigint;
  firstName?: string;
  username?: string;
}

/**
 * Resolve a target user from:
 * 1. A reply to a message
 * 2. A @username argument
 * 3. A numeric user ID argument
 *
 * Returns null if no user could be resolved.
 */
export async function resolveUser(
  ctx: BotContext,
  args?: string
): Promise<ResolvedUser | null> {
  // 1. Check if replying to a message
  const reply = ctx.message?.reply_to_message;
  if (reply?.from) {
    return {
      id: BigInt(reply.from.id),
      firstName: reply.from.first_name,
      username: reply.from.username,
    };
  }

  if (!args || args.trim().length === 0) return null;

  const target = args.trim().split(/\s+/)[0];

  // 2. Check for @username
  if (target.startsWith("@")) {
    try {
      const chat = await ctx.api.getChat(target);
      if (chat.type === "private") {
        return {
          id: BigInt(chat.id),
          firstName: chat.first_name,
          username: chat.username,
        };
      }
    } catch {
      // Username not found or API error
    }
    return null;
  }

  // 3. Check for numeric ID
  const numId = parseInt(target, 10);
  if (!isNaN(numId) && numId > 0) {
    try {
      const chat = await ctx.api.getChat(numId);
      if (chat.type === "private") {
        return {
          id: BigInt(chat.id),
          firstName: chat.first_name,
          username: chat.username,
        };
      }
    } catch {
      // ID not found, return basic info
      return { id: BigInt(numId) };
    }
  }

  return null;
}

/**
 * Extract the reason text from command arguments, skipping the user identifier.
 */
export function extractReason(args: string): string | undefined {
  const parts = args.trim().split(/\s+/);
  if (parts.length <= 1) return undefined;
  return parts.slice(1).join(" ") || undefined;
}

/**
 * Extract both a duration and reason from args like "1d spam" -> { duration: "1d", reason: "spam" }
 */
export function extractDurationAndReason(args: string): {
  durationStr?: string;
  reason?: string;
} {
  const parts = args.trim().split(/\s+/);
  if (parts.length === 0) return {};

  // Check if the first part (after user identifier) is a duration
  const firstArg = parts[0];
  const durationRegex = /^\d+[mhdw]$/i;

  if (durationRegex.test(firstArg)) {
    return {
      durationStr: firstArg,
      reason: parts.slice(1).join(" ") || undefined,
    };
  }

  return { reason: parts.join(" ") || undefined };
}
