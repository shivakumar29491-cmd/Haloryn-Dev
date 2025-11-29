const { ipcMain } = require("electron");

const {
    activateLicense,
    checkLicense
} = require("../license/licenseManager");

const {
    startTrial,
    getTrialStatus
} = require("../license/trialManager");

ipcMain.handle("license:activate", async (_e, key) => {
    return await activateLicense(key);
});

ipcMain.handle("license:check", async () => {
    return await checkLicense();
});

ipcMain.handle("license:startTrial", async () => {
    return startTrial();
});

ipcMain.handle("license:trialStatus", () => {
    return getTrialStatus();
});
