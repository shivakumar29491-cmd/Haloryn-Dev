const { checkLicense } = require("./licenseManager");

function startDailyCheck(mainWindow) {
    setInterval(async () => {
        const status = await checkLicense();

        if (!status.valid) {
            mainWindow.webContents.send("license:expired", status.reason);
        }
    }, 24 * 60 * 60 * 1000); // daily check
}

module.exports = { startDailyCheck };

