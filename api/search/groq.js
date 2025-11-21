// api/search/groq.js
import Groq from "groq-sdk";

export default async function handler(req, res) {
  try {
    const { query } = JSON.parse(req.body || '{}');
    const key = process.env.GROQ_API_KEY;

    if (!key) {
      return res.status(500).json({ error: 'Missing GROQ_API_KEY' });
    }
    if (!query) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const groq = new Groq({ apiKey: key });

    const completion = await groq.chat.completions.create({
      messages: [{
        role: "user",
        content: `Web-style quick answer for:\n"${query}"\nShort sentences only.`
      }],
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: 120
    });

    const text = completion.choices?.[0]?.message?.content || "";

    const unified = [{
      title: "Groq Web Answer",
      snippet: text.trim(),
      url: "",
      provider: "groq"
    }];

    return res.status(200).json({ results: unified });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
