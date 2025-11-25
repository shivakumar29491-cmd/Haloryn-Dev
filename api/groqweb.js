// electron/api/groqweb.js
// Phase 10 — Unified AI Endpoint for Electron + Web
export const config = {
  runtime: "edge"
};

const Groq = require("groq-sdk");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const { prompt } = req.body || {};
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ ok: false, error: "Missing prompt" });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "Missing GROQ_API_KEY" });
    }

    const groq = new Groq({ apiKey });

    // 🔥 Groq fast model (Phase-10 standard)
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: 500
    });

    const answer =
      completion?.choices?.[0]?.message?.content?.trim() || "No answer.";

    return res.status(200).json({
      ok: true,
      answer,
      source: "groq"
    });

  } catch (err) {
    console.error("[groqweb ERROR]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
