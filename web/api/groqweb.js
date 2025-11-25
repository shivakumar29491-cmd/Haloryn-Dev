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

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.3
      })
    });

    const data = await groqRes.json();

 if (data.error) {
  return cors({ ok: false, error: data.error.message });
}

const answer =
  data?.choices?.[0]?.message?.content || "No answer from Groq.";


    return cors({ ok: true, answer });

  } catch (err) {
    return cors({ ok: false, error: err.message }, 500);
  }
}
