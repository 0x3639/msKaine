import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * Integration tests for database operations.
 * Requires a running PostgreSQL instance with DATABASE_URL set.
 *
 * Run with: npm run test:integration
 */

let prisma: PrismaClient;

const TEST_CHAT_ID = BigInt(-1009999999999);
const TEST_USER_ID = BigInt(111111);
const TEST_USER_2_ID = BigInt(222222);
const TEST_ADMIN_ID = BigInt(333333);

beforeAll(async () => {
  prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Clean up test data before each test suite
beforeEach(async () => {
  // Delete in order respecting foreign keys
  await prisma.scheduledAction.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.captchaPending.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.warning.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.chatAdmin.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.logEntry.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.note.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.filter.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.blocklist.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.chatLock.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.disabledCommand.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.approvedUser.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.connection.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.allowlistEntry.deleteMany({ where: { chatId: TEST_CHAT_ID } });
  await prisma.chat.deleteMany({ where: { id: TEST_CHAT_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [TEST_USER_ID, TEST_USER_2_ID, TEST_ADMIN_ID] } } });
});

describe("Chat operations", () => {
  it("creates a chat with default settings", async () => {
    const chat = await prisma.chat.create({
      data: { id: TEST_CHAT_ID, title: "Integration Test Chat" },
    });

    expect(chat.id).toBe(TEST_CHAT_ID);
    expect(chat.warnLimit).toBe(3);
    expect(chat.warnMode).toBe("BAN");
    expect(chat.captchaEnabled).toBe(false);
    expect(chat.captchaMode).toBe("BUTTON");
    expect(chat.floodLimit).toBe(0);
    expect(chat.welcomeEnabled).toBe(true);
  });

  it("upserts a chat (create then update)", async () => {
    await prisma.chat.upsert({
      where: { id: TEST_CHAT_ID },
      create: { id: TEST_CHAT_ID, title: "First Title" },
      update: { title: "Updated Title" },
    });

    let chat = await prisma.chat.findUnique({ where: { id: TEST_CHAT_ID } });
    expect(chat?.title).toBe("First Title");

    await prisma.chat.upsert({
      where: { id: TEST_CHAT_ID },
      create: { id: TEST_CHAT_ID, title: "First Title" },
      update: { title: "Updated Title" },
    });

    chat = await prisma.chat.findUnique({ where: { id: TEST_CHAT_ID } });
    expect(chat?.title).toBe("Updated Title");
  });

  it("updates chat settings", async () => {
    await prisma.chat.create({
      data: { id: TEST_CHAT_ID, title: "Test" },
    });

    const updated = await prisma.chat.update({
      where: { id: TEST_CHAT_ID },
      data: {
        warnLimit: 5,
        warnMode: "MUTE",
        captchaEnabled: true,
        captchaMode: "MATH",
      },
    });

    expect(updated.warnLimit).toBe(5);
    expect(updated.warnMode).toBe("MUTE");
    expect(updated.captchaEnabled).toBe(true);
    expect(updated.captchaMode).toBe("MATH");
  });
});

describe("User operations", () => {
  it("upserts a user", async () => {
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      create: { id: TEST_USER_ID, username: "testuser", firstName: "Test" },
      update: { firstName: "Test" },
    });

    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    expect(user?.username).toBe("testuser");
    expect(user?.firstName).toBe("Test");
  });
});

describe("Warning operations", () => {
  beforeEach(async () => {
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      create: { id: TEST_USER_ID, firstName: "Target" },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: TEST_ADMIN_ID },
      create: { id: TEST_ADMIN_ID, firstName: "Admin" },
      update: {},
    });
    await prisma.chat.upsert({
      where: { id: TEST_CHAT_ID },
      create: { id: TEST_CHAT_ID, title: "Test Chat" },
      update: {},
    });
  });

  it("creates a warning and counts correctly", async () => {
    await prisma.warning.create({
      data: {
        chatId: TEST_CHAT_ID,
        userId: TEST_USER_ID,
        warnerId: TEST_ADMIN_ID,
        reason: "test warning",
      },
    });

    const count = await prisma.warning.count({
      where: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID },
    });
    expect(count).toBe(1);
  });

  it("enforces warn limit tracking", async () => {
    // Create 3 warnings to hit the default limit
    for (let i = 0; i < 3; i++) {
      await prisma.warning.create({
        data: {
          chatId: TEST_CHAT_ID,
          userId: TEST_USER_ID,
          warnerId: TEST_ADMIN_ID,
          reason: `warning ${i + 1}`,
        },
      });
    }

    const count = await prisma.warning.count({
      where: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID },
    });
    expect(count).toBe(3);

    const chat = await prisma.chat.findUnique({
      where: { id: TEST_CHAT_ID },
      select: { warnLimit: true },
    });
    expect(count).toBeGreaterThanOrEqual(chat!.warnLimit);
  });

  it("deletes the most recent warning", async () => {
    await prisma.warning.create({
      data: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID, warnerId: TEST_ADMIN_ID, reason: "first" },
    });
    await prisma.warning.create({
      data: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID, warnerId: TEST_ADMIN_ID, reason: "second" },
    });

    const last = await prisma.warning.findFirst({
      where: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID },
      orderBy: { createdAt: "desc" },
    });
    expect(last?.reason).toBe("second");

    await prisma.warning.delete({ where: { id: last!.id } });

    const remaining = await prisma.warning.findMany({
      where: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].reason).toBe("first");
  });

  it("resets all warnings for a user", async () => {
    for (let i = 0; i < 3; i++) {
      await prisma.warning.create({
        data: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID, warnerId: TEST_ADMIN_ID },
      });
    }

    const result = await prisma.warning.deleteMany({
      where: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID },
    });
    expect(result.count).toBe(3);
  });
});

describe("Scheduled action operations", () => {
  beforeEach(async () => {
    await prisma.chat.upsert({
      where: { id: TEST_CHAT_ID },
      create: { id: TEST_CHAT_ID, title: "Test" },
      update: {},
    });
  });

  it("creates a scheduled action", async () => {
    const executeAt = new Date(Date.now() + 3600000); // 1 hour from now
    const action = await prisma.scheduledAction.create({
      data: {
        chatId: TEST_CHAT_ID,
        userId: TEST_USER_ID,
        actionType: "unban",
        executeAt,
      },
    });

    expect(action.actionType).toBe("unban");
    expect(action.completed).toBe(false);
  });

  it("finds overdue actions", async () => {
    const pastTime = new Date(Date.now() - 1000); // 1 second ago
    await prisma.scheduledAction.create({
      data: {
        chatId: TEST_CHAT_ID,
        userId: TEST_USER_ID,
        actionType: "unban",
        executeAt: pastTime,
      },
    });

    const futureTime = new Date(Date.now() + 3600000);
    await prisma.scheduledAction.create({
      data: {
        chatId: TEST_CHAT_ID,
        userId: TEST_USER_2_ID,
        actionType: "unmute",
        executeAt: futureTime,
      },
    });

    const overdue = await prisma.scheduledAction.findMany({
      where: {
        completed: false,
        executeAt: { lte: new Date() },
      },
    });

    expect(overdue.length).toBeGreaterThanOrEqual(1);
    expect(overdue.every((a) => a.actionType === "unban" || a.executeAt <= new Date())).toBe(true);
  });

  it("marks actions as completed", async () => {
    const action = await prisma.scheduledAction.create({
      data: {
        chatId: TEST_CHAT_ID,
        userId: TEST_USER_ID,
        actionType: "captcha_kick",
        executeAt: new Date(),
      },
    });

    await prisma.scheduledAction.update({
      where: { id: action.id },
      data: { completed: true },
    });

    const updated = await prisma.scheduledAction.findUnique({
      where: { id: action.id },
    });
    expect(updated?.completed).toBe(true);
  });
});

describe("CAPTCHA pending operations", () => {
  beforeEach(async () => {
    await prisma.chat.upsert({
      where: { id: TEST_CHAT_ID },
      create: { id: TEST_CHAT_ID, title: "Test" },
      update: {},
    });
  });

  it("creates a CAPTCHA pending entry", async () => {
    const entry = await prisma.captchaPending.create({
      data: {
        chatId: TEST_CHAT_ID,
        userId: TEST_USER_ID,
        messageId: 100,
        answer: "42",
        expiresAt: new Date(Date.now() + 120000),
      },
    });

    expect(entry.answer).toBe("42");
  });

  it("uses unique constraint on chatId + userId", async () => {
    await prisma.captchaPending.create({
      data: {
        chatId: TEST_CHAT_ID,
        userId: TEST_USER_ID,
        messageId: 100,
        answer: "abc",
        expiresAt: new Date(Date.now() + 120000),
      },
    });

    // Upsert should update instead of creating a second entry
    await prisma.captchaPending.upsert({
      where: { chatId_userId: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID } },
      create: {
        chatId: TEST_CHAT_ID,
        userId: TEST_USER_ID,
        messageId: 200,
        answer: "def",
        expiresAt: new Date(Date.now() + 120000),
      },
      update: {
        messageId: 200,
        answer: "def",
      },
    });

    const entries = await prisma.captchaPending.findMany({
      where: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].answer).toBe("def");
    expect(entries[0].messageId).toBe(200);
  });

  it("finds expired CAPTCHA entries", async () => {
    await prisma.captchaPending.create({
      data: {
        chatId: TEST_CHAT_ID,
        userId: TEST_USER_ID,
        answer: "42",
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    });

    const expired = await prisma.captchaPending.findMany({
      where: { expiresAt: { lte: new Date() } },
    });
    expect(expired.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Federation operations", () => {
  let fedId: string;

  beforeEach(async () => {
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      create: { id: TEST_USER_ID, firstName: "Owner" },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: TEST_USER_2_ID },
      create: { id: TEST_USER_2_ID, firstName: "BannedUser" },
      update: {},
    });

    const fed = await prisma.federation.create({
      data: { name: "Test Federation", ownerId: TEST_USER_ID },
    });
    fedId = fed.id;
  });

  afterAll(async () => {
    // Clean up federation data
    await prisma.fedBan.deleteMany({});
    await prisma.fedAdmin.deleteMany({});
    await prisma.fedSubscription.deleteMany({});
    await prisma.chat.updateMany({ where: { federationId: { not: null } }, data: { federationId: null } });
    await prisma.federation.deleteMany({});
  });

  it("creates a federation", async () => {
    const fed = await prisma.federation.findUnique({ where: { id: fedId } });
    expect(fed?.name).toBe("Test Federation");
    expect(fed?.ownerId).toBe(TEST_USER_ID);
  });

  it("creates a federation ban", async () => {
    await prisma.fedBan.create({
      data: {
        federationId: fedId,
        userId: TEST_USER_2_ID,
        bannerId: TEST_USER_ID,
        reason: "spam",
      },
    });

    const ban = await prisma.fedBan.findUnique({
      where: { federationId_userId: { federationId: fedId, userId: TEST_USER_2_ID } },
    });
    expect(ban).not.toBeNull();
    expect(ban?.reason).toBe("spam");
  });

  it("checks if user is fed-banned", async () => {
    await prisma.fedBan.create({
      data: {
        federationId: fedId,
        userId: TEST_USER_2_ID,
        bannerId: TEST_USER_ID,
      },
    });

    const ban = await prisma.fedBan.findUnique({
      where: { federationId_userId: { federationId: fedId, userId: TEST_USER_2_ID } },
    });
    expect(ban).not.toBeNull();

    const noBan = await prisma.fedBan.findUnique({
      where: { federationId_userId: { federationId: fedId, userId: TEST_ADMIN_ID } },
    });
    expect(noBan).toBeNull();
  });
});
