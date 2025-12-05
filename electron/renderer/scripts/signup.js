// ===== Signup page wiring =====
import { registerManual } from "../../auth/authManager";

const isDevBypass = window.isPackaged === false;

signupBtn.onclick = async () => {
  const user = {
    first: first.value,
    last: last.value,
    phone: phone.value,
    email: email.value,
    password: password.value
  };

  const sendTo = otpTo.value;

  if (isDevBypass) {
    try {
      await window.electronAPI?.saveUserSession({
        email: user.email || "dev@haloryn.local",
        displayName: `${user.first || ""} ${user.last || ""}`.trim() || "Dev User",
        phone: user.phone || "",
        verified: true,
        provider: "dev-manual"
      });
      await window.electronAPI?.loadActivity();
    } catch (err) {
      console.error("Dev create account bypass failed", err);
      alert(`Unable to bypass signup in dev mode: ${err?.message || err}`);
    }
    return;
  }

  const otpSession = await registerManual(user, sendTo);

  sessionStorage.setItem("otpFlowType", sendTo);
  sessionStorage.setItem("otpEmail", user.email);
  sessionStorage.setItem("otpPhone", user.phone);
  sessionStorage.setItem("otpConfirmObj", JSON.stringify(otpSession));

  window.location = "otp.html";
};
