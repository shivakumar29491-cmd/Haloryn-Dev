// ===== Groq Web Chat Handler =====

const fetch = require("node-fetch");

async function groqWebHandler(prompt) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("Missing GROQ_API_KEY");
      return { ok: false, error: "Missing GROQ_API_KEY" };
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.2
      })
    });

    const data = await res.json();

    if (!data || !data.choices || !data.choices[0]) {
      return { ok: false, answer: null };
    }

    return {
      ok: true,
      answer: data.choices[0].message.content.trim()
    };

  } catch (err) {
    console.error("[GroqWebError]", err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = groqWebHandler;
