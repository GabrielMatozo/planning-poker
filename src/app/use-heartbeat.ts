import { useEffect } from "react";
import { onDisconnect, onValue, ref, serverTimestamp, update } from "@firebase/database";
import { getDb } from "../data/firebase/client";

export const HEARTBEAT_INTERVAL_MS = 15_000;
export const CONNECTED_PATH = ".info/connected";

export function useHeartbeat(roomId: string, uid: string | null, enabled: boolean): void {
  useEffect(() => {
    if (!uid || !enabled) return;

    const db = getDb();
    const presenceRef = ref(db, `rooms/${roomId}/presence/${uid}`);
    const connectedRef = ref(db, CONNECTED_PATH);

    const beat = () => {
      void update(presenceRef, { online: true, lastSeen: serverTimestamp() }).catch(() => undefined);
    };

    const stopConnected = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() !== true) return;

      void onDisconnect(presenceRef)
        .update({ online: false, lastSeen: serverTimestamp() })
        .then(beat)
        .catch(() => undefined);
    });

    const timer = setInterval(() => {
      // Bate mesmo em aba oculta: navegador estrangula o timer, mas não a ponto
      // de estourar a janela de presença. Sem isso o host em outra aba cai.
      beat();
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    const handleOnline = () => beat();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      stopConnected();
      // Sai da sala de verdade: sem isso a presença ficaria "online" até a
      // janela de staleness expirar.
      void update(presenceRef, { online: false, lastSeen: serverTimestamp() }).catch(() => undefined);
      void onDisconnect(presenceRef).cancel().catch(() => undefined);
    };
  }, [roomId, uid, enabled]);
}
