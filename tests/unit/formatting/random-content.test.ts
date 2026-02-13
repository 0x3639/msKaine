import { describe, it, expect, vi } from "vitest";
import { pickRandom } from "../../../src/modules/formatting/random-content.js";

describe("pickRandom", () => {
  it("returns content as-is when no %%% separator", () => {
    expect(pickRandom("Hello world")).toBe("Hello world");
  });

  it("returns one of the sections", () => {
    const sections = ["Section A", "Section B", "Section C"];
    const content = sections.join("%%%");

    const result = pickRandom(content);
    expect(sections).toContain(result);
  });

  it("trims whitespace around sections", () => {
    const content = "  A  %%%  B  %%%  C  ";
    const result = pickRandom(content);
    expect(["A", "B", "C"]).toContain(result);
  });

  it("filters out empty sections", () => {
    const content = "A %%% %%% B";
    const result = pickRandom(content);
    expect(["A", "B"]).toContain(result);
  });

  it("returns deterministic result with mocked Math.random", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // Always picks first
    expect(pickRandom("First%%%Second%%%Third")).toBe("First");
    vi.restoreAllMocks();

    vi.spyOn(Math, "random").mockReturnValue(0.99); // Always picks last
    expect(pickRandom("First%%%Second%%%Third")).toBe("Third");
    vi.restoreAllMocks();
  });
});
