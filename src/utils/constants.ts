export const LOCK_TYPES = [
  "all",
  "text",
  "media",
  "sticker",
  "gif",
  "photo",
  "video",
  "audio",
  "voice",
  "videonote",
  "document",
  "url",
  "forward",
  "game",
  "location",
  "contact",
  "poll",
  "dice",
  "inline",
  "button",
  "emoji",
  "anonchannel",
  "invitelink",
  "phone",
  "command",
  "topic",
] as const;

export type LockType = (typeof LOCK_TYPES)[number];

export const LOG_CATEGORIES = [
  "settings",
  "admin",
  "user",
  "automated",
  "reports",
  "other",
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const CLEAN_COMMAND_TYPES = [
  "admin",
  "user",
  "other",
  "all",
] as const;

export const CLEAN_MSG_TYPES = [
  "action",
  "filter",
  "note",
  "all",
] as const;

export const CLEAN_SERVICE_TYPES = [
  "all",
  "join",
  "leave",
  "other",
  "photo",
  "pin",
  "title",
  "videochat",
] as const;

export const BOT_NAME = "Mr. Kaine";
export const BOT_USERNAME = "mr_kaine_admin_bot";
