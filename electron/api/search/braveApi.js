// api/search/braveApi.js
const fetch = require("node-fetch");
const { normalizeSearchResults } = require("../utils/formatter");

module.exports = async function handler(req, res) {
  try {
    const { query, maxResults = 5 } = req.body || {};
    const key = process.env.BRAVE_API_KEY;

    if (!key) return res.status(500).json({ results: [], error: "Missing BRAVE_API_KEY" });
    if (!query) return res.status(400).json({ results: [], error: "Missing query" });

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));

    const apiRes = await fetch(url.toString(), {
      headers: {
        "X-Subscription-Token": key,
        "Accept": "application/json"
      }
    });

    const json = await apiRes.json();
    const items = json?.web?.results || [];

    return res.status(200).json({
      results: normalizeSearchResults(items.map(it => ({
        title: it.title,
        snippet: it.description,
        url: it.url
      })), "brave")
    });

  } catch (err) {
    return res.status(500).json({ results: [], error: err.message });
  }
};
