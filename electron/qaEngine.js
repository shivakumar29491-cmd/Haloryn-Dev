// ===== Haloryn QA Engine (Phase 8 Final) =====
// Unified QA / Doc / Web Logic — no local LLM

const fetch = require("node-fetch");
const { webRace } = require("./search/webRaceEngine");
const { detectIntent } = require("./intentClassifier");
const { extractiveSummary } = require("./textUtils");
const { setLogger: setWebLogger } = require("./webSearchEngine");

let docContext = { name: "", text: "" };
let logFn = null;

// ===== Logger =====
function log(msg) {
  if (!logFn) return;
  try {
    logFn(msg);
  } catch {
    /* noop */
  }
}

function init(opts = {}) {
  logFn = typeof opts.log === "function" ? opts.log : null;
  setWebLogger(log);
}

// ===== State management =====
function setDocContext(ctx) {
  docContext = {
    name: (ctx && ctx.name) || "",
    text: (ctx && ctx.text) || ""
  };
}

// ===== Fast answering (Groq) =====
async function fastGroq(question) {
  try {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: question }],
        temperature: 0.2
      })
    });

    if (!resp.ok) return "";
    const j = await resp.json();
    return j.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

// ===== Doc answer (no local LLM) =====
async function docFirstAnswer(question) {
  if (!docContext.text) return "";

  // Extractive summary + direct doc match
  const summary = extractiveSummary(docContext.text, question);
  if (summary) return summary;

  return ""; // fallback to web
}

// ===== Hybrid doc + web answer =====
async function hybridDocWeb(question) {
  const docPart = await docFirstAnswer(question);

  const webPart = await webRace(question);
  const combined =
    (docPart ? `From your document:\n${docPart}\n\n` : "") +
    (webPart ? `From the web:\n${webPart}` : "");

  return combined.trim() || "I'm sorry, I couldn't find an answer.";
}

// ===== Pure web answer =====
async function webOnlyAnswer(question) {
  return await webRace(question);
}

// ===== Main answer router =====
async function answer(userText) {
  try {
    log(`[QAEngine] Received: ${userText}`);

    // Intent detection
    const intent = detectIntent(userText);

    // 1. DOC-ENRICHED if doc present + question is doc-related
    if (docContext.text && intent.docLikely) {
      const h = await hybridDocWeb(userText);
      log(`[QAEngine] Hybrid returned: ${h}`);
      return h;
    }

    // 2. WEB-FIRST for all factual questions
    if (intent.webLikely) {
      const w = await webOnlyAnswer(userText);
      if (w && w.trim() !== "") {
        log(`[QAEngine] Web answered: ${w}`);
        return w;
      }
    }

    // 3. DOC-FIRST if question likely refers to uploaded document
    if (docContext.text) {
      const d = await docFirstAnswer(userText);
      if (d && d.trim() !== "") {
        log(`[QAEngine] Doc answered: ${d}`);
        return d;
      }
    }

    // 4. FAST GROQ fallback (general reasoning)
    const g = await fastGroq(userText);
    if (g && g.trim() !== "") {
      log(`[QAEngine] Groq answered: ${g}`);
      return g;
    }

    // 5. Final fallback → Web search
    const w2 = await webOnlyAnswer(userText);
    log(`[QAEngine] Final fallback web: ${w2}`);
    return w2 || "I'm sorry, I couldn't find an answer.";
  } catch (err) {
    log(`[QAEngine ERROR] ${err.message}`);
    return "⚠️ Error: " + err.message;
  }
}

module.exports = {
  init,
  setDocContext,
  answer
};
