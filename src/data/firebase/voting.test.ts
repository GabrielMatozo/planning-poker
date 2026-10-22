import { beforeAll, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { get, ref } from "@firebase/database";
import type { CardValue } from "../../types/room";
import { getDb } from "./client";
import { createRoom, useFirebaseRoom } from "./room-provider";
import { EMULATOR_ENABLED, adminGet } from "../../test/emulator";

// Cada teste abre sala própria; o limiter de criação é por minuto e não tem o que medir aqui.
beforeAll(() => {
  vi.stubEnv("VITE_QUOTA_DISABLED", "1");
});

async function openRoom() {
  const roomId = await createRoom("Sprint 42", "Ana");
  const hook = renderHook(() => useFirebaseRoom(roomId));

  await waitFor(() => expect(hook.result.current.state.status).toBe("ready"));

  return { roomId, ...hook };
}

describe.skipIf(!EMULATOR_ENABLED)("votação (emulador)", () => {
  it("voto do próprio usuário aparece em myVote e hasVoted", async () => {
    const { roomId, result, unmount } = await openRoom();
    const uid = result.current.state.me?.uid ?? "";

    await act(async () => {
      await result.current.actions.vote("5");
    });

    await waitFor(() => expect(result.current.state.myVote).toBe("5"));

    const own = result.current.state.participants.find((item) => item.uid === uid);
    expect(own?.hasVoted).toBe(true);

    const vote = (await get(ref(getDb(), `rooms/${roomId}/votes/${uid}`))).val();
    const ownPresence = (await get(ref(getDb(), `rooms/${roomId}/presence/${uid}`))).val();

    expect(vote.value).toBe("5");
    expect(typeof vote.at).toBe("number");
    expect(ownPresence.hasVoted).toBe(true);

    unmount();
  });

  it("trocar o voto sobrescreve o anterior", async () => {
    const { roomId, result, unmount } = await openRoom();
    const uid = result.current.state.me?.uid ?? "";

    await act(async () => {
      await result.current.actions.vote("5");
    });
    await act(async () => {
      await result.current.actions.vote("8");
    });

    await waitFor(() => expect(result.current.state.myVote).toBe("8"));

    const vote = (await get(ref(getDb(), `rooms/${roomId}/votes/${uid}`))).val();
    expect(vote.value).toBe("8");

    unmount();
  });

  it("recusa carta fora do deck", async () => {
    const { result, unmount } = await openRoom();

    await expect(result.current.actions.vote("4" as CardValue)).rejects.toThrow();

    unmount();
  });

  it("reveal publica stats e trava novos votos no cliente", async () => {
    const { result, unmount } = await openRoom();

    await act(async () => {
      await result.current.actions.vote("3");
    });

    await act(async () => {
      await result.current.actions.reveal();
    });

    await waitFor(() => expect(result.current.state.meta?.revealed).toBe(true));
    await waitFor(() => expect(result.current.state.stats?.average).toBe(3));

    expect(result.current.state.stats?.median).toBe(3);
    await waitFor(() => expect(result.current.state.history).toEqual([{ round: 1, average: 3 }]));

    await expect(result.current.actions.vote("5")).rejects.toThrow();

    unmount();
  });

  it("newRound limpa votos, incrementa round e mantém presença", async () => {
    const { roomId, result, unmount } = await openRoom();
    const uid = result.current.state.me?.uid ?? "";

    await act(async () => {
      await result.current.actions.vote("8");
    });
    await act(async () => {
      await result.current.actions.reveal();
    });
    await waitFor(() => expect(result.current.state.meta?.revealed).toBe(true));

    await act(async () => {
      await result.current.actions.newRound();
    });

    await waitFor(() => expect(result.current.state.meta?.round).toBe(2));
    await waitFor(() => expect(result.current.state.meta?.revealed).toBe(false));
    await waitFor(() => expect(result.current.state.myVote).toBeNull());

    expect(result.current.state.participants).toHaveLength(1);
    expect(result.current.state.participants[0]?.hasVoted).toBe(false);
    expect(result.current.state.stats).toBeNull();

    const vote = (await get(ref(getDb(), `rooms/${roomId}/votes/${uid}`))).val();
    const presence = (await get(ref(getDb(), `rooms/${roomId}/presence/${uid}`))).val();

    expect(vote).toBeNull();
    expect(presence.name).toBe("Ana");
    expect(presence.hasVoted).toBe(false);

    unmount();
  });

  it("volta a aceitar voto depois da nova rodada", async () => {
    const { result, unmount } = await openRoom();

    await act(async () => {
      await result.current.actions.vote("5");
    });
    await act(async () => {
      await result.current.actions.reveal();
    });
    await act(async () => {
      await result.current.actions.newRound();
    });

    await waitFor(() => expect(result.current.state.meta?.revealed).toBe(false));

    await act(async () => {
      await result.current.actions.vote("13");
    });

    await waitFor(() => expect(result.current.state.myVote).toBe("13"));

    unmount();
  });

  it("autoReveal dispara uma única vez quando todos votaram", async () => {
    const { result, unmount } = await openRoom();

    await act(async () => {
      await result.current.actions.setAutoReveal(true);
    });
    await waitFor(() => expect(result.current.state.meta?.autoReveal).toBe(true));

    await act(async () => {
      await result.current.actions.vote("5");
    });

    await waitFor(() => expect(result.current.state.meta?.revealed).toBe(true));
    await waitFor(() => expect(result.current.state.stats?.average).toBe(5));

    expect(result.current.state.meta?.round).toBe(1);
    await waitFor(() => expect(result.current.state.history).toEqual([{ round: 1, average: 5 }]));

    unmount();
  });

  it("grava a média no banco e uma sessão nova lê o mesmo histórico", async () => {
    const { roomId, result, unmount } = await openRoom();

    await act(async () => {
      await result.current.actions.vote("5");
    });
    await act(async () => {
      await result.current.actions.reveal();
    });

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await waitFor(() => expect(result.current.state.history).toEqual([{ round: 1, average: 5 }]));

    const stored = await adminGet(`rooms/${roomId}/meta/history/1`);
    expect(stored.body).toBe(5);

    unmount();

    // Reabre a sala em outro cliente: o histórico vem do banco, não de estado local.
    const reloaded = renderHook(() => useFirebaseRoom(roomId));
    await waitFor(() => expect(reloaded.result.current.state.status).toBe("ready"));
    await waitFor(() => expect(reloaded.result.current.state.history).toEqual([{ round: 1, average: 5 }]));

    reloaded.unmount();
  });

  it("acumula uma entrada por rodada, sem duplicar", async () => {
    const { roomId, result, unmount } = await openRoom();

    await act(async () => {
      await result.current.actions.vote("5");
    });
    await act(async () => {
      await result.current.actions.reveal();
    });
    await waitFor(() => expect(result.current.state.history).toEqual([{ round: 1, average: 5 }]));

    await act(async () => {
      await result.current.actions.newRound();
    });
    await waitFor(() => expect(result.current.state.meta?.round).toBe(2));

    await act(async () => {
      await result.current.actions.vote("8");
    });
    await act(async () => {
      await result.current.actions.reveal();
    });

    await waitFor(() =>
      expect(result.current.state.history).toEqual([
        { round: 1, average: 5 },
        { round: 2, average: 8 },
      ]),
    );

    const first = await adminGet(`rooms/${roomId}/meta/history/1`);
    const second = await adminGet(`rooms/${roomId}/meta/history/2`);
    expect(first.body).toBe(5);
    expect(second.body).toBe(8);

    unmount();
  });
});
