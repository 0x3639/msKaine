import { vi } from "vitest";
import type { BotContext, ChatSettings, PermissionInfo } from "../../src/context.js";
import type { Chat as PrismaChat } from "@prisma/client";
import type { Api, RawApi } from "grammy";
import type { Message, Chat, User } from "grammy/types";

interface MockContextOptions {
  from?: Partial<User>;
  chat?: Partial<Chat.SupergroupChat>;
  message?: Partial<Message.TextMessage>;
  match?: string;
  permissions?: Partial<PermissionInfo>;
  chatSettings?: Partial<PrismaChat>;
  isSilent?: boolean;
  replyToMessage?: Partial<Message>;
}

const DEFAULT_USER: User = {
  id: 100,
  is_bot: false,
  first_name: "TestAdmin",
  username: "testadmin",
};

const DEFAULT_CHAT: Chat.SupergroupChat = {
  id: -1001234567890,
  type: "supergroup",
  title: "Test Group",
};

const DEFAULT_BOT_INFO: User = {
  id: 999,
  is_bot: true,
  first_name: "MsKaine",
  username: "msKaine_bot",
};

function makeDefaultChatModel(overrides?: Partial<PrismaChat>): PrismaChat {
  return {
    id: BigInt(-1001234567890),
    title: "Test Group",
    chatType: "supergroup",
    language: "en",
    anonAdmin: false,
    adminError: true,
    adminCacheUpdatedAt: null,
    warnLimit: 3,
    warnMode: "BAN",
    warnTime: null,
    floodLimit: 0,
    floodMode: "MUTE",
    floodTimer: 0,
    floodClearAll: false,
    antiraidEnabled: false,
    antiraidExpiresAt: null,
    raidTime: 21600,
    raidActionTime: 3600,
    autoAntiraidLimit: 0,
    captchaEnabled: false,
    captchaMode: "BUTTON",
    captchaText: null,
    captchaKick: true,
    captchaKickTime: 120,
    captchaMuteTime: 0,
    captchaRules: false,
    welcomeEnabled: true,
    welcomeText: null,
    welcomeMediaType: null,
    welcomeMediaId: null,
    goodbyeEnabled: false,
    goodbyeText: null,
    goodbyeMediaType: null,
    goodbyeMediaId: null,
    cleanWelcome: false,
    lastWelcomeMessageId: null,
    rules: null,
    privateRules: true,
    rulesButton: null,
    privateNotes: false,
    logChannelId: null,
    logCategories: [],
    antiChannelPin: false,
    cleanLinked: false,
    reportsEnabled: true,
    cleanCommands: [],
    cleanMsgTypes: [],
    cleanService: [],
    silentActions: false,
    quietFed: false,
    federationId: null,
    blocklistMode: "DELETE",
    blocklistDelete: true,
    blocklistReason: null,
    zenonGatingEnabled: false,
    zenonGatingToken: null,
    zenonGatingMinAmount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PrismaChat;
}

/**
 * Create a mock BotContext for handler tests.
 *
 * All API methods and ctx.reply/ctx.deleteMessage are vi.fn() stubs
 * that resolve to sensible defaults. Override any option to test
 * specific scenarios.
 */
export function createMockContext(options: MockContextOptions = {}): BotContext {
  const from = { ...DEFAULT_USER, ...options.from } as User;
  const chat = { ...DEFAULT_CHAT, ...options.chat } as Chat.SupergroupChat;

  const replyMessage = options.replyToMessage
    ? {
        message_id: 50,
        date: Math.floor(Date.now() / 1000),
        chat,
        ...options.replyToMessage,
      }
    : undefined;

  const message: Message.TextMessage = {
    message_id: 100,
    date: Math.floor(Date.now() / 1000),
    chat,
    from,
    text: "",
    reply_to_message: replyMessage as Message | undefined,
    ...options.message,
  } as Message.TextMessage;

  const permissions: PermissionInfo = {
    isAdmin: true,
    isOwner: false,
    isCreator: false,
    isApproved: false,
    ...options.permissions,
  };

  const chatModel = makeDefaultChatModel(options.chatSettings);
  const chatSettings: ChatSettings = {
    chat: chatModel,
    loaded: true,
  };

  // Stub API methods — getChatMember returns admin for the bot, member for others
  const apiStubs = {
    banChatMember: vi.fn().mockResolvedValue(true),
    unbanChatMember: vi.fn().mockResolvedValue(true),
    restrictChatMember: vi.fn().mockResolvedValue(true),
    deleteMessage: vi.fn().mockResolvedValue(true),
    getChatMember: vi.fn().mockImplementation((_chatId: number, userId: number) => {
      if (userId === DEFAULT_BOT_INFO.id) {
        return Promise.resolve({
          status: "administrator",
          can_restrict_members: true,
          can_delete_messages: true,
          user: DEFAULT_BOT_INFO,
        });
      }
      return Promise.resolve({
        status: "member",
        user: { id: userId, is_bot: false, first_name: "User" },
      });
    }),
    sendMessage: vi.fn().mockResolvedValue({ message_id: 200 }),
  };

  const ctx = {
    from,
    chat,
    message,
    match: options.match ?? "",
    me: DEFAULT_BOT_INFO,

    permissions,
    chatSettings,
    isSilent: options.isSilent ?? false,
    zenon: {
      initialized: false,
      hasWallet: false,
    },

    // Stubbed context methods
    reply: vi.fn().mockResolvedValue({ message_id: 200 }),
    deleteMessage: vi.fn().mockResolvedValue(true),

    // API object
    api: apiStubs as unknown as Api<RawApi>,
  } as unknown as BotContext;

  return ctx;
}

/**
 * Create a mock context where the caller is NOT an admin.
 */
export function createNonAdminContext(options: MockContextOptions = {}): BotContext {
  return createMockContext({
    ...options,
    permissions: { isAdmin: false, isOwner: false, isCreator: false, isApproved: false, ...options.permissions },
  });
}

/**
 * Create a mock context with a reply-to-message from a target user.
 */
export function createReplyContext(
  targetUser: Partial<User> = {},
  options: MockContextOptions = {}
): BotContext {
  const target: User = {
    id: 200,
    is_bot: false,
    first_name: "TargetUser",
    ...targetUser,
  };

  return createMockContext({
    ...options,
    replyToMessage: {
      from: target,
      text: "some message from target",
      ...(options.replyToMessage ?? {}),
    },
  });
}

export { DEFAULT_USER, DEFAULT_CHAT, DEFAULT_BOT_INFO };
