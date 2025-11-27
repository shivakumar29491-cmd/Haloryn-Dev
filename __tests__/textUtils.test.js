const {
  tokenize,
  chunkText,
  selectRelevantChunks,
  detectIntent,
  extractiveSummary
} = require("../electron/textUtils");

describe("textUtils", () => {
  test("tokenize removes punctuation and stopwords", () => {
    const tokens = tokenize("This is a simple TEST, with punctuation!");
    expect(tokens).toEqual(["simple", "test", "punctuation"]);
  });

  test("chunkText splits long paragraphs into target sized chunks", () => {
    const longPara = "a".repeat(1500);
    const text = `${longPara}\n\n${longPara}`;
    const chunks = chunkText(text, 1000);
    expect(chunks.length).toBeGreaterThan(2);
  });

  test("selectRelevantChunks prefers matching chunks", () => {
    const text = "Paragraph about apples.\n\nParagraph about oranges and bananas.";
    const chunks = selectRelevantChunks("Tell me about oranges", text, 1);
    expect(chunks[0]).toContain("oranges");
  });

  test("detectIntent recognizes summarize and highlights", () => {
    expect(detectIntent("Please summarize this")).toBe("summarize");
    expect(detectIntent("Key points and highlights")).toBe("highlights");
    expect(detectIntent("Other question")).toBe("qa");
  });

  test("extractiveSummary returns sentences with query overlap when possible", () => {
    const text = "Cats are great pets. Dogs are loyal animals. Fish swim quietly.";
    const summary = extractiveSummary(text, "dogs", 2);
    expect(summary.toLowerCase()).toContain("dogs");
  });
});
