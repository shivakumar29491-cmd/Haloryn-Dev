// ===== Trial management helpers =====
const fs = require("fs");
const path = require("path");
const os = require("os");

const APP_ID = process.env.APP_INTERNAL_ID || "haloryn";
const TRIAL_FILENAME = "license.json"; // shared with license data
const LEGACY_TRIAL_FILE = path.join(process.cwd(), "trial.json");

function licenseFilePath() {
  return path.join(os.homedir(), "AppData", "Roaming", APP_ID, TRIAL_FILENAME);
}

function ensureDir() {
  const dir = path.dirname(licenseFilePath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function startTrial(email) {
  try {
    if (!email) {
      return { success: false, message: "Email is required." };
    }

    const start = Date.now();
    const expires = start + 7 * 24 * 60 * 60 * 1000;

    const data = {
      email,
      start,
      expires,
      status: "active",
      isTrial: true,
      ends: expires
    };

    ensureDir();
    fs.writeFileSync(licenseFilePath(), JSON.stringify({ trial: data }, null, 2));
    fs.writeFileSync(LEGACY_TRIAL_FILE, JSON.stringify(data, null, 2));

    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function readLegacyTrial() {
  try {
    if (!fs.existsSync(LEGACY_TRIAL_FILE)) return null;
    return JSON.parse(fs.readFileSync(LEGACY_TRIAL_FILE, "utf8"));
  } catch {
    return null;
  }
}

function getTrialStatus() {
  try {
    const raw = fs.readFileSync(licenseFilePath(), "utf8");
    const json = JSON.parse(raw);
    if (json.trial && json.trial.isTrial) {
      return json.trial;
    }
  } catch {
    /* noop */
  }
  return readLegacyTrial();
}

function trialActive() {
  const t = getTrialStatus();
  if (!t) return false;
  return Date.now() < Number(t.ends || t.expires || 0);
}

module.exports = {
  licenseFilePath,
  startTrial,
  getTrialStatus,
  trialActive
};
