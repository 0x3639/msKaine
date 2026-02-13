import { getDatabase } from "../../core/database.js";
import type { Message } from "grammy/types";
import { LOCK_TYPES, type LockType } from "../../utils/constants.js";

export interface LockInfo {
  lockType: string;
  lockWarns: boolean;
  lockMode: string | null;
  lockReason: string | null;
}

/**
 * Get all active locks for a chat.
 */
export async function getActiveLocks(chatId: bigint): Promise<LockInfo[]> {
  const db = getDatabase();
  return db.chatLock.findMany({
    where: { chatId },
    select: { lockType: true, lockWarns: true, lockMode: true, lockReason: true },
  });
}

/**
 * Check if a specific lock type is active.
 */
export async function isLocked(chatId: bigint, lockType: string): Promise<LockInfo | null> {
  const db = getDatabase();
  return db.chatLock.findUnique({
    where: { chatId_lockType: { chatId, lockType } },
    select: { lockType: true, lockWarns: true, lockMode: true, lockReason: true },
  });
}

/**
 * Add a lock.
 */
export async function addLock(
  chatId: bigint,
  lockType: string,
  options?: { warns?: boolean; mode?: string; reason?: string }
): Promise<void> {
  const db = getDatabase();
  await db.chatLock.upsert({
    where: { chatId_lockType: { chatId, lockType } },
    create: {
      chatId,
      lockType,
      lockWarns: options?.warns ?? false,
      lockMode: options?.mode ?? null,
      lockReason: options?.reason ?? null,
    },
    update: {
      lockWarns: options?.warns ?? false,
      lockMode: options?.mode ?? null,
      lockReason: options?.reason ?? null,
    },
  });
}

/**
 * Remove a lock.
 */
export async function removeLock(chatId: bigint, lockType: string): Promise<boolean> {
  const db = getDatabase();
  try {
    await db.chatLock.delete({
      where: { chatId_lockType: { chatId, lockType } },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a message matches any active lock type.
 */
export function detectLockedContent(msg: Message): string[] {
  const matched: string[] = [];

  if (msg.text) matched.push("text");
  if (msg.sticker) matched.push("sticker");
  if (msg.animation) matched.push("gif");
  if (msg.photo) matched.push("photo");
  if (msg.video) matched.push("video");
  if (msg.audio) matched.push("audio");
  if (msg.voice) matched.push("voice");
  if (msg.video_note) matched.push("videonote");
  if (msg.document && !msg.animation) matched.push("document");
  if (msg.location) matched.push("location");
  if (msg.contact) matched.push("contact");
  if (msg.poll) matched.push("poll");
  if (msg.dice) matched.push("dice");
  if (msg.game) matched.push("game");
  if (msg.forward_origin) matched.push("forward");
  if (msg.via_bot) matched.push("inline");

  // URL detection
  if (msg.entities?.some((e) => e.type === "url" || e.type === "text_link")) {
    matched.push("url");
  }

  // Invite link detection
  if (
    msg.entities?.some((e) => e.type === "url" || e.type === "text_link") &&
    msg.text?.match(/t\.me\/|telegram\.me\//i)
  ) {
    matched.push("invitelink");
  }

  // Command detection
  if (msg.entities?.some((e) => e.type === "bot_command")) {
    matched.push("command");
  }

  // Media aggregate
  if (msg.photo || msg.video || msg.audio || msg.document || msg.animation || msg.voice || msg.video_note || msg.sticker) {
    matched.push("media");
  }

  // Sender is a channel (anonymous channel post)
  if (msg.sender_chat && msg.sender_chat.type === "channel") {
    matched.push("anonchannel");
  }

  return matched;
}

/**
 * Check if an item is in the allowlist.
 */
export async function isAllowlisted(chatId: bigint, item: string): Promise<boolean> {
  const db = getDatabase();
  const entry = await db.allowlistEntry.findUnique({
    where: { chatId_item: { chatId, item } },
  });
  return !!entry;
}

/**
 * Validate lock type name.
 */
export function isValidLockType(type: string): type is LockType {
  return LOCK_TYPES.includes(type as LockType);
}
