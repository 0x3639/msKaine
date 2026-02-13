import { Context, SessionFlavor } from "grammy";
import type { Chat as PrismaChat } from "@prisma/client";
import type { ZenonClient } from "./core/zenon-client.js";

export interface SessionData {
  // Per-chat session state (stored in DB)
}

export interface ChatSettings {
  chat: PrismaChat;
  loaded: boolean;
}

export interface PermissionInfo {
  isAdmin: boolean;
  isOwner: boolean;
  isCreator: boolean;
  isApproved: boolean;
}

export interface ConnectionInfo {
  chatId: bigint;
  chatTitle: string;
}

export interface BotContext extends Context, SessionFlavor<SessionData> {
  chatSettings: ChatSettings;
  permissions: PermissionInfo;
  connection?: ConnectionInfo;
  zenon: ZenonClient;
  isSilent: boolean;
}
