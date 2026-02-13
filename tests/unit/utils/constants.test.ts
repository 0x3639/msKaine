import { describe, it, expect } from "vitest";
import {
  LOCK_TYPES,
  LOG_CATEGORIES,
  CLEAN_COMMAND_TYPES,
  CLEAN_MSG_TYPES,
  CLEAN_SERVICE_TYPES,
  BOT_NAME,
  BOT_USERNAME,
} from "../../../src/utils/constants.js";

describe("constants", () => {
  it("LOCK_TYPES contains expected entries", () => {
    expect(LOCK_TYPES).toContain("text");
    expect(LOCK_TYPES).toContain("media");
    expect(LOCK_TYPES).toContain("sticker");
    expect(LOCK_TYPES).toContain("all");
    expect(LOCK_TYPES.length).toBeGreaterThan(20);
  });

  it("LOG_CATEGORIES contains expected entries", () => {
    expect(LOG_CATEGORIES).toContain("settings");
    expect(LOG_CATEGORIES).toContain("admin");
    expect(LOG_CATEGORIES).toContain("user");
  });

  it("CLEAN_COMMAND_TYPES has valid entries", () => {
    expect(CLEAN_COMMAND_TYPES).toContain("all");
    expect(CLEAN_COMMAND_TYPES).toContain("admin");
  });

  it("CLEAN_MSG_TYPES has valid entries", () => {
    expect(CLEAN_MSG_TYPES).toContain("all");
    expect(CLEAN_MSG_TYPES).toContain("note");
  });

  it("CLEAN_SERVICE_TYPES has valid entries", () => {
    expect(CLEAN_SERVICE_TYPES).toContain("all");
    expect(CLEAN_SERVICE_TYPES).toContain("join");
    expect(CLEAN_SERVICE_TYPES).toContain("leave");
  });

  it("BOT_NAME and BOT_USERNAME are set", () => {
    expect(BOT_NAME).toBe("Mr. Kaine");
    expect(BOT_USERNAME).toBe("mr_kaine_admin_bot");
  });
});
