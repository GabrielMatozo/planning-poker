import { initializeApp, type FirebaseApp } from "@firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from "@firebase/auth";
import { connectDatabaseEmulator, getDatabase, type Database } from "@firebase/database";

const env = import.meta.env;

/**
 * Caminho de produção lê as VITE_FIREBASE_*. Em dev/teste usa o emulador local
 * a menos que VITE_USE_EMULATOR !== "1" e exista config real de produção.
 */
function useEmulator(): boolean {
  if (env.VITE_USE_EMULATOR === "1") return true;
  if (env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_DATABASE_URL) {
    return false;
  }
  // Fallback: em dev sem env vars de produção, usa emulador
  return !env.PROD || !(env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_DATABASE_URL);
}

// Defaults do emulador local
export const EMULATOR_PROJECT_ID = env.VITE_EMULATOR_PROJECT_ID ?? "demo-planning-poker";
export const EMULATOR_AUTH_URL = env.VITE_EMULATOR_AUTH_URL ?? "http://127.0.0.1:9099";
export const EMULATOR_DB_HOST = env.VITE_EMULATOR_DB_HOST ?? "127.0.0.1";
export const EMULATOR_DB_PORT = Number(env.VITE_EMULATOR_DB_PORT ?? 9000);
export const EMULATOR_DB_NAMESPACE = env.VITE_EMULATOR_DB_NAMESPACE ?? "demo-planning-poker-default-rtdb";

// Config de produção via env vars
const PROD_PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID;
const PROD_API_KEY = env.VITE_FIREBASE_API_KEY;
const PROD_AUTH_DOMAIN = env.VITE_FIREBASE_AUTH_DOMAIN;
const PROD_DATABASE_URL = env.VITE_FIREBASE_DATABASE_URL;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;
let session: Promise<User> | null = null;

export function getFirebase(): FirebaseApp {
  if (!app) {
    if (useEmulator()) {
      app = initializeApp({
        projectId: EMULATOR_PROJECT_ID,
        apiKey: "demo-key",
        databaseURL: `http://${EMULATOR_DB_HOST}:${EMULATOR_DB_PORT}?ns=${EMULATOR_DB_NAMESPACE}`,
      });
    } else if (PROD_PROJECT_ID && PROD_API_KEY && PROD_DATABASE_URL) {
      app = initializeApp({
        apiKey: PROD_API_KEY,
        authDomain: PROD_AUTH_DOMAIN,
        projectId: PROD_PROJECT_ID,
        databaseURL: PROD_DATABASE_URL,
      });
    } else {
      throw new Error("Firebase não configurado: defina VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID e VITE_FIREBASE_DATABASE_URL ou rode o emulador.");
    }
  }
  return app;
}

export function getAuthInstance(): Auth {
  if (!auth) {
    auth = getAuth(getFirebase());
    if (useEmulator()) {
      connectAuthEmulator(auth, EMULATOR_AUTH_URL, { disableWarnings: true });
    }
  }
  return auth;
}

export function getDb(): Database {
  if (!db) {
    db = getDatabase(getFirebase());
    if (useEmulator()) {
      connectDatabaseEmulator(db, EMULATOR_DB_HOST, EMULATOR_DB_PORT);
    }
  }
  return db;
}

function waitForRestoredUser(instance: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(instance, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export function ensureAuth(): Promise<User> {
  if (!session) {
    session = (async () => {
      const instance = getAuthInstance();
      const restored = instance.currentUser ?? (await waitForRestoredUser(instance));
      if (restored) return restored;

      const credential = await signInAnonymously(instance);
      return credential.user;
    })().catch((error: unknown) => {
      session = null;
      throw error;
    });
  }

  return session;
}
