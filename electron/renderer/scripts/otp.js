// ===== OTP verification wiring =====
import { verifyOtpFlow } from "../../auth/authManager";

verifyOtpBtn.onclick = async () => {
  const code = otpCode.value;

  const type = sessionStorage.getItem("otpFlowType");
  const email = sessionStorage.getItem("otpEmail");
  const phone = sessionStorage.getItem("otpPhone");
  const confirmObj = JSON.parse(sessionStorage.getItem("otpConfirmObj"));

  const payload =
    type === "email"
      ? { email, code }
      : { code, confirmResult: confirmObj };

  const result = await verifyOtpFlow(type, payload);

  if (result) {
    await window.electronAPI.saveUserSession({
      email: email,
      phone: phone,
      verified: true
    });
    await window.electronAPI.loadActivity();
  }
};

resendOtpBtn.onclick = () => {
  location.reload();
};
