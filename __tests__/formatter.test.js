const {
  cleanText,
  normalizeAnswer,
  normalizeSearchResults
} = require("../electron/api/utils/formatter");

describe("formatter utils", () => {
  test("cleanText removes markdown and whitespace", () => {
    const input = " **Hello**   `world`  \n#Title ~";
    expect(cleanText(input)).toBe("Hello world Title");
  });

  test("normalizeAnswer returns unified object", () => {
    const res = normalizeAnswer("  ok  ", "groq");
    expect(res).toEqual({ ok: true, answer: "ok", source: "groq" });
  });

  test("normalizeSearchResults handles bad inputs and normalizes fields", () => {
    expect(normalizeSearchResults(null)).toEqual([]);

    const results = normalizeSearchResults(
      [
        { title: " **A** ", snippet: "`B`", url: "http://x" },
        { title: "", snippet: "", url: "" }
      ],
      "brave"
    );

    expect(results).toEqual([
      { title: "A", snippet: "B", url: "http://x", provider: "brave" },
      { title: "", snippet: "", url: "", provider: "brave" }
    ]);
  });
});
