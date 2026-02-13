import { describe, it, expect } from "vitest";
import { escapeHtml, userMention, parseButtons } from "../../../src/utils/message-builder.js";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("handles multiple special characters", () => {
    expect(escapeHtml("<a & b>")).toBe("&lt;a &amp; b&gt;");
  });

  it("returns unchanged text without special chars", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("userMention", () => {
  it("creates an HTML user mention", () => {
    expect(userMention(12345, "Alice")).toBe(
      '<a href="tg://user?id=12345">Alice</a>'
    );
  });

  it("escapes the name in mentions", () => {
    expect(userMention(1, "<Bob>")).toBe(
      '<a href="tg://user?id=1">&lt;Bob&gt;</a>'
    );
  });

  it("works with bigint IDs", () => {
    expect(userMention(BigInt(999), "User")).toBe(
      '<a href="tg://user?id=999">User</a>'
    );
  });
});

describe("parseButtons", () => {
  it("returns text unchanged if no buttons", () => {
    const result = parseButtons("Hello world");
    expect(result.text).toBe("Hello world");
    expect(result.keyboard).toBeUndefined();
  });

  it("extracts a single button", () => {
    const result = parseButtons(
      "Click here [Google](buttonurl://https://google.com)"
    );
    expect(result.text).toBe("Click here");
    expect(result.keyboard).toBeDefined();
  });

  it("extracts multiple buttons", () => {
    const result = parseButtons(
      "Links: [One](buttonurl://https://one.com) [Two](buttonurl://https://two.com)"
    );
    expect(result.text).toBe("Links:");
    expect(result.keyboard).toBeDefined();
  });

  it("handles :same row modifier", () => {
    const result = parseButtons(
      "[A](buttonurl://https://a.com:same) [B](buttonurl://https://b.com)"
    );
    expect(result.text).toBe("");
    expect(result.keyboard).toBeDefined();
  });

  it("handles note buttons with # prefix", () => {
    const result = parseButtons("[Rules](buttonurl://#rules)");
    expect(result.text).toBe("");
    expect(result.keyboard).toBeDefined();
  });
});
