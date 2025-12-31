// ===== LLM Router =====
const fetch = require("node-fetch");
const { groqFastAnswer } = require("./groqEngine");

// ===== Routing heuristics =====
const COMPLEX_PATTERNS = [
  /\b(debug|bug|stack trace|error code)\b/i,
  /\b(regex|sql|database|query)\b/i,
  /\b(function|class|module|package|library)\b/i,
  /\b(algorithm|optimiz(e|ation)|complexity)\b/i,
  /\b(calculate|compute|derive|prove|equation|math)\b/i,
  /\b(step[-\s]?by[-\s]?step|walk me through|how do i)\b/i,
  /\b(code|javascript|typescript|python|node|java|c\+\+|c#|go|rust)\b/i
];

function isComplexQuestion(prompt = "") {
  const text = String(prompt || "");
  if (text.length > 260) return true;
  return COMPLEX_PATTERNS.some((re) => re.test(text));
}

const LOCATION_HINTS = [
  /\b(weather|temperature|rain|storm)\b/i,
  /\b(time|today|tonight|current|now)\b/i,
  /\b(nearby|near me|restaurants?|hotels?)\b/i,
  /\b(news|headline|breaking)\b/i
];

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

function summarizeSearchResults(results = []) {
  return results
    .slice(0, 5)
    .map((r, idx) => {
      const title = (r.title || "").toString().trim();
      const snippet = (r.snippet || "").toString().trim();
      const url = (r.url || "").toString().trim();
      return `${idx + 1}. ${title || "Result"} - ${snippet}${url ? ` [${url}]` : ""}`;
    })
    .join("\n");
}

function hasLocationHint(prompt = "") {
  return LOCATION_HINTS.some((re) => re.test(prompt));
}

function buildStructuredPrompt(userPrompt, searchResults, location, includeLocation = false) {
  const parts = [`User question:\n${userPrompt.trim()}`];

  if (Array.isArray(searchResults) && searchResults.length) {
    parts.push("Search results summary:", summarizeSearchResults(searchResults));
  }

  const locText = includeLocation ? formatLocation(location) : "";
  if (locText) {
    const src = location?.source ? ` (source: ${location.source})` : "";
    parts.push(`Approximate user location${src}:\n${locText}`);
  }

 parts.push("Answer in a clean conversational style. Do NOT add disclaimers, meta text, or guidance. Do NOT say things like 'Please provide context', 'I'm here to help', or explain UI.");

  return parts.filter(Boolean).join("\n\n");
}

function cleanAnswer(answer, maxLen = Infinity) {
  let out = String(answer || "").trim();
  if (!out) return "I couldn't generate an answer.";

  // Remove URLs
  out = out.replace(/https?:\/\/\S+/gi, "");

  // Remove empty parentheses
  out = out.replace(/\(\s*\)/g, "");

  // Remove meta disclaimers
  const boiler = [
    /as an ai language model/gi,
    /i cannot/gi,
    /i do not have/gi,
    /i'm unable/gi
  ];
  boiler.forEach((r) => out = out.replace(r, "").trim());

  // 🔥 REMOVE ALL META/SYSTEM GARBAGE
  out = out.replace(/^\*\s*I'm here.*$/gmi, "");
  out = out.replace(/^\*\s*Please provide.*$/gmi, "");
  out = out.replace(/^\*\s*The answer section.*$/gmi, "");
  out = out.replace(/^I'm here.*$/gmi, "");
  out = out.replace(/^Please provide.*$/gmi, "");
  out = out.replace(/^Buttons are typically.*$/gmi, "");
  out = out.replace(/^In this context.*$/gmi, "");
  out = out.replace(/^\*\s*$/gm, "");
  
  // Remove ALL meta bullets at start
  out = out.replace(/^\*\s.*$/gm, "");

  // Collapse excess newlines
  out = out.replace(/\n{3,}/g, "\n\n");

  return out || "I couldn't generate an answer.";
}



async function askGroq(structuredPrompt) {
  try {
    return await groqFastAnswer(structuredPrompt);
  } catch (err) {
    console.error("[llmRouter] Groq failed:", err.message);
    return "";
  }
}

async function askDeepSeek(structuredPrompt) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return "";

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        messages: [{ role: "user", content: structuredPrompt }],
        temperature: 0.3,
        max_tokens: 800
      })
    });

    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("[llmRouter] DeepSeek failed:", err.message);
    return "";
  }
}

async function askOpenAI(structuredPrompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return "";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.FALLBACK_MODEL || "gpt-4o",
        messages: [{ role: "user", content: structuredPrompt }],
        temperature: 0.4,
        max_tokens: 800
      })
    });

    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("[llmRouter] OpenAI fallback failed:", err.message);
    return "";
  }
}

function shouldAllowCode(text = "") {
  const s = String(text || "").toLowerCase();
  return /\b(code|script|function|api client|python|javascript|node|typescript|java|c\+\+|c#|go|rust|curl|shell)\b/.test(s) ||
    /```/.test(text);
}

async function routeToLLM(
  messages,
  searchResults = null,
  location = null,
  latestUserPrompt = null,
  opts = {}
) {
  const lastMsg = messages?.[messages.length - 1];
  const prompt = lastMsg?.content?.trim() || "";
  const maxLen = opts?.maxLen ?? Infinity;

  if (!prompt) return "Please provide a prompt.";

  const needsDeepSeek = isComplexQuestion(prompt);
  let answer = "";

  const safeMessages = sanitizeMessages(messages);
  const flatPrompt = buildPromptFromMessages(safeMessages);

  if (needsDeepSeek) {
    answer = await askDeepSeek(flatPrompt);
    if (!answer) {
      answer = await groqFastAnswer(flatPrompt);
    }
  } else {
    answer = await groqFastAnswer(flatPrompt);
  }

  if (!answer) answer = await askDeepSeek(flatPrompt);
  if (!answer) answer = await askOpenAI(flatPrompt);

  return cleanAnswer(answer || "I couldn't generate an answer.", maxLen);
}
function buildPromptFromMessages(messages) {
  return messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

module.exports = { routeToLLM };

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
