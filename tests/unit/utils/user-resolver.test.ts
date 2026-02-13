import { describe, it, expect } from "vitest";
import {
  extractReason,
  extractDurationAndReason,
} from "../../../src/utils/user-resolver.js";

// Only testing the pure functions here — resolveUser requires grammY context

describe("extractReason", () => {
  it("returns undefined for single word", () => {
    expect(extractReason("@user")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(extractReason("")).toBeUndefined();
  });

  it("extracts reason after user identifier", () => {
    expect(extractReason("@user spamming links")).toBe("spamming links");
  });

  it("extracts reason after numeric ID", () => {
    expect(extractReason("12345 abusive behavior")).toBe("abusive behavior");
  });

  it("trims whitespace", () => {
    expect(extractReason("  @user   reason  ")).toBe("reason");
  });
});

describe("extractDurationAndReason", () => {
  it("returns empty object for empty string", () => {
    expect(extractDurationAndReason("")).toEqual({});
  });

  it("extracts duration only", () => {
    expect(extractDurationAndReason("1d")).toEqual({
      durationStr: "1d",
      reason: undefined,
    });
  });

  it("extracts duration and reason", () => {
    expect(extractDurationAndReason("2h spamming")).toEqual({
      durationStr: "2h",
      reason: "spamming",
    });
  });

  it("extracts reason only when no duration", () => {
    expect(extractDurationAndReason("this is a reason")).toEqual({
      reason: "this is a reason",
    });
  });

  it("handles various duration units", () => {
    expect(extractDurationAndReason("30m flooding")).toEqual({
      durationStr: "30m",
      reason: "flooding",
    });
    expect(extractDurationAndReason("1w repeated offenses")).toEqual({
      durationStr: "1w",
      reason: "repeated offenses",
    });
  });
});
