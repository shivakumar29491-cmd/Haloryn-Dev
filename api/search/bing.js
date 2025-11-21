// api/search/bing.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { query, maxResults = 5 } = JSON.parse(req.body || '{}');
    const key = process.env.BING_API_KEY;

    if (!key) {
      return res.status(500).json({ error: 'Missing BING_API_KEY' });
    }
    if (!query) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const endpoint = 'https://api.bing.microsoft.com/v7.0/search';
    const url = `${endpoint}?q=${encodeURIComponent(query)}&count=${maxResults}`;

    const apiRes = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': key }
    });
    const json = await apiRes.json();

    const items = json?.webPages?.value || [];

    const unified = items.slice(0, maxResults).map(it => ({
      title: it.name || '',
      snippet: it.snippet || '',
      url: it.url || '',
      provider: 'bing'
    }));

    return res.status(200).json({ results: unified });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
