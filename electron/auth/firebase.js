/*
  (c) 2025 iMSK Consultants LLC - Haloryn AI
  All Rights Reserved.
*/
import { initializeApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ===== Firebase client bootstrap =====
const firebaseConfig = {
  apiKey: "AIzaSyDWnT8jKXinK2rpv6XIVlcMPnoIyFXq_Zo",
  authDomain: "haloryn.firebaseapp.com",
  projectId: "haloryn",
  storageBucket: "haloryn.firebasestorage.app",
  messagingSenderId: "1077704369128",
  appId: "1:1077704369128:web:0e2f0294618edd52f5fa5d",
  measurementId: "G-78565873K9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth,
  db,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
};
