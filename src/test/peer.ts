import { deleteApp, initializeApp } from "@firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "@firebase/auth";
import { connectDatabaseEmulator, getDatabase, type Database } from "@firebase/database";
import {
  EMULATOR_AUTH_URL,
  EMULATOR_DB_HOST,
  EMULATOR_DB_NAMESPACE,
  EMULATOR_DB_PORT,
  EMULATOR_PROJECT_ID,
} from "../data/firebase/client";

export type Peer = {
  uid: string;
  db: Database;
  dispose(): Promise<void>;
};

const DB_URL = `http://${EMULATOR_DB_HOST}:${EMULATOR_DB_PORT}?ns=${EMULATOR_DB_NAMESPACE}`;

let peers = 0;

export async function createPeer(): Promise<Peer> {
  peers += 1;

  const app = initializeApp(
    { projectId: EMULATOR_PROJECT_ID, apiKey: "demo-key", databaseURL: DB_URL },
    `peer-${peers}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, EMULATOR_AUTH_URL, { disableWarnings: true });

  const credential = await signInAnonymously(auth);
  const db = getDatabase(app);
  connectDatabaseEmulator(db, EMULATOR_DB_HOST, EMULATOR_DB_PORT);

  return {
    uid: credential.user.uid,
    db,
    async dispose() {
      await deleteApp(app);
    },
  };
}
