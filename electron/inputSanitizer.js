// inputSanitizer.js
// Cleans, repairs, and reconstructs noisy OCR/STT text using Groq LLM

const { groqFastAnswer } = require("./groqEngine");

// Detection: checks if text looks messy/gibberish
function needsSanitization(text = "") {
  if (!text || text.trim().length < 2) return true;

  const symbolRatio = (text.match(/[^a-zA-Z0-9\s]/g)?.length || 0) / text.length;
  const vowelRatio =
    (text.match(/[aeiou]/gi)?.length || 0) / text.length;

  // Conditions that indicate “gibberish”
  if (symbolRatio > 0.25) return true;       // too many weird characters
  if (vowelRatio < 0.15) return true;         // missing vowels (common OCR noise)
  if (text.split(" ").length <= 2) return true; // too short = incomplete
  return false;
}

// MAIN FUNCTION — cleans the text using Groq LLM
async function sanitizeInput(text = "") {
  try {
    const prompt = `
You are a text reconstruction system.
You will receive messy, noisy, corrupted OCR/STT input.
Clean it, fix broken words, infer missing context, and produce a clear, human-readable version.
Do NOT add new fictional information.
If the text is incomplete, guess the most likely intended meaning.

Input:
"${text}"

Return ONLY the corrected text, nothing else.
`;

    const repaired = await groqFastAnswer(prompt); // reuse fast Groq pipeline
    return repaired?.trim() || text;
  } catch (err) {
    console.warn("[Sanitizer] Failed to sanitize:", err);
    return text; // fallback to raw text
  }
}

// Unified helper: automatically sanitizes if needed
async function cleanInputIfNeeded(text = "") {
  if (needsSanitization(text)) {
    return await sanitizeInput(text);
  }
  return text;
}

module.exports = {
  needsSanitization,
  sanitizeInput,
  cleanInputIfNeeded
};
