// api/search/bing.js
const fetch = require("node-fetch");
const { normalizeSearchResults } = require("../utils/formatter");

module.exports = async function handler(req, res) {
  try {
    const { query, maxResults = 5 } = req.body || {};
    const key = process.env.BING_API_KEY;

    if (!key) return res.status(500).json({ results: [], error: "Missing BING_API_KEY" });
    if (!query) return res.status(400).json({ results: [], error: "Missing query" });

    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`;

    const apiRes = await fetch(url, {
      headers: { "Ocp-Apim-Subscription-Key": key }
    });

    const json = await apiRes.json();
    const items = json.webPages?.value || [];

    const mapped = items.map(i => ({
      title: i.name,
      snippet: i.snippet,
      url: i.url
    }));

    return res.status(200).json({
      results: normalizeSearchResults(mapped, "bing")
    });

  } catch (err) {
    return res.status(500).json({ results: [], error: err.message });
  }
};
