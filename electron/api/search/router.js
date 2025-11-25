// electron/api/search/router.js
// Unified Search Router — Electron Version (CommonJS)

const fetch = require("node-fetch");
const { getProviderOrder } = require("../utils/providerSelector");

/**
 * Safely parse JSON response
 */
async function safeJsonResponse(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { results: [] };
  }
}

/**
 * Main unified search function for Electron backend
 *
 * @param {string} query
 * @param {number} maxResults
 * @returns {Promise<Array>}
 */
async function unifiedSearch(query, maxResults = 5) {
  try {
    if (!query || String(query).trim() === "") {
      return [];
    }

    // Provider order (brave → serpapi → google → bing → groq)
    const providers = getProviderOrder();

    // Local API endpoints inside Electron
    const endpoints = {
      brave: require("./braveApi"),
      serpapi: require("./serpapi"),
      googlePSE: require("./googlePSE"),
      bing: require("./bing"),
      groq: require("./groq")
    };

    // Run each provider in order
    const tasks = providers.map(async provider => {
      const handler = endpoints[provider];
      if (!handler) return [];

      try {
        const json = await handler(query, maxResults);
        return Array.isArray(json?.results) ? json.results : [];
      } catch (err) {
        console.error(`[router] Provider ${provider} failed:`, err.message);
        return [];
      }
    });

    // Wait for all providers
    const resultsBundles = await Promise.all(tasks);

    // Flatten & cap
    return resultsBundles.flat().slice(0, maxResults * providers.length);

  } catch (err) {
    console.error("[router] Fatal:", err.message);
    return [];
  }
}

module.exports = { unifiedSearch };
