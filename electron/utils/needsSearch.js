const KEYWORDS = [
  "weather",
  "today",
  "news",
  "latest",
  "price",
  "is it open",
  "who is the current",
  "current status",
  "what happened",
  "breaking",
  "sport",
  "stocks",
  "stock",
  "quote",
  "temperature",
  "updates",
  "tonight",
  "now",
  "near me"
];
const LOCATION_HINTS = [/\b(weather|temperature|rain|storm)\b/i, /\b(news|headline|breaking)\b/i, /\b(price|quote|stock)s?\b/i, /\b(is it open|are they open)\b/i, /\b(who is the current|current status)\b/i, /\b(nearby|near me|restaurants?)\b/i, /\b(what happened|what's happening)\b/i];

function sanitize(text = "") {
  return text.toString().toLowerCase();
}

function needsSearch(prompt = "") {
  const s = sanitize(prompt);
  if (!s.trim()) return false;
  if (KEYWORDS.some((kw) => s.includes(kw))) return true;
  if (LOCATION_HINTS.some((re) => re.test(prompt))) return true;
  return false;
}

module.exports = needsSearch;
