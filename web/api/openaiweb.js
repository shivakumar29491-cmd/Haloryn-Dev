export const config = { runtime: "edge" };

function cors(json, status = 200) {
  return new Response(JSON.stringify(json), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return cors({ ok: true });

  try {
    const { prompt } = await req.json();
    if (!prompt) return cors({ ok: false, error: "Missing prompt" }, 400);

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400
      })
    });

    const data = await oaiRes.json();

    const answer =
      data?.choices?.[0]?.message?.content || "No answer from OpenAI.";

    return cors({ ok: true, answer });

  } catch (err) {
    return cors({ ok: false, error: err.message });
  }
}
