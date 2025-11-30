// ------------------------------------------------------------
// unifiedAsk.js — CLEANED version (variable names unchanged)
// ------------------------------------------------------------
const { loadMemory, saveMemory } = require("./memoryManager");
const { routeToLLM } = require("./llmRouter");

// ----------------- Adaptive Memory Load ---------------------
if (!global.__HALORYN_HISTORY__) {
  global.__HALORYN_HISTORY__ = [];
}
const history = global.__HALORYN_HISTORY__;

let longTermMemory = loadMemory();

// ----------------- Emotion Detector --------------------------
function detectEmotion(text) {
  const t = text.toLowerCase();
  if (/angry|mad|upset|irritated|frustrated/.test(t)) return "angry";
  if (/sad|unhappy|depressed|down/.test(t)) return "sad";
  if (/confused|lost|unsure/.test(t)) return "confused";
  if (/happy|excited|glad|awesome|great/.test(t)) return "happy";
  return "neutral";
}

// ----------------- Preference Extractor ----------------------
function extractPreferences(text) {
  const prefs = {};
  const t = text.toLowerCase();

  if (/i like (.*)/.test(t)) prefs.like = RegExp.$1.trim();
  if (/i love (.*)/.test(t)) prefs.love = RegExp.$1.trim();
  if (/i hate (.*)/.test(t)) prefs.hate = RegExp.$1.trim();

  return prefs;
}

// ----------------- Summarizer -------------------------------
function summarizeHistory(history) {
  const joined = history
    .map(m => `${m.role}: ${String(m.content || "")}`)
    .join("\n");

  if (joined.length > 1500) {
    return joined.slice(-1500);
  }
  return joined;
}

// ------------------------------------------------------------
//            THE MAIN FUNCTION — unifiedAsk()
// ------------------------------------------------------------
async function unifiedAsk(promptText) {
  try {
    const userPrompt = String(promptText || "").trim();
    if (!userPrompt) return;

    // ------------- Update short-term memory ------------------
history.push({
  role: "user",
  content: String(promptText || "").trim()
});
    if (history.length > 20) history.shift();

    // ------------- Adaptive Memory Update --------------------
    const emotion = detectEmotion(userPrompt);
    longTermMemory.lastEmotion = emotion;

    const prefs = extractPreferences(userPrompt);
    longTermMemory.preferences = { ...longTermMemory.preferences, ...prefs };

    // ------------- Build adaptive system prompt --------------
    const adaptiveSystem = `
You are Haloryn — an advanced adaptive AI.
Tone: ${longTermMemory.lastEmotion}
User preferences: ${JSON.stringify(longTermMemory.preferences)}
Conversation summary: ${longTermMemory.historySummary}

Rules:
- Always stay polite, helpful, and concise.
- Adapt your tone to user emotion.
- Use user preferences when relevant.
- Avoid repeating earlier responses.
- Maintain context accuracy.
    `;

    // Cap system prompt size for model safety
    let finalSystem = adaptiveSystem.trim();
    if (finalSystem.length > 1000) {
      finalSystem = finalSystem.slice(-1000);
    }

    // ----------------- Compose full LLM messages -------------
    const conversationalPrompt = {
      messages: [
        { role: "system", content: finalSystem },
        ...history
      ]
    };
    // -------------------------------------
// Prepare params for router
// -------------------------------------
const searchResults = [];
const locationForLLM = null;
    // ----------------- Call LLM Router ------------------------
const answer = await routeToLLM(
  sanitizeMessages(conversationalPrompt.messages),
  searchResults,
  locationForLLM,
  promptText,
  {
    noCode: true,
    maxLen: Infinity
  }
);



    // ----------------- Record assistant response --------------
    if (answer && answer.trim()) {
history.push({
  role: "assistant",
  content: String(answer || "").trim()
});
      if (history.length > 20) history.shift();
    }

    // ----------------- Update long-term memory ----------------
    longTermMemory.historySummary = summarizeHistory(history);
    saveMemory(longTermMemory);

    return answer;

  } catch (err) {
    console.error("[unifiedAsk ERROR]", err);
    return "Error: " + err.message;
  }
}

module.exports = { unifiedAsk };

function sanitizeMessages(messages) {
  return (messages || [])
    .filter(m => m && typeof m.role === "string")
    .map(m => ({
      role: m.role,
      content: String(m.content || "")
         .replace(/\n+/g, " ")
         .trim()

    }));
}

