/*
  (c) 2025 iMSK Consultants LLC - Haloryn AI
  All Rights Reserved.
*/
import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
// Use initializeAuth so we can control persistence and the popup resolver in Electron.
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
});
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
  getRedirectResult
};
