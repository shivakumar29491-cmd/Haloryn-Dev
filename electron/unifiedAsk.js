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

  if (!effectiveLocation) {
    const zip = extractZip(prompt);
    if (zip) {
      effectiveLocation = { postal: zip, label: zip, source: "zip" };
    }
  }

  if (searchRequired) {
    try {
      const res = await searchRouter(prompt, 5, effectiveLocation);
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

  const conversationalPrompt = buildConversationPrompt(prompt);
  if (searchRequired && (!searchResults || !searchResults.length)) {
    const locNote = effectiveLocation?.label || effectiveLocation?.postal || "";
    return `I can't reach the web right now${locNote ? ` for ${locNote}` : ""}. Please check your connection or try again.`;
  }

  const answer = await routeToLLM(conversationalPrompt, searchResults, effectiveLocation, prompt, {
    noCode: true,
    maxLen: 150
  });
  recordTurn("user", prompt);
  recordTurn("assistant", answer);
  return answer;
}

module.exports = { unifiedAsk };
