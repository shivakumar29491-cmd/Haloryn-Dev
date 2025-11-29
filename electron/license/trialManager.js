const fs = require("fs");
const path = require("path");
const os = require("os");

const TRIAL_FILENAME = "license.json"; // shared with license data
const APP_ID = process.env.APP_INTERNAL_ID || "haloryn";
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || "14");

function licenseFilePath() {
    return path.join(os.homedir(), "AppData", "Roaming", APP_ID, TRIAL_FILENAME);
}

function ensureDir() {
    const dir = path.dirname(licenseFilePath());
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}



const trialFile = path.join(process.cwd(), "trial.json");

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
            status: "active"
        };

        fs.writeFileSync(trialFile, JSON.stringify(data, null, 2));

        return { success: true };
    } catch (err) {
        return { success: false, message: err.message };
    }
}

function getTrialStatus() {
    try {
        if (!fs.existsSync(trialFile)) return null;
        return JSON.parse(fs.readFileSync(trialFile, "utf8"));
    } catch {
        return null;
    }
}

module.exports = {
    startTrial,
    getTrialStatus
};


function getTrialStatus() {
    try {
        const raw = fs.readFileSync(licenseFilePath(), "utf8");
        const json = JSON.parse(raw);

        if (!json.trial || !json.trial.isTrial) return null;

        return json.trial;
    } catch {
        return null;
    }
}

function trialActive() {
    const t = getTrialStatus();
    if (!t) return false;

    return Date.now() < t.ends;
}

module.exports = {
    licenseFilePath,
    startTrial,
    getTrialStatus,
    trialActive
};
