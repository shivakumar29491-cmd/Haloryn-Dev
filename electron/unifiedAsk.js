const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const needsSearch = require("./utils/needsSearch");
const { searchRouter } = require("./searchRoot/searchRouter");
const { routeToLLM } = require("./llmRouter");

const getLocationFile = () => path.join(app.getPath("userData"), "userData.json");

const convoHistory = []; // { role: 'user' | 'assistant', text }
const MAX_TURNS = 6;

function isSimplePrompt(prompt = "") {
  const s = String(prompt || "");
  return s.length < 120 && !/[?!.].*[?!.]/.test(s);
}

function recordTurn(role, text) {
  const body = String(text || "").trim();
  if (!body) return;
  convoHistory.push({ role, text: body });
  while (convoHistory.length > MAX_TURNS * 2) {
    convoHistory.shift();
  }
}

function getLocation() {
  try {
    const raw = fs.readFileSync(getLocationFile(), "utf8");
    const json = JSON.parse(raw);
    return json?.location || null;
  } catch {
    return null;
  }
}

function extractZip(prompt = "") {
  const m = String(prompt || "").match(/\b\d{5}(?:-\d{4})?\b/);
  return m ? m[0] : null;
}

function isLocationQuery(prompt = "") {
  const text = String(prompt || "").toLowerCase();
  return /\b(weather|temperature|rain|storm|nearby|near me|restaurants|hotels|news|headline|breaking|time|current|today|tonight|what's happening|what happened)\b/i.test(text);
}

function buildConversationPrompt(prompt) {
  if (isSimplePrompt(prompt)) return prompt;
  const history = convoHistory.slice(-MAX_TURNS * 2);
  if (!history.length) return prompt;
  const transcript = history
    .map((t) => `${t.role === "assistant" ? "Assistant" : "User"}: ${t.text}`)
    .join("\n");
  return `${transcript}\nUser: ${prompt}`;
}

async function unifiedAsk(promptText) {
  const prompt = String(promptText || "").trim();
  if (!prompt) return "Please provide a prompt.";

  let searchResults = null;
  const location = getLocation();
  let effectiveLocation = location;
  const searchRequired = needsSearch(prompt);
  const locationNeeded = isLocationQuery(prompt);

  if (!effectiveLocation) {
    const zip = extractZip(prompt);
    if (zip) {
      effectiveLocation = { postal: zip, label: zip, source: "zip" };
    }
  }

  const locationForSearch = locationNeeded ? effectiveLocation : null;
  const locationForLLM = locationNeeded ? effectiveLocation : null;

  if (searchRequired) {
    try {
      const res = await searchRouter(prompt, 5, locationForSearch);
      if (Array.isArray(res)) {
        searchResults = res;
      } else if (Array.isArray(res?.results)) {
        searchResults = res.results;
      } else {
        searchResults = [];
      }
    } catch (err) {
      console.error("[unifiedAsk] search error:", err.message);
      searchResults = [];
    }
  }

// ---------- Conversation Memory (Persistent Within Session) ----------
if (!global.__HALORYN_HISTORY__) global.__HALORYN_HISTORY__ = [];

const history = global.__HALORYN_HISTORY__;

// Add the user message before asking the model
history.push({ role: "user", content: prompt });

// Trim history (avoid infinite growth)
if (history.length > 20) {
  history.shift();
}

// Build a conversational prompt
const conversationalPrompt = {
  messages: [
    { role: "system", content: "You are Haloryn, a helpful conversational AI. Be concise, contextual, and friendly." },
    ...history
  ]
};

// If search results exist, inject them
if (searchRequired && searchResults?.length) {
  conversationalPrompt.messages.push({
    role: "system",
    content: `Relevant web results:\n${JSON.stringify(searchResults).slice(0, 2000)}`
  });
}

// ---------- Send to router ----------
const answer = await routeToLLM(
  conversationalPrompt,
  searchResults,
  locationForLLM,
  prompt,
  {
    noCode: true,
    maxLen: Infinity
  }
);

// ---------- Store assistant reply ----------
if (answer && answer.trim()) {
  history.push({ role: "assistant", content: answer.trim() });
}

return answer;
}
