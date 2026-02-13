import { describe, it, expect } from "vitest";
import { parseDuration, formatDuration } from "../../../src/utils/time-parser.js";

describe("parseDuration", () => {
  it("parses minutes", () => {
    expect(parseDuration("30m")).toBe(30 * 60);
    expect(parseDuration("1min")).toBe(60);
    expect(parseDuration("5mins")).toBe(5 * 60);
    expect(parseDuration("2 minutes")).toBe(2 * 60);
  });

  it("parses hours", () => {
    expect(parseDuration("1h")).toBe(3600);
    expect(parseDuration("2hrs")).toBe(2 * 3600);
    expect(parseDuration("24hours")).toBe(24 * 3600);
  });

  it("parses days", () => {
    expect(parseDuration("1d")).toBe(86400);
    expect(parseDuration("7days")).toBe(7 * 86400);
  });

  it("parses weeks", () => {
    expect(parseDuration("1w")).toBe(604800);
    expect(parseDuration("2weeks")).toBe(2 * 604800);
  });

  it("is case insensitive", () => {
    expect(parseDuration("1H")).toBe(3600);
    expect(parseDuration("2D")).toBe(2 * 86400);
    expect(parseDuration("1W")).toBe(604800);
  });

  it("trims whitespace", () => {
    expect(parseDuration("  1h  ")).toBe(3600);
  });

  it("returns null for invalid input", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("0h")).toBeNull();
    expect(parseDuration("-1d")).toBeNull();
    expect(parseDuration("1x")).toBeNull();
    expect(parseDuration("1.5h")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats single units", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(86400)).toBe("1d");
    expect(formatDuration(604800)).toBe("1w");
  });

  it("formats combined units", () => {
    expect(formatDuration(90060)).toBe("1d 1h 1m");
    expect(formatDuration(694800)).toBe("1w 1d 1h");
  });

  it("shows seconds only when there are no larger units", () => {
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(90)).toBe("1m"); // seconds dropped when minutes exist
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("handles negative values", () => {
    expect(formatDuration(-1)).toBe("0s");
  });
});
