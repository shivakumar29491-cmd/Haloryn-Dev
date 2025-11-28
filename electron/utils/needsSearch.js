const KEYWORDS = [
  "weather",
  "today",
  "news",
  "latest",
  "price",
  "is it open",
  "who is the current",
  "current status",
  "happened",
  "breaking",
  "live",
  "update",
  "climate",
  "outside",
  "temperature"
];

const CATEGORY_PATTERNS = [
  /\b(today|tonight|this week|this month)\b/i,
  /\b(latest|breaking|recent|new)\b/i,
  /\b(price|stock|ticker|quote|trading)\b/i,
  /\b(weather|forecast|temperature|rain|storm)\b/i,
  /\b(news|headline|update|status)\b/i,
  /\b(open now|is it open|hours)\b/i,
  /\bwho is the current\b/i,
  /\bwhat happened\b/i,
  /\bclimate\b/i,
  /\boutside\b/i,
  /\bscore|game|match|final\b/i,
  /\bconcert|event|conference\b/i
];

function needsSearch(prompt = "") {
  const text = String(prompt || "").toLowerCase();
  if (!text.trim()) return false;

  if (KEYWORDS.some((kw) => text.includes(kw))) {
    return true;
  }

  return CATEGORY_PATTERNS.some((re) => re.test(text));
}

module.exports = needsSearch;
