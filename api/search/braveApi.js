// api/search/brave.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    const { query, maxResults = 5 } = JSON.parse(req.body || '{}');
    const key = process.env.BRAVE_API_KEY;

    if (!key) {
      return res.status(500).json({ error: 'Missing BRAVE_API_KEY' });
    }
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(maxResults));

    const apiRes = await fetch(url.toString(), {
      headers: {
        'X-Subscription-Token': key,
        'Accept': 'application/json'
      }
    });

    const json = await apiRes.json();

    const items =
      json?.web?.results?.slice(0, maxResults) || [];

    const unified = items.map(it => ({
      title: it.title || it.description || '',
      snippet: it.description || '',
      url: it.url || '',
      provider: 'brave'
    }));

    return res.status(200).json({ results: unified });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
