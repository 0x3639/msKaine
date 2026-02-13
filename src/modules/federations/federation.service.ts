import { getDatabase } from "../../core/database.js";

export interface FedInfo {
  id: string;
  name: string;
  ownerId: bigint;
  reasonRequired: boolean;
  notifyOnBan: boolean;
  logChannelId: bigint | null;
}

/**
 * Get federation by ID.
 */
export async function getFederation(fedId: string): Promise<FedInfo | null> {
  const db = getDatabase();
  return db.federation.findUnique({ where: { id: fedId } });
}

/**
 * Check if user is a federation admin or owner.
 */
export async function isFedAdmin(fedId: string, userId: bigint): Promise<boolean> {
  const fed = await getFederation(fedId);
  if (!fed) return false;
  if (fed.ownerId === userId) return true;

  const db = getDatabase();
  const admin = await db.fedAdmin.findUnique({
    where: { federationId_userId: { federationId: fedId, userId } },
  });
  return !!admin;
}

/**
 * Check if user is federation owner.
 */
export async function isFedOwner(fedId: string, userId: bigint): Promise<boolean> {
  const fed = await getFederation(fedId);
  return fed?.ownerId === userId;
}

/**
 * Get federation that a chat belongs to.
 */
export async function getChatFederation(chatId: bigint): Promise<FedInfo | null> {
  const db = getDatabase();
  const chat = await db.chat.findUnique({
    where: { id: chatId },
    select: { federationId: true },
  });

  if (!chat?.federationId) return null;
  return getFederation(chat.federationId);
}

/**
 * Federation ban a user across all chats in the federation + subscribed feds.
 */
export async function fedBanUser(
  fedId: string,
  userId: bigint,
  bannerId: bigint,
  reason?: string
): Promise<{ bannedInChats: number }> {
  const db = getDatabase();

  // Create or update the ban
  await db.fedBan.upsert({
    where: { federationId_userId: { federationId: fedId, userId } },
    create: { federationId: fedId, userId, bannerId, reason },
    update: { bannerId, reason },
  });

  // Get all chats in this federation
  const chats = await db.chat.findMany({
    where: { federationId: fedId },
    select: { id: true },
  });

  // Also get subscriber feds and their chats
  const subscribers = await db.fedSubscription.findMany({
    where: { subscribedToId: fedId },
    select: { subscriberId: true },
  });

  for (const sub of subscribers) {
    const subChats = await db.chat.findMany({
      where: { federationId: sub.subscriberId },
      select: { id: true },
    });
    chats.push(...subChats);
  }

  return { bannedInChats: chats.length };
}

/**
 * Get all chats in a federation (including subscriber feds).
 */
export async function getFedChats(fedId: string): Promise<bigint[]> {
  const db = getDatabase();
  const chats = await db.chat.findMany({
    where: { federationId: fedId },
    select: { id: true },
  });
  return chats.map((c) => c.id);
}

/**
 * Check if a user is fed-banned in any federation the chat subscribes to.
 */
export async function isUserFedBanned(
  chatId: bigint,
  userId: bigint
): Promise<{ banned: boolean; fedName?: string; reason?: string }> {
  const db = getDatabase();
  const chat = await db.chat.findUnique({
    where: { id: chatId },
    select: { federationId: true },
  });

  if (!chat?.federationId) return { banned: false };

  // Check direct federation ban
  const directBan = await db.fedBan.findUnique({
    where: { federationId_userId: { federationId: chat.federationId, userId } },
    include: { federation: { select: { name: true } } },
  });

  if (directBan) {
    return { banned: true, fedName: directBan.federation.name, reason: directBan.reason ?? undefined };
  }

  // Check subscribed federations
  const subscriptions = await db.fedSubscription.findMany({
    where: { subscriberId: chat.federationId },
    select: { subscribedToId: true },
  });

  for (const sub of subscriptions) {
    const ban = await db.fedBan.findUnique({
      where: { federationId_userId: { federationId: sub.subscribedToId, userId } },
      include: { federation: { select: { name: true } } },
    });
    if (ban) {
      return { banned: true, fedName: ban.federation.name, reason: ban.reason ?? undefined };
    }
  }

  return { banned: false };
}
