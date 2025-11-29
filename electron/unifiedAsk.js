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

// unifiedAsk.js — CLEAN + CORRECT


// Main entry
async function unifiedAsk(promptText) {

  promptText = String(promptText || "").trim();

  if (!promptText) {
    return "It seems like there's no question provided. Could you please rephrase or ask a question so I can assist you?";
  }

  // initialize history
  if (!global.__HALORYN_HISTORY__) {
    global.__HALORYN_HISTORY__ = [];
  }

  const history = global.__HALORYN_HISTORY__;

  // push NEW user message into history
  history.push({ role: "user", content: promptText });

  // cap history
  if (history.length > 20) history.shift();

  // Build conversation prompt
  const conversationalPrompt = {
    messages: [
      {
        role: "system",
        content:
          "You are Haloryn, a helpful conversational AI. Be concise, contextual, and friendly."
      },
      ...history,
      { role: "user", content: promptText } // <-- correct latest user turn
    ]
  };

  // No web search for now (kept your original behavior)
  const searchResults = [];
  const locationForLLM = null;

  // ---- Call the router (FIXED: promptText instead of undefined prompt)
 const answer = await routeToLLM(
  promptText,            // userPrompt (the actual question)
  searchResults,         // searchResults
  locationForLLM,        // location
  promptText,            // latestUserPrompt
  {                      // opts
    noCode: true,
    maxLen: Infinity
  }
);


  // Store assistant reply into history
  if (answer && answer.trim()) {
    history.push({ role: "assistant", content: answer.trim() });
    if (history.length > 20) history.shift();
  }

  return answer;
}

module.exports = unifiedAsk;
