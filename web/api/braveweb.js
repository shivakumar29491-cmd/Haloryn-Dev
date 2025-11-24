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
    const { query } = await req.json();
    if (!query) return cors({ ok: false, error: "Missing query" }, 400);

    const braveRes = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "Accept": "application/json",
          "X-Subscription-Token": process.env.BRAVE_API_KEY
        }
      }
    );

    const data = await braveRes.json();

    const best =
      data?.web?.results?.[0]?.title +
        " — " +
        data?.web?.results?.[0]?.description ||
      "No search results.";

    return cors({ ok: true, answer: best });

  } catch (err) {
    return cors({ ok: false, error: err.message });
  }
}
