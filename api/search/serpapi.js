// api/search/serpapi.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { query, maxResults = 5 } = JSON.parse(req.body || '{}');
    const key = process.env.SERPAPI_KEY;

    if (!key) {
      return res.status(500).json({ error: 'Missing SERPAPI_KEY' });
    }
    if (!query) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const base = 'https://serpapi.com/search.json';
    const url =
      `${base}?engine=google&q=${encodeURIComponent(query)}&api_key=${key}`;

    const apiRes = await fetch(url);
    const json = await apiRes.json();

    const items = Array.isArray(json.organic_results)
      ? json.organic_results
      : [];

    const unified = items.slice(0, maxResults).map(it => ({
      title: it.title || '',
      snippet: it.snippet || '',
      url: it.link || '',
      provider: 'serpapi'
    }));

    return res.status(200).json({ results: unified });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
