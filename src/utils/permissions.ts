import type { BotContext } from "../context.js";

/**
 * Check if the bot has a specific permission in the chat.
 */
export async function botHasPermission(
  ctx: BotContext,
  permission: string
): Promise<boolean> {
  try {
    const botMember = await ctx.api.getChatMember(
      ctx.chat!.id,
      ctx.me.id
    );
    if (
      botMember.status === "administrator" &&
      "can_restrict_members" in botMember
    ) {
      return (botMember as unknown as Record<string, unknown>)[permission] === true;
    }
    return botMember.status === "creator";
  } catch {
    return false;
  }
}

/**
 * Check if the bot can restrict members (ban, mute, kick).
 */
export async function botCanRestrict(ctx: BotContext): Promise<boolean> {
  try {
    const botMember = await ctx.api.getChatMember(ctx.chat!.id, ctx.me.id);
    if (botMember.status === "creator") return true;
    if (botMember.status === "administrator" && "can_restrict_members" in botMember) {
      return botMember.can_restrict_members === true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if the bot can delete messages.
 */
export async function botCanDelete(ctx: BotContext): Promise<boolean> {
  try {
    const botMember = await ctx.api.getChatMember(ctx.chat!.id, ctx.me.id);
    if (botMember.status === "creator") return true;
    if (botMember.status === "administrator" && "can_delete_messages" in botMember) {
      return botMember.can_delete_messages === true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if a user can be targeted by moderation actions.
 * Returns false for creators, other admins (if actor lacks permission), and the bot itself.
 */
export async function canTarget(
  ctx: BotContext,
  targetUserId: number | bigint
): Promise<{ ok: boolean; reason?: string }> {
  const targetId = Number(targetUserId);

  // Can't target the bot itself
  if (targetId === ctx.me.id) {
    return { ok: false, reason: "I'm not going to restrict myself!" };
  }

  try {
    const targetMember = await ctx.api.getChatMember(ctx.chat!.id, targetId);

    // Can't target the creator
    if (targetMember.status === "creator") {
      return { ok: false, reason: "I can't act on the group creator." };
    }

    // Can't target admins unless you're the creator
    if (targetMember.status === "administrator") {
      if (!ctx.permissions.isCreator) {
        return { ok: false, reason: "I can't act on other admins." };
      }
    }
  } catch {
    // User might not be in the chat, that's fine for banning
  }

  return { ok: true };
}

export const DISABLEABLE_COMMANDS = [
  "adminlist",
  "antiflood",
  "approval",
  "connect",
  "fedadmins",
  "fedinfo",
  "fedsubs",
  "filters",
  "flood",
  "id",
  "info",
  "kickme",
  "locks",
  "locktypes",
  "notes",
  "rules",
  "saved",
  "warnings",
  "warns",
] as const;
