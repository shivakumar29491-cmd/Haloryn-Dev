
import {
  loginManual,
  loginGoogle,
  resolveRedirectLogin,
  loginFacebook
} from "../../auth/authManager.js";

console.log("Login.js loaded");

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

document.getElementById("loginBtn").onclick = async () => {
    console.log("Manual login clicked");
  const email = loginEmail.value;
  const password = loginPassword.value;
  const sendTo = loginOtpTo.value;
  const phone = loginPhone.value;

  const otpSession = await loginManual(email, password, sendTo, phone);

  sessionStorage.setItem("otpFlowType", sendTo);
  sessionStorage.setItem("otpEmail", email);
  sessionStorage.setItem("otpPhone", phone);
  sessionStorage.setItem("otpConfirmObj", JSON.stringify(otpSession));

  window.location = "otp.html";
};

document.getElementById("googleLogin").onclick = async () => {
  console.log("Google clicked");

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
};

document.getElementById("facebookLogin").onclick = async () => {
  console.log("Facebook clicked");

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
};

document.getElementById("testAppBtn").onclick = async () => {
  console.log("Test app (skip login) clicked");
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
    console.log("loadActivity result", ok);
    if (!ok) {
      throw new Error("loadActivity returned false");
    }
  } catch (err) {
    console.error("Skip login failed", err);
    alert(`Unable to skip login: ${err?.message || err}`);
  }
};

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
