// ===== SearchRoot router =====
// Engine selector + result normalizer (Brave -> Bing -> Google PSE)

const fetch = require("node-fetch");

const normalizeResults = (items = [], source) =>
  items
    .filter((it) => it && (it.title || it.snippet || it.url))
    .map((it) => ({
      title: (it.title || "").toString().trim(),
      snippet: (it.snippet || "").toString().trim(),
      url: (it.url || "").toString().trim(),
      source
    }));

function formatLocation(location) {
  if (!location) return "";
  const { city, region, country, lat, lon, label, postal } = location;
  if (label) return String(label);
  if (postal) return String(postal);
  const text = [city, region, country].filter(Boolean).join(", ");
  if (text) return text;
  if (lat != null && lon != null) return `${lat},${lon}`;
  return "";
}

async function searchBrave(query, maxResults) {
  const key = process.env.BRAVE_API_KEY;
  const endpoint =
    process.env.BRAVE_API_ENDPOINT || "https://api.search.brave.com/res/v1/web/search";
  if (!key) return [];

  try {
    const url = new URL(endpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));

    const res = await fetch(url.toString(), {
      headers: {
        "X-Subscription-Token": key,
        "Accept": "application/json"
      }
    });
    const json = await res.json();
    const items = json?.web?.results || [];
    return normalizeResults(
      items.map((it) => ({
        title: it.title,
        snippet: it.description,
        url: it.url
      })),
      "brave"
    );
  } catch (err) {
    console.error("[searchRouter] Brave error:", err.message);
    return [];
  }
}

async function searchBing(query, maxResults) {
  const key = process.env.BING_API_KEY;
  if (!key) return [];

  try {
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
    const res = await fetch(url, {
      headers: { "Ocp-Apim-Subscription-Key": key }
    });
    const json = await res.json();
    const items = json?.webPages?.value || [];
    return normalizeResults(
      items.map((i) => ({
        title: i.name,
        snippet: i.snippet,
        url: i.url
      })),
      "bing"
    );
  } catch (err) {
    console.error("[searchRouter] Bing error:", err.message);
    return [];
  }
}

async function searchGooglePSE(query, maxResults) {
  const key = process.env.GOOGLE_PSE_KEY;
  const cx = process.env.GOOGLE_PSE_CX;
  if (!key || !cx) return [];

  try {
    const base = "https://www.googleapis.com/customsearch/v1";
    const url =
      `${base}?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}` +
      `&q=${encodeURIComponent(query)}&num=${maxResults}`;

    const res = await fetch(url);
    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : [];
    return normalizeResults(
      items.map((i) => ({
        title: i.title,
        snippet: i.snippet,
        url: i.link
      })),
      "googlePSE"
    );
  } catch (err) {
    console.error("[searchRouter] Google PSE error:", err.message);
    return [];
  }
}

function isLocationSensitive(prompt = "") {
  const s = String(prompt || "").toLowerCase();
  const triggers = [
    "weather", "temperature", "rain", "storm",
    "nearby", "near me", "restaurants", "hotels",
    "news", "headline", "breaking", "time",
    "current", "today", "tonight"
  ];
  return triggers.some((t) => s.includes(t));
}

function buildLocationQuery(query, location) {
  if (!location) return query;
  const locText = formatLocation(location);
  if (!locText) return query;
  if (isLocationSensitive(query)) {
    return `${query} near ${locText}`;
  }
  return query;
}

async function searchRouter(prompt, maxResults = 5, location = null) {
  const query = String(prompt || "").trim();
  if (!query) return { results: [] };
  const queryWithLocation = buildLocationQuery(query, location);

  const providers = [
    { name: "brave", fn: searchBrave },
    { name: "bing", fn: searchBing },
    { name: "googlePSE", fn: searchGooglePSE }
  ];

  for (const provider of providers) {
    try {
      const results = await provider.fn(queryWithLocation, maxResults);
      if (results && results.length) {
        return { provider: provider.name, results };
      }
    } catch (err) {
      console.warn(`[searchRouter] provider=${provider.name} error=${err?.message || err}`);
    }
  }

  return { provider: null, results: [], message: "no results" };
}

// Preserve legacy export name
module.exports = {
  searchRouter,
  unifiedWebSearch: searchRouter
};
