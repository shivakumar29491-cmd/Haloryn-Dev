/*
  (c) 2025 iMSK Consultants LLC - Haloryn AI
  All Rights Reserved.
*/

// You will paste your cloud function URL here when ready.
const EMAIL_OTP_URL = "https://YOUR_CLOUD_FUNCTION/sendOtp";
const EMAIL_VERIFY_URL = "https://YOUR_CLOUD_FUNCTION/verifyOtp";

export async function sendEmailOTP(email) {
  const res = await fetch(EMAIL_OTP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  return res.json();
}

export async function verifyEmailOTP(email, code) {
  const res = await fetch(EMAIL_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code })
  });
  return res.json();
}
