// -----------------------------------------------------------
//  groqEngine.js – LLM Answer Engine (ROOT FOLDER)
//  Phase 8 – use Haloryn Backend (Vercel)
// -----------------------------------------------------------

const fetch = require("node-fetch");
const Groq = require("groq-sdk");

// Lazily create client so missing env key doesn't crash app startup.
let groqClient = null;
function getGroqClient() {
  if (groqClient) return groqClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("Missing GROQ_API_KEY. Add it to your environment or .env file.");
    return null;
  }
  groqClient = new Groq({ apiKey });
  return groqClient;
}

// -----------------------------------------------------------
// 1. GROQ WHISPER TRANSCRIPTION (via direct Groq API)
// -----------------------------------------------------------
async function groqWhisperTranscribe(audioBuffer) {
  const groq = getGroqClient();
  if (!groq) return "";

  try {
    const response = await groq.audio.transcriptions.create({
      file: {
        name: "audio.wav",
        mimeType: "audio/wav",
        buffer: audioBuffer,
      },
      model: "whisper-large-v3"
    });

    return response.text || "";
  } catch (err) {
    console.error("Groq Whisper Error:", err.message);
    return "";
  }
}

// -----------------------------------------------------------
// 2. FAST ANSWER – USE Haloryn BACKEND (NOT GROQ DIRECT)
// -----------------------------------------------------------
async function groqFastAnswer(prompt, docContextText = "", docName = "", opts = {}) {
  const groq = getGroqClient();
  if (!groq) return "";

  let prefixed = prompt;
  if (docContextText) {
    // Keep doc context short but present to steer Groq toward the attached file
    const ctx = docContextText.slice(0, 4000);
    const name = docName ? `("${docName}")` : "";
    prefixed = `Document context ${name}:\n${ctx}\n\nUser prompt:\n${prompt}`;
  }

  const basePayload = {
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content:
          "You are Haloryn. Return concise, no-fluff answers. Always infer user intent (personal, professional, hypothetical, or factual) and respond helpfully even if no external facts are provided. Prefer bullets when instructional. Keep code minimal and focused. Correct obvious typos in the prompt/context before answering. Do not narrate; skip preamble/closings."
      },
      { role: "user", content: prefixed }
    ],
    temperature: 0.15,
    max_tokens: 4096
  };

  if (opts.stream) {
    try {
      const stream = await groq.chat.completions.create({
        ...basePayload,
        stream: true
      });
      let full = "";
      for await (const part of stream) {
        const chunk =
          part?.choices?.[0]?.delta?.content ||
          part?.choices?.[0]?.message?.content ||
          "";
        if (!chunk) continue;
        full += chunk;
        opts.onChunk?.(chunk);
      }
      return full.trim();
    } catch (err) {
      console.error("Groq Direct API Stream Error:", err.message);
      opts.onError?.(err);
      // fall back to non-streaming path below
    }
  }

  try {
    const result = await groq.chat.completions.create(basePayload);
    const text = result.choices?.[0]?.message?.content || "";
    return text.trim();
  } catch (err) {
    console.error("Groq Direct API Error:", err.message);
    opts.onError?.(err);
    return "";
  }
}

// -----------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------
module.exports = {
  groqWhisperTranscribe,
  groqFastAnswer
};
