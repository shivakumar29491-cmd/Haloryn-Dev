const fetch = require("node-fetch");
const { groqFastAnswer } = require("./groqEngine");

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

function buildStructuredPrompt(userPrompt, searchResults, location) {
  const parts = [`User question:\n${userPrompt.trim()}`];

  if (Array.isArray(searchResults) && searchResults.length) {
    parts.push("Search results summary:", summarizeSearchResults(searchResults));
  }

  const locText = formatLocation(location);
  if (locText) {
    const src = location?.source ? ` (source: ${location.source})` : "";
    parts.push(`Approximate user location${src}:\n${locText}`);
  }

  parts.push("Use search results to answer concisely.");
  return parts.filter(Boolean).join("\n\n");
}

function cleanAnswer(answer, maxLen = 400) {
  let out = String(answer || "").trim();
  if (!out) return "";

  out = out.replace(/https?:\/\/\S+/gi, "").replace(/\(\s*\)/g, "");

  const boilerplate = [
    /as an ai language model/gi,
    /i cannot (?:assist|provide|complete)/gi,
    /i'm unable to/gi,
    /i do not have (?:access|ability)/gi,
    /powered by .*/gi
  ];
  boilerplate.forEach((re) => {
    out = out.replace(re, "").trim();
  });

  out = out.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  const cap = Math.max(50, Math.min(maxLen, 400));
  if (out.length > cap) {
    out = out.slice(0, cap).trimEnd() + "...";
  }

  return out;
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

async function routeToLLM(userPrompt, searchResults = null, location = null, latestUserPrompt = null, opts = {}) {
  const prompt = String(userPrompt || "").trim();
  const latest = String(latestUserPrompt || userPrompt || "").trim();
  const noCode = opts?.noCode && !shouldAllowCode(latest);
  const maxLen = opts?.maxLen || 400;
  if (!prompt) return "Please provide a prompt.";

  const guard = noCode
    ? "Instruction: Provide a concise text answer (3-5 bullets or a short paragraph). Do not include code blocks or implementation snippets unless explicitly requested."
    : "";

  const structuredPrompt = [buildStructuredPrompt(prompt, searchResults, location), guard].filter(Boolean).join("\n\n");
  const needsDeepSeek = isComplexQuestion(latest || prompt);
  let answer = "";

  if (needsDeepSeek) {
    answer = await askDeepSeek(structuredPrompt);
    if (!answer) {
      answer = await askGroq(structuredPrompt);
    }
  } else {
    answer = await askGroq(structuredPrompt);
  }

  if (!answer) {
    answer = await askDeepSeek(structuredPrompt);
  }
  if (!answer) {
    answer = await askOpenAI(structuredPrompt);
  }

  return cleanAnswer(answer || "I couldn't generate an answer.", maxLen);
}

module.exports = { routeToLLM };

