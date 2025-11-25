// api/search/router.js
// Phase 10 — Unified backend router for Brave → SerpAPI → GooglePSE → Bing → Groq
export const config = {
  runtime: "edge"
};

const fetch = require("node-fetch");
const { getProviderOrder } = require("../utils/providerSelector");

/**
 * Ensures non-JSON responses don't crash the chain.
 */
async function safeJsonResponse(resp) {
  const text = await resp.text();

  try {
    return JSON.parse(text);
  } catch {
    // HTML page, error text, or garbage → fail gracefully
    return { results: [] };
  }
}

module.exports = async function handler(req, res) {
  try {
    const query = req.query.q || req.body?.query;
    const maxResults = Number(req.query.maxResults || req.body?.maxResults || 5);

    if (!query) {
      return res.status(400).json({ results: [], error: "Missing query" });
    }

    // 🔥 Providers in order of quality (Phase 10)
    const providers = getProviderOrder();

    // Determine Vercel hostname or local dev
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    // Map provider names → API endpoints
    const endpoints = {
      brave: "/api/search/braveApi",
      serpapi: "/api/search/serpapi",
      googlePSE: "/api/search/googlePSE",
      bing: "/api/search/bing",
      groq: "/api/search/groq"
    };

    const tasks = providers.map(async provider => {
      const url = endpoints[provider];
      if (!url) return [];

      try {
        const resp = await fetch(`${base}${url}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, maxResults })
        });

        const json = await safeJsonResponse(resp);
        return Array.isArray(json.results) ? json.results : [];

      } catch (err) {
        console.error(`[router] Provider ${provider} failed:`, err.message);
        return [];
      }
    });

    // Wait for all search engines
    const resultsBundles = await Promise.all(tasks);

    // Flatten and cap
    const flattened = resultsBundles.flat().slice(0, maxResults * providers.length);

    return res.status(200).json({ results: flattened });

  } catch (err) {
    console.error("[router] Fatal Error:", err.message);
    return res.status(500).json({ results: [], error: err.message });
  }
};
