// ===== License manager =====
const fs = require("fs");
const path = require("path");
const os = require("os");

const { validateLicense } = require("./licenseValidator");
const { trialActive, getTrialStatus } = require("./trialManager");

const APP_ID = process.env.APP_INTERNAL_ID || "haloryn";

function getLicenseFile() {
    return path.join(os.homedir(), "AppData", "Roaming", APP_ID, "license.json");
}

function ensureDir() {
    const dir = path.dirname(getLicenseFile());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readLicense() {
    try {
        const raw = fs.readFileSync(getLicenseFile(), "utf8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function saveLicense(data) {
    ensureDir();
    fs.writeFileSync(getLicenseFile(), JSON.stringify(data, null, 2));
}

async function activateLicense(key) {
    const result = await validateLicense(key);

    if (!result.valid) {
        return { success: false, reason: result.reason };
    }

    const data = {
        licenseKey: key,
        lastChecked: Date.now(),
        validated: true,
        plan: result.plan,
        subscriptionStatus: result.subscriptionStatus
    };

    saveLicense(data);
    return { success: true };
}

async function checkLicense() {
    const json = readLicense();

    if (!json) return { valid: false, reason: "No license or trial" };

    // Trial valid?
    if (json.trial && json.trial.isTrial) {
        return {
            valid: trialActive(),
            reason: trialActive() ? "Trial Active" : "Trial Expired",
            trial: getTrialStatus()
        };
    }

    // License?
    if (json.licenseKey) {
        const v = await validateLicense(json.licenseKey);
        return {
            valid: v.valid,
            reason: v.valid ? "License Active" : "License Invalid",
            plan: v.plan
        };
    }

    return { valid: false, reason: "Missing license key" };
}

module.exports = {
    readLicense,
    saveLicense,
    activateLicense,
    checkLicense
};
