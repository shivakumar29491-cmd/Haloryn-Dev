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
  createUserWithEmailAndPassword,
  signOut
} from "./firebase.js";
import { doc, setDoc } from "firebase/firestore";
import { sendPhoneOTP } from "./phoneOtp.js";
import { sendEmailOTP, verifyEmailOTP } from "./emailOtp.js";

// ===== Manual registration/login =====

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

// ===== OAuth flows =====
export async function loginGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function loginGoogleRedirect() {
  const provider = new GoogleAuthProvider();
  await signInWithRedirect(auth, provider);
}

export async function resolveRedirectLogin() {
  const result = await getRedirectResult(auth);
  return result?.user || null;
}

export async function loginFacebook() {
  const provider = new FacebookAuthProvider();
  provider.setCustomParameters({ auth_type: "reauthenticate" });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function loginFacebookRedirect() {
  const provider = new FacebookAuthProvider();
  await signInWithRedirect(auth, provider);
}

// ===== OTP verification & sign-out =====
export async function verifyOtpFlow(type, payload) {
  if (type === "email") {
    return verifyEmailOTP(payload.email, payload.code);
  }
  return payload.confirmResult.confirm(payload.code);
}

export async function signOutUser() {
  return signOut(auth);
}
