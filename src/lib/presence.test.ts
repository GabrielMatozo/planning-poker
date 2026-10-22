import { describe, it, expect } from "vitest";
import type { Participant } from "../types/room";
import { ONLINE_WINDOW_MS, REMOVABLE_AFTER_MS, isOnline, isRemovable, pickNextHost } from "./presence";

function person(overrides: Partial<Participant>): Participant {
  return {
    uid: "u1",
    name: "Ana",
    color: "#D9A05B",
    online: true,
    lastSeen: 1_000,
    joinedAt: 1,
    hasVoted: false,
    vote: null,
    ...overrides,
  };
}

describe("isOnline", () => {
  it("considera online dentro de 60s mesmo com flag desatualizada", () => {
    expect(isOnline({ online: false, lastSeen: 1_000 }, 61_000)).toBe(true);
    expect(isOnline({ online: false, lastSeen: 1_000 }, 61_001)).toBe(false);
  });

  it("flag online true não segura a presença depois da janela", () => {
    expect(isOnline({ online: true, lastSeen: 0 }, 999_999)).toBe(false);
  });

  it("lastSeen nulo conta como offline", () => {
    expect(isOnline({ online: true, lastSeen: null }, 999_999)).toBe(false);
  });

  it("aceita lastSeen no futuro (relógio adiantado)", () => {
    expect(isOnline({ online: true, lastSeen: 10_000 }, 9_000)).toBe(true);
  });

  it("usa janela de 60s", () => {
    expect(ONLINE_WINDOW_MS).toBe(60_000);
  });
});

describe("pickNextHost", () => {
  it("escolhe o membro online mais antigo que não seja o host atual", () => {
    const now = 1_700_000_000_000;
    const participants = [
      person({ uid: "a", joinedAt: 10, lastSeen: now - 5_000 }),
      person({ uid: "b", joinedAt: 5, lastSeen: now - 5_000 }),
      person({ uid: "c", online: false, joinedAt: 1, lastSeen: now - 120_000 }),
    ];

    expect(pickNextHost(participants, now, "z")).toBe("b");
  });

  it("ignora o host atual mesmo que ele seja o mais antigo", () => {
    const participants = [person({ uid: "host", joinedAt: 1 }), person({ uid: "b", joinedAt: 5 })];

    expect(pickNextHost(participants, 2_000, "host")).toBe("b");
  });

  it("sem ninguém online devolve null", () => {
    expect(pickNextHost([person({ uid: "a", online: false })], 999_999, "z")).toBeNull();
  });

  it("só o host online devolve null", () => {
    expect(pickNextHost([person({ uid: "host", joinedAt: 1 })], 2_000, "host")).toBeNull();
  });

  it("desempata por uid quando joinedAt coincide", () => {
    const participants = [person({ uid: "z", joinedAt: 7 }), person({ uid: "a", joinedAt: 7 })];

    expect(pickNextHost(participants, 2_000, "host")).toBe("a");
  });
});

describe("isRemovable", () => {
  it("só remove quem está offline há 5 min e não votou", () => {
    expect(isRemovable(person({ online: false, lastSeen: 0, hasVoted: false }), 300_001)).toBe(true);
    expect(isRemovable(person({ online: false, lastSeen: 0, hasVoted: true }), 300_001)).toBe(false);
  });

  it("não remove quem sumiu há menos de 5 min", () => {
    expect(isRemovable(person({ online: false, lastSeen: 240_000 }), 300_000)).toBe(false);
  });

  it("não remove quem ainda está online pela janela de heartbeat", () => {
    expect(isRemovable(person({ online: false, lastSeen: 299_000 }), 300_001)).toBe(false);
  });

  it("usa limite de 5 min", () => {
    expect(REMOVABLE_AFTER_MS).toBe(300_000);
  });
});
