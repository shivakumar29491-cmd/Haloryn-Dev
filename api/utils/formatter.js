// electron/api/utils/formatter.js
// Phase 10 — Shared formatting utilities

module.exports = {
  cleanText,
  normalizeAnswer,
  normalizeSearchResults
};

/**
 * Removes extra whitespace, markdown clutter, and broken formatting.
 */
function cleanText(text = "") {
  return String(text)
    .replace(/\s+/g, " ")
    .replace(/\*\*/g, "")      // remove bold markdown
    .replace(/#+\s?/g, "")     // remove headings
    .replace(/[`~]/g, "")      // remove code symbols
    .trim();
}

/**
 * Creates a unified answer object for Electron + Web.
 */
function normalizeAnswer(answer = "", source = "groq") {
  return {
    ok: true,
    answer: cleanText(answer),
    source
  };
}

/**
 * Ensures all search results follow a unified structure.
 */
function normalizeSearchResults(results = [], provider = "") {
  if (!Array.isArray(results)) return [];

  return results.map(item => ({
    title: cleanText(item.title || ""),
    snippet: cleanText(item.snippet || ""),
    url: item.url || "",
    provider
  }));
}
