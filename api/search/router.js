import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    // Support GET + POST
    const query = req.query.q || (req.body && req.body.query);
    const maxResults = Number(req.query.maxResults || (req.body && req.body.maxResults) || 5);

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Missing query" });
    }

    // Providers
    const endpoints = [
      { name: "brave", url: "/api/search/braveApi" },
      { name: "bing", url: "/api/search/bing" },
      { name: "serpapi", url: "/api/search/serpapi" },
      { name: "googlePSE", url: "/api/search/googlePSE" },
      { name: "groq", url: "/api/search/groq" }
    ];

    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://haloai-clean.vercel.app";

    const calls = endpoints.map(ep =>
      fetch(`${base}${ep.url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, maxResults })
      })
        .then(r => r.json())
        .then(j => j.results || [])
        .catch(() => [])
    );

    const results = await Promise.all(calls);

    return res.status(200).json({
      results: results.flat().slice(0, maxResults * 4)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
