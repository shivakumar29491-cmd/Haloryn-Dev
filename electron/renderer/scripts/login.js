
import {
  loginManual,
  loginGoogle,
  loginGoogleRedirect,
  resolveRedirectLogin,
  loginFacebook,
  loginFacebookRedirect
} from "../../auth/authManager.js";

console.log("Login.js loaded");

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

  // Go straight to redirect to avoid popup/COOP issues
  await loginGoogleRedirect();
};

document.getElementById("facebookLogin").onclick = async () => {
  console.log("Facebook clicked");

  await loginFacebookRedirect();
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
