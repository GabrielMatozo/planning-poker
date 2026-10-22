import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { get, ref } from "@firebase/database";
import { getAuthInstance, getDb } from "./client";
import {
  RoomNotFoundError,
  castVote,
  createRoom,
  joinRoom,
  loadNameLocally,
  saveNameLocally,
  useFirebaseRoom,
} from "./room-provider";
import { colorFromUid, newRoomCode, normalizeName, normalizeRoomId } from "../../lib/ids";
import { EMULATOR_ENABLED, adminErase, adminGet } from "../../test/emulator";

// Cada teste abre sala própria; o limiter de criação é por minuto e não tem o que medir aqui.
beforeAll(() => {
  vi.stubEnv("VITE_QUOTA_DISABLED", "1");
});

describe("código de sala", () => {
  it("gera 6 chars do alfabeto permitido", () => {
    for (let i = 0; i < 200; i++) {
      expect(newRoomCode()).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/);
    }
  });

  it("normaliza código digitado para minúsculas", () => {
    expect(normalizeRoomId("  ABCDEF ")).toBe("abcdef");
  });

  it("rejeita código com tamanho ou caractere inválido", () => {
    expect(() => normalizeRoomId("abc")).toThrow();
    expect(() => normalizeRoomId("abcdefg")).toThrow();
    expect(() => normalizeRoomId("abcdei")).toThrow();
  });
});

describe("nome", () => {
  it("normaliza nome com trim e corta em 40", () => {
    expect(normalizeName("  Ana  ")).toBe("Ana");
    expect(normalizeName("x".repeat(60)).length).toBe(40);
    expect(() => normalizeName("   ")).toThrow();
  });

  it("guarda e lê o nome do dispositivo", () => {
    saveNameLocally("  Bruno ");
    expect(loadNameLocally()).toBe("Bruno");
    expect(localStorage.getItem("pp:name")).toBe("Bruno");
  });
});

describe("cor do avatar", () => {
  it("é estável por uid", () => {
    expect(colorFromUid("abc")).toBe(colorFromUid("abc"));
  });

  it("espalha uids diferentes", () => {
    const colors = new Set(Array.from({ length: 20 }, (_, index) => colorFromUid(`uid-${index}`)));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe.skipIf(!EMULATOR_ENABLED)("criar e entrar em sala (emulador)", () => {
  it("criar sala grava meta, host e presença", async () => {
    const roomId = await createRoom("Sprint 42", "  Ana  ");
    const meta = (await get(ref(getDb(), `rooms/${roomId}/meta`))).val();
    const presence = (await get(ref(getDb(), `rooms/${roomId}/presence`))).val();
    const entries = Object.values(presence) as Array<Record<string, unknown>>;

    expect(meta.name).toBe("Sprint 42");
    expect(meta.revealed).toBe(false);
    expect(meta.round).toBe(1);
    expect(meta.autoReveal).toBe(false);
    expect(meta.hostId).toMatch(/^\w+$/);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe("Ana");
    expect(entries[0]?.online).toBe(true);
    expect(entries[0]?.hasVoted).toBe(false);
    expect(typeof entries[0]?.joinedAt).toBe("number");
  });

  it("criar sala recusa nome vazio", async () => {
    await expect(createRoom("   ", "Ana")).rejects.toThrow();
    await expect(createRoom("Sprint", "   ")).rejects.toThrow();
  });

  it("criar sala recusa nome com caractere invisível", async () => {
    await expect(createRoom("Sprint", "Ana\u202E")).rejects.toThrow(/caracteres invisíveis/);
    await expect(createRoom("Sprint\u200B", "Ana")).rejects.toThrow(/caracteres invisíveis/);
    await expect(createRoom("Sprint", "Ana\u0007")).rejects.toThrow(/caracteres invisíveis/);
  });

  it("entrar recusa nome com caractere invisível antes de tocar o banco", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");

    await expect(joinRoom(roomId, "Bruno\u2060")).rejects.toThrow(/caracteres invisíveis/);
  });

  it("criar salas seguidas gera códigos diferentes", async () => {
    const first = await createRoom("Sprint 1", "Ana");
    const second = await createRoom("Sprint 2", "Ana");

    expect(first).not.toBe(second);
  });

  it("entrar de novo atualiza o nome e mantém online", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    await joinRoom(roomId, "  Bruno  ");

    const presence = (await get(ref(getDb(), `rooms/${roomId}/presence`))).val();
    const entries = Object.values(presence) as Array<Record<string, unknown>>;

    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe("Bruno");
    expect(entries[0]?.online).toBe(true);
  });

  it("reentrar depois de refresh mantém uma única entrada e o mesmo joinedAt", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const before = (await get(ref(getDb(), `rooms/${roomId}/presence`))).val();

    await joinRoom(roomId, "Ana");

    const after = (await get(ref(getDb(), `rooms/${roomId}/presence`))).val();
    const beforeEntry = Object.values(before)[0] as Record<string, unknown>;
    const afterEntry = Object.values(after)[0] as Record<string, unknown>;

    expect(Object.keys(after)).toHaveLength(1);
    expect(afterEntry.joinedAt).toBe(beforeEntry.joinedAt);
    expect(afterEntry.name).toBe("Ana");
  });

  it("sala inexistente rejeita a entrada", async () => {
    await expect(joinRoom("zzzzzz", "Ana")).rejects.toBeInstanceOf(RoomNotFoundError);
  });

  it("código inválido rejeita antes de tocar o banco", async () => {
    await expect(joinRoom("ABC", "Ana")).rejects.toThrow();
  });

  it("hidrata o estado da sala a partir do banco", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const { result, unmount } = renderHook(() => useFirebaseRoom(roomId));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(result.current.state.meta?.name).toBe("Sprint 42");
    expect(result.current.state.meta?.round).toBe(1);
    expect(result.current.state.me?.name).toBe("Ana");
    expect(result.current.state.participants).toHaveLength(1);
    expect(result.current.state.participants[0]?.online).toBe(true);

    unmount();
  });

  it("sala inexistente resulta em not-found sem quebrar", async () => {
    const { result, unmount } = renderHook(() => useFirebaseRoom("zzzzzz"));

    await waitFor(() => expect(result.current.state.status).toBe("not-found"));

    expect(result.current.state.meta).toBeNull();
    expect(result.current.state.participants).toEqual([]);

    unmount();
  });

  it("votar sem presença avisa e não deixa voto órfão", async () => {
    const roomId = await createRoom("Sprint 42", "Ana");
    const uid = getAuthInstance().currentUser?.uid;
    expect(uid).toBeTruthy();

    await adminErase(`rooms/${roomId}/presence/${uid}`);

    await expect(castVote(roomId, uid as string, "5")).rejects.toThrow(/presença saiu da sala/);

    const vote = await adminGet(`rooms/${roomId}/votes/${uid}`);
    expect(vote.body).toBeNull();
  });
});
