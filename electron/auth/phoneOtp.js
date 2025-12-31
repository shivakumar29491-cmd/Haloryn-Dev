/*
  (c) 2025 iMSK Consultants LLC - Haloryn AI
  All Rights Reserved.
*/

import { auth, RecaptchaVerifier, signInWithPhoneNumber } from "./firebase.js";

// ===== Phone OTP helpers =====

export async function sendPhoneOTP(phone) {
  window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {}, auth);
  return signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
}
