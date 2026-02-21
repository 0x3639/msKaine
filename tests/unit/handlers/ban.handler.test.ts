import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createNonAdminContext,
  createReplyContext,
} from "../../helpers/mock-context.js";

// Mock the services that ban handlers depend on
vi.mock("../../../src/core/database.js", () => ({
  getDatabase: vi.fn().mockReturnValue({
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
  banUser,
  muteUser,
  kickUser,
  unbanUser,
  unmuteUser,
  resolveTarget,
  getArgsAfterUser,
} from "../../../src/modules/bans/restriction.service.js";

describe("Ban restriction service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("banUser", () => {
    it("bans a user and returns success message", async () => {
      const ctx = createMockContext();
      const result = await banUser(ctx, {
        targetId: 200,
        targetName: "TargetUser",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("TargetUser");
      expect(result.message).toContain("banned");
      expect(ctx.api.banChatMember).toHaveBeenCalledWith(
        ctx.chat!.id,
        200,
        { until_date: undefined }
      );
    });

    it("includes reason in the message", async () => {
      const ctx = createMockContext();
      const result = await banUser(ctx, {
        targetId: 200,
        targetName: "TargetUser",
        reason: "spamming",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("spamming");
    });

    it("sets until_date for temporary ban", async () => {
      const ctx = createMockContext();
      const beforeTime = Math.floor(Date.now() / 1000);

      const result = await banUser(ctx, {
        targetId: 200,
        targetName: "TargetUser",
        duration: 3600,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("1h");
      const call = vi.mocked(ctx.api.banChatMember).mock.calls[0];
      const untilDate = call[2]?.until_date as number;
      expect(untilDate).toBeGreaterThanOrEqual(beforeTime + 3600);
    });

    it("fails when bot cannot restrict", async () => {
      const ctx = createMockContext();
      vi.mocked(ctx.api.getChatMember).mockImplementation((_chatId: any, userId: any) => {
        // Bot is just a regular member, no admin perms
        if (userId === 999) {
          return Promise.resolve({
            status: "member",
            user: { id: 999, is_bot: true, first_name: "Bot" },
          } as any);
        }
        return Promise.resolve({
          status: "member",
          user: { id: userId, is_bot: false, first_name: "User" },
        } as any);
      });

      const result = await banUser(ctx, {
        targetId: 200,
        targetName: "TargetUser",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("permission");
    });

    it("fails when targeting the group creator", async () => {
      const ctx = createMockContext();
      vi.mocked(ctx.api.getChatMember).mockImplementation((_chatId: any, userId: any) => {
        if (userId === 999) {
          return Promise.resolve({
            status: "administrator",
            can_restrict_members: true,
            user: { id: 999, is_bot: true, first_name: "Bot" },
          } as any);
        }
        // Target is the creator
        return Promise.resolve({
          status: "creator",
          user: { id: 200, is_bot: false, first_name: "Creator" },
        } as any);
      });

      const result = await banUser(ctx, {
        targetId: 200,
        targetName: "Creator",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("creator");
    });

    it("fails when targeting the bot itself", async () => {
      const ctx = createMockContext();
      const result = await banUser(ctx, {
        targetId: ctx.me.id,
        targetName: "Bot",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("myself");
    });

    it("deletes the replied message when deleteMessage is true", async () => {
      const ctx = createReplyContext();
      await banUser(ctx, {
        targetId: 200,
        targetName: "TargetUser",
        deleteMessage: true,
      });

      expect(ctx.api.deleteMessage).toHaveBeenCalled();
    });
  });

  describe("muteUser", () => {
    it("mutes a user with all permissions revoked", async () => {
      const ctx = createMockContext();
      const result = await muteUser(ctx, {
        targetId: 200,
        targetName: "TargetUser",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("muted");
      expect(ctx.api.restrictChatMember).toHaveBeenCalledWith(
        ctx.chat!.id,
        200,
        expect.objectContaining({ can_send_messages: false }),
        expect.any(Object)
      );
    });

    it("includes duration for temporary mute", async () => {
      const ctx = createMockContext();
      const result = await muteUser(ctx, {
        targetId: 200,
        targetName: "TargetUser",
        duration: 7200,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("2h");
    });
  });

  describe("kickUser", () => {
    it("bans then unbans to kick", async () => {
      const ctx = createMockContext();
      const result = await kickUser(ctx, {
        targetId: 200,
        targetName: "TargetUser",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("kicked");
      expect(ctx.api.banChatMember).toHaveBeenCalledWith(ctx.chat!.id, 200);
      expect(ctx.api.unbanChatMember).toHaveBeenCalledWith(
        ctx.chat!.id,
        200,
        { only_if_banned: true }
      );
    });
  });

  describe("unbanUser", () => {
    it("unbans a user", async () => {
      const ctx = createMockContext();
      const result = await unbanUser(ctx, 200, "TargetUser");

      expect(result.success).toBe(true);
      expect(result.message).toContain("unbanned");
      expect(ctx.api.unbanChatMember).toHaveBeenCalledWith(
        ctx.chat!.id,
        200,
        { only_if_banned: true }
      );
    });
  });

  describe("unmuteUser", () => {
    it("restores all permissions", async () => {
      const ctx = createMockContext();
      const result = await unmuteUser(ctx, 200, "TargetUser");

      expect(result.success).toBe(true);
      expect(result.message).toContain("unmuted");
      expect(ctx.api.restrictChatMember).toHaveBeenCalledWith(
        ctx.chat!.id,
        200,
        expect.objectContaining({ can_send_messages: true })
      );
    });
  });

  describe("getArgsAfterUser", () => {
    it("returns full string when no user prefix", () => {
      expect(getArgsAfterUser("some reason text")).toBe("some reason text");
    });

    it("strips @username prefix", () => {
      expect(getArgsAfterUser("@user reason here")).toBe("reason here");
    });

    it("strips numeric ID prefix", () => {
      expect(getArgsAfterUser("12345 reason here")).toBe("reason here");
    });

    it("returns empty for empty input", () => {
      expect(getArgsAfterUser("")).toBe("");
    });
  });
});
