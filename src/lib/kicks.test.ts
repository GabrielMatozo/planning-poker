import { describe, expect, it, afterEach } from "vitest";
import {
  COOLDOWN_MS,
  getKickRecord,
  isKicked,
  recordKick,
  remainingKickMs,
  pruneKicks,
} from "./kicks";

afterEach(() => {
  localStorage.removeItem("pp:kicks");
});

describe("kicks", () => {
  it("não considera ninguém bloqueado sem registro", () => {
    expect(isKicked("João")).toBe(false);
    expect(remainingKickMs("João")).toBe(0);
    expect(getKickRecord("João")).toBeNull();
  });

  it("regista expulsão e bloqueia o nome", () => {
    recordKick("João", "abc123", "Sprint 42");
    expect(isKicked("João")).toBe(true);
    expect(remainingKickMs("João")).toBeGreaterThan(0);
    expect(getKickRecord("João")?.name).toBe("João");
    expect(getKickRecord("João")?.roomId).toBe("abc123");
    expect(getKickRecord("João")?.roomName).toBe("Sprint 42");
  });

  it("pruneKicks remove registros antigos", () => {
    // Simula registro velho manipulando o localStorage diretamente
    const oldKick = {
      name: "João",
      roomId: "abc123",
      roomName: "Sprint 42",
      kickedAt: Date.now() - COOLDOWN_MS - 1000,
    };
    localStorage.setItem("pp:kicks", JSON.stringify([oldKick]));
    pruneKicks();
    expect(isKicked("João")).toBe(false);
  });

  it("pruneKicks preserva registro recente", () => {
    recordKick("Ana", "xyz", "Teste");
    pruneKicks();
    expect(isKicked("Ana")).toBe(true);
  });
});
