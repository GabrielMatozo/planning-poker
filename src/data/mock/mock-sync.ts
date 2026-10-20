import type { Participant, RoundHistoryEntry, RoundStats, RoomMeta } from "../../types/room";

/**
 * Estado compartilhado do mock entre abas via BroadcastChannel.
 *
 * Cada provider mock com roomId mantém a própria cópia local (me, myVote) e
 * recebe o estado compartilhado dos outros providers (participants, meta,
 * stats, history).
 *
 * Para evitar conflitos de quem publica primeiro, cada publicação tem um
 * timestamp. O receptor só aceita se for mais recente que o último que
 * recebeu.
 */

export type SharedPayload = {
  participants: Participant[];
  meta: RoomMeta | null;
  stats: RoundStats | null;
  history: RoundHistoryEntry[];
};

type Message =
  | { kind: "shared"; payload: SharedPayload; from: string; ts: number }
  | { kind: "request"; from: string }
  | { kind: "bye"; uid: string; from: string };

export interface MockSync {
  publishShared(payload: SharedPayload): void;
  onShared(callback: (payload: SharedPayload) => void): () => void;
  /** Avisa que este uid saiu, para outros providers removerem a presença. */
  publishBye(uid: string): void;
  requestState(): void;
  latest(): SharedPayload | null;
  close(): void;
}

const STORAGE_KEY = (roomId: string) => `pp:mock:${roomId}`;

function readStore(roomId: string): SharedPayload | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      participants?: Participant[];
      meta?: { id?: string; name?: string; hostId?: string; revealed?: boolean; round?: number; autoReveal?: boolean } | null;
      stats?: RoundStats | null;
      history?: RoundHistoryEntry[];
    };
    if (!parsed || (!parsed.participants?.length && !parsed.meta)) return null;
    const meta: RoomMeta | null = parsed.meta ? {
      id: parsed.meta.id ?? "mock01",
      name: parsed.meta.name ?? "Sprint 42",
      hostId: parsed.meta.hostId ?? "",
      revealed: parsed.meta.revealed ?? false,
      round: parsed.meta.round ?? 1,
      autoReveal: parsed.meta.autoReveal ?? false,
    } : null;
    return {
      participants: parsed.participants ?? [],
      meta,
      stats: parsed.stats ?? null,
      history: parsed.history ?? [],
    } as SharedPayload;
  } catch {
    return null;
  }
}

function writeStore(roomId: string, payload: SharedPayload): void {
  try {
    window.localStorage.setItem(STORAGE_KEY(roomId), JSON.stringify(payload));
  } catch {
    /* storage indisponível */
  }
}

export function createMockSync(roomId: string, uid: string): MockSync {
  const channelName = `mock-sync:${roomId}`;
  const channel = typeof BroadcastChannel === "function"
    ? new BroadcastChannel(channelName)
    : null;
  const listeners = new Set<(payload: SharedPayload) => void>();
  let last: SharedPayload | null = readStore(roomId);
  let lastTs = 0;

  if (channel) {
    channel.onmessage = (event: MessageEvent<Message>) => {
      const msg = event.data;
      if (!msg) return;
      // Ignora mensagens do próprio uid (eco)
      if (msg.from === uid) return;
      // Ignora mensagens mais antigas que a última recebida
      if (msg.kind === "shared" && msg.ts <= lastTs) return;
      if (msg.kind === "shared") {
        lastTs = msg.ts;
        last = msg.payload;
        writeStore(roomId, msg.payload);
        listeners.forEach((cb) => cb(msg.payload));
      } else if (msg.kind === "bye") {
        // Outra aba saiu: remove a presença do uid correspondente
        if (last) {
          const filtered: SharedPayload = {
            ...last,
            participants: last.participants.filter((p) => p.uid !== msg.uid),
          };
          last = filtered;
          writeStore(roomId, filtered);
          listeners.forEach((cb) => cb(filtered));
        }
      } else if (msg.kind === "request") {
        if (last) {
          channel.postMessage({ kind: "shared", payload: last, from: uid, ts: Date.now() } satisfies Message);
        }
      }
    };
  }

  return {
    publishShared(payload: SharedPayload) {
      const ts = Date.now();
      lastTs = ts;
      last = payload;
      writeStore(roomId, payload);
      listeners.forEach((cb) => cb(payload));
      channel?.postMessage({ kind: "shared", payload, from: uid, ts } satisfies Message);
    },
    onShared(callback: (payload: SharedPayload) => void) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    publishBye(targetUid: string) {
      // Remove a presença do uid do shared
      if (last) {
        const filtered: SharedPayload = {
          ...last,
          participants: last.participants.filter((p) => p.uid !== targetUid),
        };
        last = filtered;
        writeStore(roomId, filtered);
        listeners.forEach((cb) => cb(filtered));
      }
      console.log("[publishBye] sending bye to channel for uid:", targetUid, "from:", uid);
      console.log("[publishBye] sending bye to channel for uid:", targetUid, "from:", uid);
      console.log("[publishBye] sending bye to channel for uid:", targetUid, "from:", uid);
      console.log("[publishBye] sending bye to channel for uid:", targetUid, "from:", uid);
      console.log("[publishBye] sending bye to channel for uid:", targetUid, "from:", uid);
      console.log("[publishBye] sending bye to channel for uid:", targetUid, "from:", uid);
      console.log("[publishBye] sending bye to channel for uid:", targetUid, "from:", uid);
      channel?.postMessage({ kind: "bye", uid: targetUid, from: uid } satisfies Message);
    },
    requestState() {
      channel?.postMessage({ kind: "request", from: uid } satisfies Message);
    },
    latest() {
      return last;
    },
    close() {
      listeners.clear();
      last = null;
      lastTs = 0;
      channel?.close();
    },
  };
}