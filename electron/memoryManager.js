// ===== Memory Manager =====
const fs = require("fs");
const path = require("path");
const os = require("os");

const memFile = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "Haloryn",
  "memory.json"
);

// Default structure
const defaultMemory = {
  preferences: {},
  biography: {},
  likedTopics: [],
  dislikedTopics: [],
  toneProfile: "neutral",
  lastEmotion: "neutral",
  historySummary: ""
};

// ===== Load memory (ensures file exists) =====
function loadMemory() {
  try {
    if (!fs.existsSync(memFile)) {
      fs.writeFileSync(memFile, JSON.stringify(defaultMemory, null, 2));
      return defaultMemory;
    }
    const json = JSON.parse(fs.readFileSync(memFile, "utf8"));
    return { ...defaultMemory, ...json };
  } catch {
    return defaultMemory;
  }
}

// ===== Persist memory =====
function saveMemory(mem) {
  try {
    fs.writeFileSync(memFile, JSON.stringify(mem, null, 2));
  } catch {}
}

module.exports = { loadMemory, saveMemory };
