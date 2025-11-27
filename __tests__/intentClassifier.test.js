const { classifyIntent } = require("../electron/intentClassifier");

describe("intentClassifier", () => {
  test("detects web intents via keywords", () => {
    expect(classifyIntent("latest stock price for NVDA")).toBe("WEB");
  });

  test("detects doc context", () => {
    expect(classifyIntent("summarize this document for me")).toBe("DOC");
  });

  test("defaults to hybrid", () => {
    expect(classifyIntent("Explain quantum computing")).toBe("HYBRID");
  });
});
