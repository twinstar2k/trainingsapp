import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase only if config is present to avoid crashing without env vars
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
// Long-Polling erzwingen statt der WebChannel-Auto-Erkennung: Auf Mobilnetzen
// (Mobilfunk/Carrier-Proxy/NAT) blieb die erste getDocs-Anfrage einer frisch
// geöffneten Liste sonst hängen (Symptom: Dauer-Spinner, erst Reload/Tab-Wechsel
// löste es). Jede Query ist so eine eigenständige HTTP-Anfrage, die nicht in einem
// hängenden Stream steckenbleiben kann — minimal höhere Latenz, dafür robust.
export const db = app
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : null;
// Cloud Functions in derselben Region wie das Deployment (europe-west3).
export const functions = app ? getFunctions(app, "europe-west3") : null;
export const googleProvider = new GoogleAuthProvider();
