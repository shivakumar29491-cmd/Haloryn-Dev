const keyInput = document.getElementById("licenseKey");
const activateBtn = document.getElementById("activateBtn");
const trialBtn = document.getElementById("startTrialBtn");
const statusText = document.getElementById("status");

// --- DEV MODE: Skip popup entirely ---
if (!window.isPackaged) {
    console.log("DEV MODE: trial popup skipped, redirecting to app...");
    window.electronAPI.loadActivity();
}

// --- Activate License ---
activateBtn.onclick = async () => {
    const key = keyInput.value.trim();
    if (!key) return;

    const res = await window.licenseAPI.activate(key);
    if (res.success) {
        statusText.textContent = "License Activated!";
        setTimeout(async () => {
            const ok = await window.electronAPI.loadActivity();
            if (!ok) console.error("loadActivity failed");
        }, 700);
    } else {
        statusText.textContent = "Invalid Key";
    }
};

// --- Start Trial ---
trialBtn.onclick = async () => {
    const email = document.getElementById("trialEmail").value.trim();

    if (!email) {
        statusText.textContent = "Please enter an email.";
        return;
    }

    // DEV mode: skip everything
    if (!window.isPackaged) {
        console.log("DEV MODE: trial popup skipped → redirect to app");
        window.electronAPI.loadActivity();
        return;
    }

    // PROD MODE — start trial linked to email
    const res = await window.licenseAPI.startTrial(email);

    if (res?.success) {
        statusText.textContent = "Trial Started!";
        setTimeout(async () => {
            const ok = await window.electronAPI.loadActivity();
            if (!ok) console.error("loadActivity failed");
        }, 700);
    } else {
        statusText.textContent = res?.message || "Unable to start trial.";
    }
};
