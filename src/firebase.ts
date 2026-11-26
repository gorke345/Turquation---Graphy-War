/**
 * ============================================================================
 * TURQUATION — 100% SERVERLESS FIREBASE CONFIGURATION
 * ============================================================================
 *
 * Uses ONLY Firebase Authentication (Email/Password + Google) and
 * Firebase Realtime Database (RTDB). Zero Firestore, zero external WebSocket
 * or Node/Express backend required. Ready for 1-click static deployment on
 * Netlify, Vercel, or Firebase Hosting.
 *
 * Setup Steps:
 * 1. Copy `.env.example` to `.env` (or configure env vars in Netlify/Vercel):
 *      VITE_FIREBASE_API_KEY=...
 *      VITE_FIREBASE_AUTH_DOMAIN=...
 *      VITE_FIREBASE_DATABASE_URL=https://<project-id>-default-rtdb.firebaseio.com
 *      VITE_FIREBASE_PROJECT_ID=...
 *      VITE_FIREBASE_STORAGE_BUCKET=...
 *      VITE_FIREBASE_MESSAGING_SENDER_ID=...
 *      VITE_FIREBASE_APP_ID=...
 * 2. In Firebase Console:
 *    - Enable Authentication -> Sign-in method -> Email/Password & Google
 *    - Create a Realtime Database and publish `/database.rules.json`
 *
 * Guest Ephemerality Guarantee:
 * - Guests NEVER write to `/users`, `/leaderboard`, or `/user_matches`.
 * - Active guest presence lives ONLY at `/ephemeral_guests/{sessionId}` and is
 *   removed automatically via `onDisconnect(guestRef).remove()`.
 * ============================================================================
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database, ref, set, onDisconnect, remove } from 'firebase/database';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: (env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  databaseURL: (env.VITE_FIREBASE_DATABASE_URL || '').trim(),
  projectId: (env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (env.VITE_FIREBASE_APP_ID || '').trim(),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let rtdbInstance: Database | null = null;

if (isFirebaseConfigured) {
  try {
    appInstance = initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    rtdbInstance = getDatabase(appInstance, firebaseConfig.databaseURL);
  } catch (err) {
    console.error('Firebase initialization failed. Verify your 7 VITE_FIREBASE_* env variables.', err);
    appInstance = null;
    authInstance = null;
    rtdbInstance = null;
  }
}

export const app: FirebaseApp | null = appInstance;
export const auth: Auth | null = authInstance;
export const rtdb: Database | null = rtdbInstance;

/**
 * Registers an ephemeral guest presence node in Firebase Realtime Database
 * under `/ephemeral_guests/{sessionId}` with guaranteed automatic cleanup
 * via `onDisconnect().remove()`.
 */
export async function registerEphemeralGuestPresence(
  sessionId: string,
  nickname: string
): Promise<() => Promise<void>> {
  if (!rtdb) {
    return async () => {};
  }
  const guestRef = ref(rtdb, `ephemeral_guests/${sessionId}`);
  try {
    await onDisconnect(guestRef).remove();
    await set(guestRef, {
      nickname: nickname.trim().slice(0, 24),
      connectedAt: Date.now(),
    });
  } catch {
    // Non-blocking if RTDB rules reject unauthenticated guest writes
  }
  return async () => {
    try {
      await remove(guestRef);
    } catch {
      // Ignore cleanup errors on already-closed sessions
    }
  };
}
