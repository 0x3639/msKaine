import { describe, it, expect } from "vitest";
import { applyFillings } from "../../../src/modules/formatting/filling-parser.js";

const baseUser = {
  id: 12345,
  first_name: "Alice",
  last_name: "Smith",
  username: "alice_s",
};

describe("applyFillings", () => {
  it("replaces {first}", () => {
    const result = applyFillings("Hello {first}!", { user: baseUser });
    expect(result.text).toBe("Hello Alice!");
  });

  it("replaces {last}", () => {
    const result = applyFillings("Last: {last}", { user: baseUser });
    expect(result.text).toBe("Last: Smith");
  });

  it("replaces {fullname}", () => {
    const result = applyFillings("{fullname} joined", { user: baseUser });
    expect(result.text).toBe("Alice Smith joined");
  });

  it("replaces {username} with @handle when available", () => {
    const result = applyFillings("By {username}", { user: baseUser });
    expect(result.text).toBe("By @alice_s");
  });

  it("replaces {username} with mention when no handle", () => {
    const user = { id: 1, first_name: "Bob" };
    const result = applyFillings("{username}", { user });
    expect(result.text).toContain("tg://user?id=1");
    expect(result.text).toContain("Bob");
  });

  it("replaces {mention} with a link", () => {
    const result = applyFillings("{mention}", { user: baseUser });
    expect(result.text).toContain("tg://user?id=12345");
    expect(result.text).toContain("Alice");
  });

  it("replaces {id}", () => {
    const result = applyFillings("ID: {id}", { user: baseUser });
    expect(result.text).toBe("ID: 12345");
  });

  it("replaces {chatname}", () => {
    const result = applyFillings("Welcome to {chatname}", {
      user: baseUser,
      chatTitle: "Test Group",
    });
    expect(result.text).toBe("Welcome to Test Group");
  });

  it("replaces {rules}", () => {
    const result = applyFillings("{rules}", {
      user: baseUser,
      rules: "Be nice",
    });
    expect(result.text).toBe("Be nice");
  });

  it("uses default for missing chatname", () => {
    const result = applyFillings("{chatname}", { user: baseUser });
    expect(result.text).toBe("this group");
  });

  it("uses default for missing rules", () => {
    const result = applyFillings("{rules}", { user: baseUser });
    expect(result.text).toBe("No rules set.");
  });

  it("is case insensitive", () => {
    const result = applyFillings("{FIRST} {First} {first}", {
      user: baseUser,
    });
    expect(result.text).toBe("Alice Alice Alice");
  });

  it("escapes HTML in values", () => {
    const user = { id: 1, first_name: "<script>", last_name: "a&b" };
    const result = applyFillings("{first} {last}", { user });
    expect(result.text).toBe("&lt;script&gt; a&amp;b");
  });

  // Control fillings
  it("extracts {preview} flag", () => {
    const result = applyFillings("Hello {preview}", { user: baseUser });
    expect(result.noPreview).toBe(true);
    expect(result.text).toBe("Hello");
  });

  it("extracts {nonotif} flag", () => {
    const result = applyFillings("{nonotif}Hello", { user: baseUser });
    expect(result.noNotif).toBe(true);
    expect(result.text).toBe("Hello");
  });

  it("extracts {protect} flag", () => {
    const result = applyFillings("{protect}Hi", { user: baseUser });
    expect(result.protect).toBe(true);
  });

  it("extracts {mediaspoiler} flag", () => {
    const result = applyFillings("{mediaspoiler}test", { user: baseUser });
    expect(result.mediaSpoiler).toBe(true);
  });

  it("all flags default to false", () => {
    const result = applyFillings("plain text", { user: baseUser });
    expect(result.noPreview).toBe(false);
    expect(result.noNotif).toBe(false);
    expect(result.protect).toBe(false);
    expect(result.mediaSpoiler).toBe(false);
  });
});
