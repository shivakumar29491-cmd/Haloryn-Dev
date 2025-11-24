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

    const localRes = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await localRes.json();

    const answer =
      data?.message?.content || "No answer from LocalAI.";

    return cors({ ok: true, answer });

  } catch (err) {
    return cors({ ok: false, error: err.message });
  }
}
