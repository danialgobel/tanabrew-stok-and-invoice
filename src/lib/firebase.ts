import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAuimcJrzqCAp1iBwp-5KrlSdQuSeLL2SQ",
  authDomain: "tanabrew.firebaseapp.com",
  projectId: "tanabrew",
  storageBucket: "tanabrew.firebasestorage.app",
  messagingSenderId: "753590637400",
  appId: "1:753590637400:web:481cc6f059a66ac8714b2d"
};

const app = initializeApp(firebaseConfig);

// Initialize auth with IndexedDB persistence and fallback to browserLocalPersistence for reliable native Webview session
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});

export const db = getFirestore(app);
export const storage = getStorage(app);

