
import {
  loginManual,
  loginGoogle,
  resolveRedirectLogin,
  loginFacebook
} from "../../auth/authManager.js";

// Window chrome controls for frameless window
(() => {
  const btnMin = document.getElementById("win-min");
  const btnMax = document.getElementById("win-max");
  const btnClose = document.getElementById("win-close");
  const chrome = document.querySelector(".window-buttons");

  if (window.windowCtl) {
    btnMin?.addEventListener("click", () => window.windowCtl.minimize());
    btnMax?.addEventListener("click", () => window.windowCtl.maximize());
    btnClose?.addEventListener("click", () => window.windowCtl.close());
  } else if (chrome) {
    chrome.classList.add("hidden");
  }
})();

const loginEmailEl = document.getElementById("loginEmail");
const loginPasswordEl = document.getElementById("loginPassword");
const loginOtpToEl = document.getElementById("loginOtpTo");
const loginPhoneEl = document.getElementById("loginPhone");
const loginBtn = document.getElementById("loginBtn");
const googleBtn = document.getElementById("googleLogin");
const facebookBtn = document.getElementById("facebookLogin");
const testAppBtn = document.getElementById("testAppBtn");

function attachLoading(button, handler) {
  if (!button) return;
  button.addEventListener("click", async (event) => {
    if (button.classList.contains("is-loading")) return;
    button.classList.add("is-loading");
    button.disabled = true;
    try {
      await handler(event);
    } finally {
      button.classList.remove("is-loading");
      button.disabled = false;
    }
  });
}

attachLoading(loginBtn, async () => {
  try {
    const email = loginEmailEl.value;
    const password = loginPasswordEl.value;
    const sendTo = loginOtpToEl.value;
    const phone = loginPhoneEl.value;

    const otpSession = await loginManual(email, password, sendTo, phone);

    sessionStorage.setItem("otpFlowType", sendTo);
    sessionStorage.setItem("otpEmail", email);
    sessionStorage.setItem("otpPhone", phone);
    sessionStorage.setItem("otpConfirmObj", JSON.stringify(otpSession));

    window.location = "otp.html";
  } catch (err) {
    console.error("Manual login failed", err);
    alert(`Login failed: ${err?.message || err}`);
  }
});

attachLoading(googleBtn, async () => {
  try {
    const user = await loginGoogle();
    if (user) {
      await window.electronAPI?.saveUserSession({
        email: user?.email || "",
        displayName: user?.displayName || "",
        phone: user?.phoneNumber || "",
        verified: true,
        provider: "google"
      });
      await window.electronAPI?.loadActivity();
    }
  } catch (err) {
    console.error("Google login failed", err);
    alert(`Google login failed: ${err?.message || err}`);
  }
});

attachLoading(facebookBtn, async () => {
  try {
    const user = await loginFacebook();
    if (user) {
      await window.electronAPI?.saveUserSession({
        email: user?.email || "",
        displayName: user?.displayName || "",
        phone: user?.phoneNumber || "",
        verified: true,
        provider: "facebook"
      });
      await window.electronAPI?.loadActivity();
    }
  } catch (err) {
    console.error("Facebook login failed", err);
    alert(`Facebook login failed: ${err?.message || err}`);
  }
});

attachLoading(testAppBtn, async () => {
  try {
    if (!window.electronAPI) {
      throw new Error("electronAPI missing in preload");
    }

    await window.electronAPI.saveUserSession({
      email: "",
      phone: "",
      verified: true,
      provider: "test-skip"
    });
    const ok = await window.electronAPI.loadActivity();
    if (!ok) {
      throw new Error("loadActivity returned false");
    }
  } catch (err) {
    console.error("Skip login failed", err);
    alert(`Unable to skip login: ${err?.message || err}`);
  }
});

// Handle redirect result on load (if popup was blocked)
(async () => {
  try {
    const redirectUser = await resolveRedirectLogin();
    if (redirectUser) {
      window.electronAPI?.saveUserSession({
        email: redirectUser?.email || "",
        phone: "",
        verified: true,
        provider: "redirect"
      });
      await window.electronAPI?.loadActivity();
    }
  } catch (e) {
    // silence redirect resolution errors
  }
})();
