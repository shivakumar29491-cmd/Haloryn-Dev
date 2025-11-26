import { registerManual } from "../../auth/authManager";

signupBtn.onclick = async () => {
  const user = {
    first: first.value,
    last: last.value,
    phone: phone.value,
    email: email.value,
    password: password.value
  };

  const sendTo = otpTo.value;
  const otpSession = await registerManual(user, sendTo);

  sessionStorage.setItem("otpFlowType", sendTo);
  sessionStorage.setItem("otpEmail", user.email);
  sessionStorage.setItem("otpPhone", user.phone);
  sessionStorage.setItem("otpConfirmObj", JSON.stringify(otpSession));

  window.location = "otp.html";
};
