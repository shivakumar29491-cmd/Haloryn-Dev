// transcriptionEngine.js
// Groq Whisper-large-v3-turbo Streaming Engine
// Handles fast cloud STT for Companion Mode

const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const Groq = require("groq-sdk");

const MODEL = process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo";

class TranscriptionEngine {
  constructor(apiKey) {
    if (!apiKey) throw new Error("Missing Groq API key for transcription engine");
    this.groq = new Groq({ apiKey });
  }

  /**
   * Transcribe a WAV/PCM buffer through Groq Whisper
   * @param {Buffer} audioBuffer
   * @returns {Promise<string>} transcript
   */
  async transcribeBuffer(audioBuffer) {
    if (!audioBuffer || !audioBuffer.length) return "";

    const tmpFile = path.join(
      os.tmpdir(),
      `haloai_chunk_${Date.now()}_${randomUUID()}.wav`
    );

    try {
      await fs.promises.writeFile(tmpFile, audioBuffer);
      const result = await this.groq.audio.transcriptions.create({
        file: await Groq.File.fromPath(tmpFile),
        model: MODEL
      });

      return result?.text || "";
    } catch (err) {
      console.error("[Groq-STT] Error:", err);
      throw err;
    } finally {
      try {
        await fs.promises.unlink(tmpFile);
      } catch {
        /* noop */
      }
    }
  }

  /**
   * (Optional future): Real-time streaming interface
   * This is for ultra-low-latency Companion mode
   */
  async transcribeStream(audioBuffer, onPartial, onFinal) {
    if (!audioBuffer || !audioBuffer.length) return null;

    try {
      const stream = await this.groq.audio.transcriptions.stream({
        file: audioBuffer,
        model: MODEL
      });

      stream.on("data", (chunk) => {
        if (chunk?.text) onPartial?.(chunk.text);
      });

      stream.on("end", () => {
        onFinal?.();
      });

      return stream;
    } catch (err) {
      console.error("[Groq-STT-Stream] Error:", err);
      throw err;
    }
  }
}

module.exports = { TranscriptionEngine };
