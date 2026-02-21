import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
const mockFedCreate = vi.fn().mockResolvedValue({ id: "fed-123", name: "TestFed" });
const mockFedFindUnique = vi.fn().mockResolvedValue(null);
const mockFedUpdate = vi.fn().mockResolvedValue({});
const mockFedDelete = vi.fn().mockResolvedValue({});
const mockFedBanUpsert = vi.fn().mockResolvedValue({});
const mockFedBanFindUnique = vi.fn().mockResolvedValue(null);
const mockFedBanDelete = vi.fn().mockResolvedValue({});
const mockFedAdminFindUnique = vi.fn().mockResolvedValue(null);
const mockChatFindUnique = vi.fn().mockResolvedValue(null);
const mockChatFindMany = vi.fn().mockResolvedValue([]);
const mockChatUpdateMany = vi.fn().mockResolvedValue({});
const mockFedSubscriptionFindMany = vi.fn().mockResolvedValue([]);

vi.mock("../../../src/core/database.js", () => ({
  getDatabase: vi.fn().mockReturnValue({
    federation: {
      create: (...args: unknown[]) => mockFedCreate(...args),
      findUnique: (...args: unknown[]) => mockFedFindUnique(...args),
      update: (...args: unknown[]) => mockFedUpdate(...args),
      delete: (...args: unknown[]) => mockFedDelete(...args),
    },
    fedBan: {
      upsert: (...args: unknown[]) => mockFedBanUpsert(...args),
      findUnique: (...args: unknown[]) => mockFedBanFindUnique(...args),
      delete: (...args: unknown[]) => mockFedBanDelete(...args),
    },
    fedAdmin: {
      findUnique: (...args: unknown[]) => mockFedAdminFindUnique(...args),
    },
    chat: {
      findUnique: (...args: unknown[]) => mockChatFindUnique(...args),
      findMany: (...args: unknown[]) => mockChatFindMany(...args),
      updateMany: (...args: unknown[]) => mockChatUpdateMany(...args),
    },
    fedSubscription: {
      findMany: (...args: unknown[]) => mockFedSubscriptionFindMany(...args),
    },
  }),
}));

vi.mock("../../../src/core/logger.js", () => ({
  logger: { child: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }) },
  createChildLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

vi.mock("../../../src/middleware/log-channel.middleware.js", () => ({
  sendLogEntry: vi.fn().mockResolvedValue(undefined),
}));

import {
  getFederation,
  isFedAdmin,
  isFedOwner,
  getChatFederation,
  fedBanUser,
  isUserFedBanned,
} from "../../../src/modules/federations/federation.service.js";

describe("Federation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFederation", () => {
    it("returns federation when found", async () => {
      const fed = { id: "fed-123", name: "TestFed", ownerId: BigInt(100) };
      mockFedFindUnique.mockResolvedValue(fed);

      const result = await getFederation("fed-123");
      expect(result).toEqual(fed);
    });

    it("returns null when not found", async () => {
      mockFedFindUnique.mockResolvedValue(null);

      const result = await getFederation("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("isFedOwner", () => {
    it("returns true for the owner", async () => {
      mockFedFindUnique.mockResolvedValue({
        id: "fed-123",
        name: "TestFed",
        ownerId: BigInt(100),
      });

      const result = await isFedOwner("fed-123", BigInt(100));
      expect(result).toBe(true);
    });

    it("returns false for non-owner", async () => {
      mockFedFindUnique.mockResolvedValue({
        id: "fed-123",
        name: "TestFed",
        ownerId: BigInt(100),
      });

      const result = await isFedOwner("fed-123", BigInt(200));
      expect(result).toBe(false);
    });

    it("returns false for nonexistent federation", async () => {
      mockFedFindUnique.mockResolvedValue(null);

      const result = await isFedOwner("nonexistent", BigInt(100));
      expect(result).toBe(false);
    });
  });

  describe("isFedAdmin", () => {
    it("returns true for the owner (implicit admin)", async () => {
      mockFedFindUnique.mockResolvedValue({
        id: "fed-123",
        name: "TestFed",
        ownerId: BigInt(100),
      });

      const result = await isFedAdmin("fed-123", BigInt(100));
      expect(result).toBe(true);
    });

    it("returns true for an explicit admin", async () => {
      mockFedFindUnique.mockResolvedValue({
        id: "fed-123",
        name: "TestFed",
        ownerId: BigInt(100),
      });
      mockFedAdminFindUnique.mockResolvedValue({
        federationId: "fed-123",
        userId: BigInt(200),
      });

      const result = await isFedAdmin("fed-123", BigInt(200));
      expect(result).toBe(true);
    });

    it("returns false for non-admin", async () => {
      mockFedFindUnique.mockResolvedValue({
        id: "fed-123",
        name: "TestFed",
        ownerId: BigInt(100),
      });
      mockFedAdminFindUnique.mockResolvedValue(null);

      const result = await isFedAdmin("fed-123", BigInt(300));
      expect(result).toBe(false);
    });
  });

  describe("getChatFederation", () => {
    it("returns federation when chat is in one", async () => {
      mockChatFindUnique.mockResolvedValue({ federationId: "fed-123" });
      mockFedFindUnique.mockResolvedValue({
        id: "fed-123",
        name: "TestFed",
        ownerId: BigInt(100),
      });

      const result = await getChatFederation(BigInt(-1001234567890));
      expect(result).not.toBeNull();
      expect(result!.id).toBe("fed-123");
    });

    it("returns null when chat has no federation", async () => {
      mockChatFindUnique.mockResolvedValue({ federationId: null });

      const result = await getChatFederation(BigInt(-1001234567890));
      expect(result).toBeNull();
    });
  });

  describe("fedBanUser", () => {
    it("creates a ban and returns affected chat count", async () => {
      mockChatFindMany.mockResolvedValue([
        { id: BigInt(-100111) },
        { id: BigInt(-100222) },
      ]);
      mockFedSubscriptionFindMany.mockResolvedValue([]);

      const result = await fedBanUser("fed-123", BigInt(200), BigInt(100), "spam");

      expect(mockFedBanUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            federationId: "fed-123",
            userId: BigInt(200),
            bannerId: BigInt(100),
            reason: "spam",
          }),
        })
      );
      expect(result.bannedInChats).toBe(2);
    });

    it("includes subscriber federation chats in ban scope", async () => {
      // Main fed has 1 chat
      mockChatFindMany
        .mockResolvedValueOnce([{ id: BigInt(-100111) }])
        // Subscriber fed has 2 chats
        .mockResolvedValueOnce([{ id: BigInt(-100222) }, { id: BigInt(-100333) }]);

      mockFedSubscriptionFindMany.mockResolvedValue([
        { subscriberId: "sub-fed-1" },
      ]);

      const result = await fedBanUser("fed-123", BigInt(200), BigInt(100));
      expect(result.bannedInChats).toBe(3);
    });

    it("works with zero chats in federation", async () => {
      mockChatFindMany.mockResolvedValue([]);
      mockFedSubscriptionFindMany.mockResolvedValue([]);

      const result = await fedBanUser("fed-123", BigInt(200), BigInt(100));
      expect(result.bannedInChats).toBe(0);
    });
  });

  describe("isUserFedBanned", () => {
    it("returns banned=true when user has direct ban", async () => {
      mockChatFindUnique.mockResolvedValue({ federationId: "fed-123" });
      mockFedBanFindUnique.mockResolvedValue({
        userId: BigInt(200),
        reason: "spam",
        federation: { name: "TestFed" },
      });

      const result = await isUserFedBanned(BigInt(-1001234567890), BigInt(200));
      expect(result.banned).toBe(true);
      expect(result.fedName).toBe("TestFed");
      expect(result.reason).toBe("spam");
    });

    it("returns banned=false when chat has no federation", async () => {
      mockChatFindUnique.mockResolvedValue({ federationId: null });

      const result = await isUserFedBanned(BigInt(-1001234567890), BigInt(200));
      expect(result.banned).toBe(false);
    });

    it("checks subscribed federations for bans", async () => {
      mockChatFindUnique.mockResolvedValue({ federationId: "fed-123" });
      // No direct ban
      mockFedBanFindUnique
        .mockResolvedValueOnce(null)
        // Subscribed fed has ban
        .mockResolvedValueOnce({
          userId: BigInt(200),
          reason: "cross-fed ban",
          federation: { name: "SubscribedFed" },
        });

      mockFedSubscriptionFindMany.mockResolvedValue([
        { subscribedToId: "sub-fed-1" },
      ]);

      const result = await isUserFedBanned(BigInt(-1001234567890), BigInt(200));
      expect(result.banned).toBe(true);
      expect(result.fedName).toBe("SubscribedFed");
    });

    it("returns banned=false when no ban in any federation", async () => {
      mockChatFindUnique.mockResolvedValue({ federationId: "fed-123" });
      mockFedBanFindUnique.mockResolvedValue(null);
      mockFedSubscriptionFindMany.mockResolvedValue([]);

      const result = await isUserFedBanned(BigInt(-1001234567890), BigInt(200));
      expect(result.banned).toBe(false);
    });
  });
});
