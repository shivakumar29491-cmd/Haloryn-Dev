/*
  (c) 2025 iMSK Consultants LLC - Haloryn AI
  All Rights Reserved.
*/

import {
  auth,
  db,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "./firebase.js";
import { doc, setDoc } from "firebase/firestore";
import { sendPhoneOTP } from "./phoneOtp.js";
import { sendEmailOTP, verifyEmailOTP } from "./emailOtp.js";

export async function registerManual(user, sendTo) {
  const cred = await createUserWithEmailAndPassword(auth, user.email, user.password);

  await setDoc(doc(db, "users", cred.user.uid), {
    first: user.first,
    last: user.last,
    phone: user.phone,
    email: user.email,
    provider: "manual",
    otp: sendTo
  });

  return sendTo === "phone"
    ? sendPhoneOTP(user.phone)
    : sendEmailOTP(user.email);
}

export async function loginManual(email, password, sendTo, phone) {
  await signInWithEmailAndPassword(auth, email, password);

  return sendTo === "phone"
    ? sendPhoneOTP(phone)
    : sendEmailOTP(email);
}

export async function loginGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    // Only fall back to redirect for known popup issues; otherwise surface the error.
    const code = err?.code || "";
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function resolveRedirectLogin() {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (err) {
    // Ignore "no auth event" noise; bubble up anything else for logging.
    if (err?.code === "auth/no-auth-event") return null;
    throw err;
  }
}

export async function loginFacebook() {
  const provider = new FacebookAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    // Only fall back to redirect for known popup issues; otherwise surface the error.
    const code = err?.code || "";
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function verifyOtpFlow(type, payload) {
  if (type === "email") {
    return verifyEmailOTP(payload.email, payload.code);
  }
  return payload.confirmResult.confirm(payload.code);
}
