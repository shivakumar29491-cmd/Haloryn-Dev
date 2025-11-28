const fetch = require("node-fetch");

/**
 * Fetches the latest market price for a ticker from Yahoo's public quote endpoint.
 * Returns { price, currency, name, ticker } or null if unavailable.
 */
async function getStockQuote(ticker) {
  const symbol = String(ticker || "").trim().toUpperCase();
  if (!symbol) return null;

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const json = await res.json();
    const quote = json?.quoteResponse?.result?.[0];
    if (!quote) return null;

    const price =
      quote.regularMarketPrice ??
      quote.postMarketPrice ??
      quote.preMarketPrice ??
      null;

    if (price == null) return null;

    return {
      ticker: symbol,
      name: quote.longName || quote.shortName || symbol,
      price,
      currency: quote.currency || "USD",
      updated: quote.regularMarketTime ? new Date(quote.regularMarketTime * 1000).toISOString() : null
    };
  } catch {
    return null;
  }
}

module.exports = { getStockQuote };
