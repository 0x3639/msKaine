import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
const mockCreate = vi.fn().mockResolvedValue({ id: 1 });
const mockCount = vi.fn().mockResolvedValue(1);
const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
const mockFindFirst = vi.fn().mockResolvedValue(null);
const mockFindMany = vi.fn().mockResolvedValue([]);
const mockDelete = vi.fn().mockResolvedValue({});

vi.mock("../../../src/core/database.js", () => ({
  getDatabase: vi.fn().mockReturnValue({
    warning: {
      create: (...args: unknown[]) => mockCreate(...args),
      count: (...args: unknown[]) => mockCount(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    scheduledAction: { create: vi.fn().mockResolvedValue({}) },
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
  addWarning,
  removeLastWarning,
  resetWarnings,
  getWarnings,
} from "../../../src/modules/warnings/warning.service.js";
import { createMockContext } from "../../helpers/mock-context.js";

describe("Warning service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addWarning", () => {
    it("creates a warning and returns count below limit", async () => {
      mockCount.mockResolvedValue(1);
      const ctx = createMockContext({ chatSettings: { warnLimit: 3 } });

      const result = await addWarning(ctx, BigInt(200), BigInt(100), "test reason");

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: BigInt(200),
          warnerId: BigInt(100),
          reason: "test reason",
        }),
      });
      expect(result.count).toBe(1);
      expect(result.limit).toBe(3);
      expect(result.actionTriggered).toBe(false);
    });

    it("triggers ban action when warn limit is reached", async () => {
      mockCount.mockResolvedValue(3);
      const ctx = createMockContext({ chatSettings: { warnLimit: 3, warnMode: "BAN" } });

      const result = await addWarning(ctx, BigInt(200), BigInt(100));

      expect(result.actionTriggered).toBe(true);
      expect(result.actionText).toBe("banned");
      // Warnings should be cleared after action
      expect(mockDeleteMany).toHaveBeenCalled();
      // Ban should have been called
      expect(ctx.api.banChatMember).toHaveBeenCalled();
    });

    it("triggers mute action when mode is MUTE", async () => {
      mockCount.mockResolvedValue(3);
      const ctx = createMockContext({ chatSettings: { warnLimit: 3, warnMode: "MUTE" } });

      const result = await addWarning(ctx, BigInt(200), BigInt(100));

      expect(result.actionTriggered).toBe(true);
      expect(result.actionText).toBe("muted");
      expect(ctx.api.restrictChatMember).toHaveBeenCalled();
    });

    it("triggers kick action when mode is KICK", async () => {
      mockCount.mockResolvedValue(3);
      const ctx = createMockContext({ chatSettings: { warnLimit: 3, warnMode: "KICK" } });

      const result = await addWarning(ctx, BigInt(200), BigInt(100));

      expect(result.actionTriggered).toBe(true);
      expect(result.actionText).toBe("kicked");
      // Kick = ban + unban
      expect(ctx.api.banChatMember).toHaveBeenCalled();
      expect(ctx.api.unbanChatMember).toHaveBeenCalled();
    });

    it("triggers temporary ban when mode is TBAN", async () => {
      mockCount.mockResolvedValue(3);
      const ctx = createMockContext({
        chatSettings: { warnLimit: 3, warnMode: "TBAN", warnTime: 3600 },
      });

      const result = await addWarning(ctx, BigInt(200), BigInt(100));

      expect(result.actionTriggered).toBe(true);
      expect(result.actionText).toBe("temporarily banned");
    });

    it("does not trigger action when count is below limit", async () => {
      mockCount.mockResolvedValue(2);
      const ctx = createMockContext({ chatSettings: { warnLimit: 3 } });

      const result = await addWarning(ctx, BigInt(200), BigInt(100));

      expect(result.actionTriggered).toBe(false);
      expect(ctx.api.banChatMember).not.toHaveBeenCalled();
    });

    it("stores warning without reason when none provided", async () => {
      mockCount.mockResolvedValue(1);
      const ctx = createMockContext({ chatSettings: { warnLimit: 3 } });

      await addWarning(ctx, BigInt(200), BigInt(100));

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ reason: undefined }),
      });
    });
  });

  describe("removeLastWarning", () => {
    it("removes the most recent warning", async () => {
      mockFindFirst.mockResolvedValue({ id: 5 });

      const result = await removeLastWarning(BigInt(-1001234567890), BigInt(200));

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it("returns false when user has no warnings", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await removeLastWarning(BigInt(-1001234567890), BigInt(200));

      expect(result).toBe(false);
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe("resetWarnings", () => {
    it("deletes all warnings and returns count", async () => {
      mockDeleteMany.mockResolvedValue({ count: 3 });

      const count = await resetWarnings(BigInt(-1001234567890), BigInt(200));

      expect(count).toBe(3);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { chatId: BigInt(-1001234567890), userId: BigInt(200) },
      });
    });
  });

  describe("getWarnings", () => {
    it("returns all warnings for a user", async () => {
      const warnings = [
        { reason: "reason 1", createdAt: new Date(), warnerId: BigInt(100) },
        { reason: null, createdAt: new Date(), warnerId: BigInt(100) },
      ];
      mockFindMany.mockResolvedValue(warnings);

      const result = await getWarnings(BigInt(-1001234567890), BigInt(200));

      expect(result).toHaveLength(2);
      expect(result[0].reason).toBe("reason 1");
    });

    it("returns empty array when user has no warnings", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await getWarnings(BigInt(-1001234567890), BigInt(200));

      expect(result).toEqual([]);
    });
  });
});
