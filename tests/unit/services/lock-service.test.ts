import { describe, it, expect } from "vitest";
import {
  detectLockedContent,
  isValidLockType,
} from "../../../src/modules/locks/lock.service.js";
import type { Message } from "grammy/types";

// Only testing pure functions — DB functions require mocking Prisma

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    message_id: 1,
    date: Math.floor(Date.now() / 1000),
    chat: { id: -1001234, type: "supergroup", title: "Test" },
    ...overrides,
  } as Message;
}

describe("detectLockedContent", () => {
  it("detects text messages", () => {
    const result = detectLockedContent(makeMsg({ text: "hello" }));
    expect(result).toContain("text");
  });

  it("detects stickers", () => {
    const result = detectLockedContent(
      makeMsg({
        sticker: {
          file_id: "123",
          file_unique_id: "u123",
          type: "regular",
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
        },
      })
    );
    expect(result).toContain("sticker");
    expect(result).toContain("media");
  });

  it("detects photos", () => {
    const result = detectLockedContent(
      makeMsg({
        photo: [
          { file_id: "123", file_unique_id: "u123", width: 100, height: 100 },
        ],
      })
    );
    expect(result).toContain("photo");
    expect(result).toContain("media");
  });

  it("detects GIFs (animations)", () => {
    const result = detectLockedContent(
      makeMsg({
        animation: {
          file_id: "123",
          file_unique_id: "u123",
          width: 100,
          height: 100,
          duration: 3,
        },
      })
    );
    expect(result).toContain("gif");
    expect(result).toContain("media");
  });

  it("detects URLs in entities", () => {
    const result = detectLockedContent(
      makeMsg({
        text: "Visit https://example.com",
        entities: [{ type: "url", offset: 6, length: 19 }],
      })
    );
    expect(result).toContain("url");
  });

  it("detects invite links", () => {
    const result = detectLockedContent(
      makeMsg({
        text: "Join https://t.me/mygroup",
        entities: [{ type: "url", offset: 5, length: 21 }],
      })
    );
    expect(result).toContain("url");
    expect(result).toContain("invitelink");
  });

  it("detects bot commands", () => {
    const result = detectLockedContent(
      makeMsg({
        text: "/start",
        entities: [{ type: "bot_command", offset: 0, length: 6 }],
      })
    );
    expect(result).toContain("command");
  });

  it("detects forwarded messages", () => {
    const result = detectLockedContent(
      makeMsg({
        text: "forwarded text",
        forward_origin: { type: "user", date: 123, sender_user: { id: 1, is_bot: false, first_name: "Test" } },
      })
    );
    expect(result).toContain("forward");
  });

  it("detects polls", () => {
    const result = detectLockedContent(
      makeMsg({
        poll: {
          id: "123",
          question: "Test?",
          options: [],
          total_voter_count: 0,
          is_closed: false,
          is_anonymous: true,
          type: "regular",
          allows_multiple_answers: false,
        },
      })
    );
    expect(result).toContain("poll");
  });

  it("detects anonymous channel posts", () => {
    const result = detectLockedContent(
      makeMsg({
        text: "hello",
        sender_chat: { id: -100123, type: "channel", title: "Chan" },
      })
    );
    expect(result).toContain("anonchannel");
  });

  it("returns empty array for minimal message", () => {
    const result = detectLockedContent(makeMsg({}));
    expect(result).toEqual([]);
  });
});

describe("isValidLockType", () => {
  it("accepts valid lock types", () => {
    expect(isValidLockType("text")).toBe(true);
    expect(isValidLockType("media")).toBe(true);
    expect(isValidLockType("sticker")).toBe(true);
    expect(isValidLockType("all")).toBe(true);
    expect(isValidLockType("anonchannel")).toBe(true);
  });

  it("rejects invalid lock types", () => {
    expect(isValidLockType("invalid")).toBe(false);
    expect(isValidLockType("")).toBe(false);
    expect(isValidLockType("TEXT")).toBe(false); // case sensitive
  });
});
