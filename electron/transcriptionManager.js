// ===== Transcription Manager =====
// Hybrid transcription controller (Groq first, Whisper.cpp fallback)

const { TranscriptionEngine } = require("./transcriptionEngine");
const { runWhisperCpp } = require("./whisperLocal");
const { cleanInputIfNeeded } = require("./inputSanitizer");

let groqEngine = null;

// ===== Initialization =====
function initTranscription(groqKey) {
  if (!groqKey) {
    groqEngine = null;
    return false;
  }

  try {
    groqEngine = new TranscriptionEngine(groqKey);
    console.log("[TranscriptionManager] Groq engine initialized");
    return true;
  } catch (err) {
    console.warn("[TranscriptionManager] Failed to init Groq STT:", err.message);
    groqEngine = null;
    return false;
  }
}

// ===== Hybrid STT handler =====
async function transcribeAudio(audioBuffer) {
  if (!audioBuffer || !audioBuffer.length) {
    return { raw: "", sanitized: "", source: "empty" };
  }

  let raw = "";
  let source = "fallback";

  // 1. Try Groq first when available
  if (groqEngine) {
    try {
      raw = await groqEngine.transcribeBuffer(audioBuffer);
      source = "groq";
    } catch (err) {
      console.warn("[TranscriptionManager] Groq STT failed:", err.message);
      raw = "";
      source = "groq-error";
    }
  }

  // 2. Fallback to Whisper.cpp
  if (!raw?.trim()) {
    try {
      raw = await runWhisperCpp(audioBuffer);
      source = "whisper";
    } catch (err) {
      console.error(
        "[TranscriptionManager] Whisper.cpp fallback failed:",
        err.message
      );
      raw = "";
      source = "error";
    }
  }

  let sanitized = raw || "";
  if (sanitized) {
    try {
      sanitized = await cleanInputIfNeeded(sanitized);
    } catch (err) {
      console.warn("[TranscriptionManager] Sanitizer failed:", err.message);
    }
  }

  return {
    raw: raw || "",
    sanitized: sanitized || raw || "",
    source
  };
}

module.exports = { initTranscription, transcribeAudio };
