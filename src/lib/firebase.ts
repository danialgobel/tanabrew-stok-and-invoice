import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAuimcJrzqCAp1iBwp-5KrlSdQuSeLL2SQ",
  authDomain: "tanabrew.firebaseapp.com",
  projectId: "tanabrew",
  storageBucket: "tanabrew.firebasestorage.app",
  messagingSenderId: "753590637400",
  appId: "1:753590637400:web:481cc6f059a66ac8714b2d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
