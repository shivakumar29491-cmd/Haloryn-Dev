// ===== Whisper Local Wrapper =====
// Wraps whisper.cpp (or any local Whisper build) for offline STT fallback

const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const { spawn } = require("child_process");
const fetch = require("node-fetch");

// ===== Configuration =====
const WHISPER_BIN =
  process.env.WHISPER_BIN ||
  (process.platform === "win32"
    ? "C:\\\\dev\\\\whisper.cpp\\\\build\\\\bin\\\\Release\\\\whisper-cli.exe"
    : "whisper-cli");
const WHISPER_MODEL =
  process.env.WHISPER_MODEL ||
  (process.platform === "win32"
    ? "C:\\\\dev\\\\whisper.cpp\\\\models\\\\ggml-tiny.en.bin"
    : path.join(process.cwd(), "models", "ggml-tiny.en.bin"));
const WHISPER_THREADS = Number(process.env.WHISPER_THREADS || 2);
const WHISPER_LANG = process.env.WHISPER_LANG || "en";
const WHISPER_NGL = process.env.WHISPER_NGL ? String(process.env.WHISPER_NGL) : null;
const FAST_TRANSCRIBE_URL = process.env.FAST_TRANSCRIBE_URL || "";

// ===== Optional fast local service =====
async function tryFastLocalTranscribe(audioBuffer) {
  if (!FAST_TRANSCRIBE_URL || !audioBuffer?.length) return null;
  try {
    const res = await fetch(FAST_TRANSCRIBE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buffer: audioBuffer.toString("base64") })
    });
    if (!res.ok) return null;

    const json = await res.json();
    const text = json?.text || json?.transcript || "";
    return String(text || "").trim() || null;
  } catch (err) {
    console.warn("[WhisperLocal] fast transcribe unavailable:", err.message);
    return null;
  }
}

// ===== Whisper.cpp invocation =====
async function runWhisperCpp(audioBuffer) {
  if (!audioBuffer || !audioBuffer.length) return "";

  const fast = await tryFastLocalTranscribe(audioBuffer);
  if (fast) return fast;

  const baseName = path.join(
    os.tmpdir(),
    `haloai_whisper_${Date.now()}_${randomUUID()}`
  );
  const wavPath = `${baseName}.wav`;
  const txtPath = `${baseName}.txt`;

  await fs.promises.writeFile(wavPath, audioBuffer);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      for (const file of [wavPath, txtPath]) {
        fs.promises
          .unlink(file)
          .catch(() => {});
      }
    };

    const args = [
      "-m",
      WHISPER_MODEL,
      "-f",
      wavPath,
      "-otxt",
      "-l",
      WHISPER_LANG,
      "-t",
      String(WHISPER_THREADS)
    ];
    if (WHISPER_NGL && Number(WHISPER_NGL) > 0) {
      args.push("-ngl", WHISPER_NGL);
    }

    const child = spawn(WHISPER_BIN, args, {
      windowsHide: process.platform === "win32"
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      cleanup();
      reject(err);
    });
    child.on("close", async () => {
      try {
        if (
          /\b(usage:|Voice Activity Detection|options:)\b/i.test(stderr || "")
        ) {
          console.warn("[WhisperLocal] CLI returned help text, treating as empty");
          cleanup();
          return resolve("");
        }

        const text = fs.existsSync(txtPath)
          ? fs.readFileSync(txtPath, "utf8")
          : "";
        const normalized = text
          .split(/\r?\n+/)
          .map((line) => line.trim())
          .filter((line) => line && !/BLANK_AUDIO/i.test(line))
          .join("\n");
        cleanup();
        resolve(normalized);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  });
}

module.exports = { runWhisperCpp };
