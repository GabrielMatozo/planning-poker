import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { goOffline, goOnline, ref, serverTimestamp, set, update } from "@firebase/database";
import { getAuthInstance, getDb } from "./client";
import { castVote, claimHost, createRoom, useFirebaseRoom } from "./room-provider";
import { HEARTBEAT_INTERVAL_MS, useHeartbeat } from "../../app/use-heartbeat";
import { newRoomCode } from "../../lib/ids";
import { createPeer, type Peer } from "../../test/peer";
import { EMULATOR_ENABLED, adminErase, adminGet, adminWrite, restGet } from "../../test/emulator";

// Cada teste abre sala própria; o limiter de criação é por minuto e não tem o que medir aqui.
beforeAll(() => {
  vi.stubEnv("VITE_QUOTA_DISABLED", "1");
});

const openPeers: Peer[] = [];

async function peer(): Promise<Peer> {
  const created = await createPeer();
  openPeers.push(created);
  return created;
}

function currentUid(): string {
  const user = getAuthInstance().currentUser;
  if (!user) throw new Error("Sessão anônima não iniciada");
  return user.uid;
}

async function authToken(): Promise<string> {
  const user = getAuthInstance().currentUser;
  if (!user) throw new Error("Sessão anônima não iniciada");
  return user.getIdToken();
}

async function presenceOf(roomId: string, uid: string): Promise<Record<string, unknown> | null> {
  const { status, body } = await restGet(`rooms/${roomId}/presence/${uid}`, await authToken());
  expect(status).toBe(200);
  return (body as Record<string, unknown> | null) ?? null;
}

async function presenceMap(roomId: string): Promise<Record<string, unknown>> {
  const { status, body } = await restGet(`rooms/${roomId}/presence`, await authToken());
  expect(status).toBe(200);
  return (body as Record<string, unknown> | null) ?? {};
}

async function seedRoomAs(host: Peer): Promise<string> {
  const roomId = newRoomCode();
  await set(ref(host.db, `rooms/${roomId}`), {
    meta: {
      name: "Sprint 42",
      hostId: host.uid,
      revealed: false,
      round: 1,
      autoReveal: false,
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    },
    presence: {
      [host.uid]: {
        name: "Host",
        color: "#D9A05B",
        online: true,
        lastSeen: serverTimestamp(),
        joinedAt: serverTimestamp(),
        hasVoted: false,
      },
    },
  });
  return roomId;
}

afterEach(async () => {
  goOnline(getDb());
  await Promise.all(openPeers.splice(0).map((item) => item.dispose()));
});

describe.skipIf(!EMULATOR_ENABLED)("presença ao vivo (emulador)", () => {
  it("heartbeat renova lastSeen sem apagar nome, entrada e voto", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const uid = currentUid();
    await castVote(roomId, uid, "5");

    const before = await presenceOf(roomId, uid);
    await update(ref(getDb(), `rooms/${roomId}/presence/${uid}`), { lastSeen: 1_000 });

    const { unmount } = renderHook(() => useHeartbeat(roomId, uid, true));

    await waitFor(async () => {
      const after = await presenceOf(roomId, uid);
      expect(Number(after?.lastSeen)).toBeGreaterThan(1_000);
      expect(after?.online).toBe(true);
    });

    const after = await presenceOf(roomId, uid);
    expect(after?.name).toBe("Ana");
    expect(after?.hasVoted).toBe(true);
    expect(after?.joinedAt).toBe(before?.joinedAt);
    expect(after?.color).toBe(before?.color);

    unmount();
  });

  it("dispara o batimento a cada 15s", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(15_000);
  });

  it("duas abas do mesmo usuário não duplicam a presença", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const uid = currentUid();

    const first = renderHook(() => useHeartbeat(roomId, uid, true));
    const second = renderHook(() => useHeartbeat(roomId, uid, true));

    await waitFor(async () => {
      const presence = await presenceMap(roomId);
      expect(Object.keys(presence)).toHaveLength(1);
    });

    const presence = await presenceMap(roomId);
    const entry = Object.values(presence)[0] as Record<string, unknown>;
    expect(entry.name).toBe("Ana");

    first.unmount();
    second.unmount();
  });

  it("onDisconnect marca offline e a reconexão volta a online", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const uid = currentUid();

    const { unmount } = renderHook(() => useHeartbeat(roomId, uid, true));

    await waitFor(async () => {
      expect((await presenceOf(roomId, uid))?.online).toBe(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    goOffline(getDb());

    await waitFor(
      async () => {
        expect((await presenceOf(roomId, uid))?.online).toBe(false);
      },
      { timeout: 20_000, interval: 250 },
    );

    goOnline(getDb());

    await waitFor(
      async () => {
        expect((await presenceOf(roomId, uid))?.online).toBe(true);
      },
      { timeout: 20_000, interval: 250 },
    );

    unmount();
  });

  it("host offline há mais de 60s transfere para o online mais antigo", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const hostUid = currentUid();
    const bruno = await peer();

    await update(ref(bruno.db, `rooms/${roomId}/presence/${bruno.uid}`), {
      name: "Bruno",
      color: "#5B8FD9",
      online: true,
      lastSeen: serverTimestamp(),
      joinedAt: serverTimestamp(),
      hasVoted: false,
    });

    await update(ref(getDb(), `rooms/${roomId}/presence/${hostUid}`), {
      online: false,
      lastSeen: Date.now() - 61_000,
    });

    expect(await claimHost(roomId, bruno.uid, hostUid, bruno.db)).toBe(true);

    const { status, body } = await restGet(`rooms/${roomId}/meta`, await authToken());
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).hostId).toBe(bruno.uid);

    expect(await claimHost(roomId, bruno.uid, hostUid, bruno.db)).toBe(false);
  });

  it("presença offline há mais de 5 min sem voto sai da lista", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const bruno = await peer();

    await update(ref(bruno.db, `rooms/${roomId}/presence/${bruno.uid}`), {
      name: "Bruno",
      color: "#5B8FD9",
      online: false,
      lastSeen: Date.now() - 400_000,
      joinedAt: Date.now() - 500_000,
      hasVoted: false,
    });

    const { result, unmount } = renderHook(() => useFirebaseRoom(roomId));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await waitFor(() => expect(result.current.state.participants).toHaveLength(1));
    expect(result.current.state.participants[0]?.name).toBe("Ana");

    const now = Date.now();
    await update(ref(bruno.db, `rooms/${roomId}/votes/${bruno.uid}`), { value: "5", at: now });
    await update(ref(bruno.db, `rooms/${roomId}/presence/${bruno.uid}`), {
      name: "Bruno",
      color: "#5B8FD9",
      online: true,
      lastSeen: now,
      joinedAt: now - 500_000,
      hasVoted: true,
    });

    await waitFor(() => expect(result.current.state.participants).toHaveLength(2));

    unmount();
  });

  it("host apaga presença obsoleta de terceiro ao carregar a sala", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const bruno = await peer();

    await update(ref(bruno.db, `rooms/${roomId}/presence/${bruno.uid}`), {
      name: "Bruno",
      color: "#5B8FD9",
      online: false,
      lastSeen: Date.now() - 400_000,
      joinedAt: Date.now() - 500_000,
      hasVoted: false,
    });
    await update(ref(bruno.db, `rooms/${roomId}/votes/${bruno.uid}`), { value: "5", at: Date.now() });

    const { result, unmount } = renderHook(() => useFirebaseRoom(roomId));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await waitFor(async () => {
      const presence = await presenceMap(roomId);
      expect(Object.keys(presence)).toEqual([currentUid()]);
    });

    const vote = await adminGet(`rooms/${roomId}/votes/${bruno.uid}`);
    expect(vote.body).toBeNull();

    unmount();
  });

  it("não poda presença recente nem a própria presença do host", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const bruno = await peer();
    const recent = Date.now();

    await update(ref(bruno.db, `rooms/${roomId}/presence/${bruno.uid}`), {
      name: "Bruno",
      color: "#5B8FD9",
      online: false,
      lastSeen: recent,
      joinedAt: recent,
      hasVoted: false,
    });

    const { result, unmount } = renderHook(() => useFirebaseRoom(roomId));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await new Promise((resolve) => setTimeout(resolve, 500));

    const presence = await presenceMap(roomId);
    expect(Object.keys(presence)).toHaveLength(2);
    expect(presence[currentUid()]).toBeTruthy();

    unmount();
  });

  it("poda a presença mesmo quando a regra nega o voto órfão", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const bruno = await peer();
    const stale = Date.now() - 400_000;

    await update(ref(bruno.db, `rooms/${roomId}/presence/${bruno.uid}`), {
      name: "Bruno",
      color: "#5B8FD9",
      online: false,
      lastSeen: stale,
      joinedAt: stale - 100_000,
      hasVoted: false,
    });
    // Voto órfão: sem `hasVoted: false` na presença, a regra não libera a deleção.
    await adminWrite(`rooms/${roomId}/votes/${bruno.uid}`, { value: "5", at: Date.now() });

    const { result, unmount } = renderHook(() => useFirebaseRoom(roomId));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    // A presença sai mesmo com o voto negado; o voto órfão é apagado pelo host após a poda.
    await waitFor(async () => {
      const presence = await presenceMap(roomId);
      expect(Object.keys(presence)).toEqual([currentUid()]);
      const vote = await adminGet(`rooms/${roomId}/votes/${bruno.uid}`);
      expect(vote.body).toBeNull();
    });

    unmount();
  });

  it("volta a entrar sozinho quando a presença é podada durante uma queda de rede", async () => {
    const host = await peer();
    const roomId = await seedRoomAs(host);
    localStorage.setItem("pp:name", "Ana");

    const { result, unmount } = renderHook(() => useFirebaseRoom(roomId));

    try {
      await waitFor(() => expect(result.current.state.status).toBe("ready"));
      await waitFor(async () => {
        const presence = await presenceMap(roomId);
        expect(presence[currentUid()]).toBeTruthy();
      });

      goOffline(getDb());
      await adminErase(`rooms/${roomId}/presence/${currentUid()}`);
      goOnline(getDb());

      await waitFor(
        async () => {
          const presence = await presenceMap(roomId);
          expect(presence[currentUid()]).toBeTruthy();
        },
        { timeout: 15_000 },
      );
    } finally {
      unmount();
      localStorage.removeItem("pp:name");
    }
  });
});
