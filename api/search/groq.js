// api/search/groq.js
const Groq = require("groq-sdk");
const { normalizeSearchResults } = require("../utils/formatter");

module.exports = async function handler(req, res) {
  try {
    const { query } = req.body || {};
    const key = process.env.GROQ_API_KEY;

    if (!key) return res.status(500).json({ results: [], error: "Missing GROQ_API_KEY" });
    if (!query) return res.status(400).json({ results: [], error: "Missing query" });

    const groq = new Groq({ apiKey: key });

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: `Short answer:\n${query}` }],
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: 100
    });

    const snippet = completion?.choices?.[0]?.message?.content || "";

    return res.status(200).json({
      results: normalizeSearchResults([
        { title: "Groq Quick Answer", snippet, url: "" }
      ], "groq")
    });

  } catch (err) {
    return res.status(500).json({ results: [], error: err.message });
  }
};
