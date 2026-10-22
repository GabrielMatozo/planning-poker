import { describe, expect, it } from "vitest";
import { deriveHistory, deriveParticipants, deriveStats, shouldAutoReveal, shouldClaimHost, voteValues } from "./derive";
import type { MetaRecord, PresenceMap, VoteMap } from "./derive";
import type { Participant } from "../../types/room";

const NOW = 1_700_000_000_000;

function presence(overrides: Partial<PresenceMap[string]> = {}): PresenceMap[string] {
  return {
    name: "Ana",
    color: "#D9A05B",
    online: true,
    lastSeen: NOW - 2_000,
    joinedAt: 1,
    hasVoted: false,
    ...overrides,
  };
}

function meta(overrides: Partial<MetaRecord> = {}): MetaRecord {
  return { name: "Sprint", hostId: "a", revealed: false, round: 1, autoReveal: false, ...overrides };
}

function participant(overrides: Partial<Participant> = {}): Participant {
  return {
    uid: "a",
    name: "Ana",
    color: "#D9A05B",
    online: true,
    lastSeen: NOW - 2_000,
    joinedAt: 1,
    hasVoted: false,
    vote: null,
    ...overrides,
  };
}

describe("deriveParticipants", () => {
  it("não expõe o voto dos outros antes do reveal", () => {
    const participants = deriveParticipants({
      presence: { a: presence(), b: presence({ name: "Bruno", hasVoted: true }) },
      votes: { b: { value: "8", at: NOW } },
      revealed: false,
      meUid: "a",
      myVote: "3",
      now: NOW,
    });

    const bruno = participants.find((item) => item.uid === "b");
    expect(bruno?.vote).toBeNull();
    expect(bruno?.hasVoted).toBe(true);

    const ana = participants.find((item) => item.uid === "a");
    expect(ana?.vote).toBe("3");
  });

  it("expõe o voto de todos depois do reveal", () => {
    const participants = deriveParticipants({
      presence: { a: presence(), b: presence({ name: "Bruno", hasVoted: true }) },
      votes: { a: { value: "3", at: NOW }, b: { value: "8", at: NOW } },
      revealed: true,
      meUid: "a",
      myVote: "3",
      now: NOW,
    });

    expect(participants.map((item) => item.vote).sort()).toEqual(["3", "8"]);
  });

  it("marca online pela janela de lastSeen", () => {
    const participants = deriveParticipants({
      presence: { a: presence({ online: false, lastSeen: NOW - 61_000 }) },
      votes: {},
      revealed: false,
      meUid: "a",
      myVote: null,
      now: NOW,
    });

    expect(participants[0]?.online).toBe(false);
  });

  it("remove quem está offline há mais de 5 min sem voto, mas mantém quem votou", () => {
    const participants = deriveParticipants({
      presence: {
        a: presence(),
        b: presence({ name: "Bruno", online: false, lastSeen: NOW - 400_000 }),
        c: presence({ name: "Carla", online: false, lastSeen: NOW - 400_000, hasVoted: true }),
      },
      votes: {},
      revealed: false,
      meUid: "a",
      myVote: null,
      now: NOW,
    });

    expect(participants.map((item) => item.uid).sort()).toEqual(["a", "c"]);
  });

  it("nunca remove a própria presença", () => {
    const participants = deriveParticipants({
      presence: { a: presence({ online: false, lastSeen: NOW - 400_000 }) },
      votes: {},
      revealed: false,
      meUid: "a",
      myVote: null,
      now: NOW,
    });

    expect(participants).toHaveLength(1);
  });

  it("ignora presença malformada", () => {
    const participants = deriveParticipants({
      presence: { quebrado: { name: 42 } as unknown as PresenceMap[string] },
      votes: {},
      revealed: false,
      meUid: null,
      myVote: null,
      now: NOW,
    });

    expect(participants).toEqual([]);
  });
});

describe("deriveStats", () => {
  it("devolve null antes do reveal", () => {
    expect(deriveStats({ a: { value: "5", at: NOW } }, false)).toBeNull();
  });

  it("calcula a partir dos votos gravados depois do reveal", () => {
    const stats = deriveStats({ a: { value: "3", at: NOW }, b: { value: "5", at: NOW } }, true);

    expect(stats?.average).toBe(4);
    expect(stats?.median).toBe(4);
    expect(stats?.consensus).toBe(false);
  });

  it("ignora símbolos na média e devolve nulo sem votos", () => {
    expect(deriveStats({ a: { value: "?", at: NOW } }, true)?.average).toBeNull();
    expect(deriveStats({}, true)?.average).toBeNull();
  });
});

describe("voteValues", () => {
  it("descarta valores fora do deck", () => {
    const votes: VoteMap = { a: { value: "5", at: NOW }, b: { value: "4", at: NOW } };

    expect(voteValues(votes)).toEqual(["5"]);
  });
});

describe("deriveHistory", () => {
  it("devolve lista vazia sem histórico", () => {
    expect(deriveHistory(undefined)).toEqual([]);
    expect(deriveHistory(null)).toEqual([]);
    expect(deriveHistory({})).toEqual([]);
  });

  it("descarta chave que não seja inteiro positivo", () => {
    expect(deriveHistory({ abc: 3, "0": 5, "02": 4, "-1": 2, "1.5": 7, "1": 1 })).toEqual([
      { round: 1, average: 1 },
    ]);
  });

  it("descarta valor que não seja número finito", () => {
    expect(
      deriveHistory({ "1": "3", "2": null, "3": Number.NaN, "4": Number.POSITIVE_INFINITY, "5": 5 }),
    ).toEqual([{ round: 5, average: 5 }]);
  });

  it("ordena por rodada", () => {
    expect(deriveHistory({ "10": 2.5, "2": 8, "1": 3 })).toEqual([
      { round: 1, average: 3 },
      { round: 2, average: 8 },
      { round: 10, average: 2.5 },
    ]);
  });
});

describe("shouldAutoReveal", () => {
  it("revela quando todos os online votaram", () => {
    const participants = [participant({ uid: "a", hasVoted: true }), participant({ uid: "b", hasVoted: true })];

    expect(shouldAutoReveal({ meta: meta({ autoReveal: true }), participants, meUid: "a", firedRound: null })).toBe(
      true,
    );
  });

  it("não revela se alguém online ainda não votou", () => {
    const participants = [participant({ uid: "a", hasVoted: true }), participant({ uid: "b", hasVoted: false })];

    expect(shouldAutoReveal({ meta: meta({ autoReveal: true }), participants, meUid: "a", firedRound: null })).toBe(
      false,
    );
  });

  it("ignora participantes offline", () => {
    const participants = [participant({ uid: "a", hasVoted: true }), participant({ uid: "b", online: false })];

    expect(shouldAutoReveal({ meta: meta({ autoReveal: true }), participants, meUid: "a", firedRound: null })).toBe(
      true,
    );
  });

  it("só o host dispara", () => {
    const participants = [participant({ uid: "a", hasVoted: true })];

    expect(shouldAutoReveal({ meta: meta({ autoReveal: true }), participants, meUid: "b", firedRound: null })).toBe(
      false,
    );
  });

  it("não dispara duas vezes na mesma rodada nem depois do reveal", () => {
    const participants = [participant({ uid: "a", hasVoted: true })];

    expect(shouldAutoReveal({ meta: meta({ autoReveal: true }), participants, meUid: "a", firedRound: 1 })).toBe(
      false,
    );
    expect(
      shouldAutoReveal({ meta: meta({ autoReveal: true, revealed: true }), participants, meUid: "a", firedRound: null }),
    ).toBe(false);
    expect(
      shouldAutoReveal({ meta: meta({ autoReveal: false }), participants, meUid: "a", firedRound: null }),
    ).toBe(false);
  });

  it("não dispara sem ninguém online", () => {
    const participants = [participant({ uid: "a", online: false, hasVoted: false })];

    expect(shouldAutoReveal({ meta: meta({ autoReveal: true }), participants, meUid: "a", firedRound: null })).toBe(
      false,
    );
  });
});

describe("shouldClaimHost", () => {
  const presenceMap: PresenceMap = {
    host: presence({ name: "Host", online: false, lastSeen: NOW - 61_000, joinedAt: 1 }),
    a: presence({ name: "Ana", joinedAt: 5, lastSeen: NOW - 1_000 }),
    b: presence({ name: "Bruno", joinedAt: 9, lastSeen: NOW - 1_000 }),
  };

  it("assume quando o host passou da janela e sou o online mais antigo", () => {
    expect(shouldClaimHost({ meta: meta({ hostId: "host" }), presence: presenceMap, meUid: "a", now: NOW })).toBe(
      true,
    );
    expect(shouldClaimHost({ meta: meta({ hostId: "host" }), presence: presenceMap, meUid: "b", now: NOW })).toBe(
      false,
    );
  });

  it("não assume enquanto o host está online", () => {
    const online = { ...presenceMap, host: presence({ name: "Host", lastSeen: NOW - 1_000, joinedAt: 1 }) };

    expect(shouldClaimHost({ meta: meta({ hostId: "host" }), presence: online, meUid: "a", now: NOW })).toBe(false);
  });

  it("não assume se já é o host", () => {
    expect(shouldClaimHost({ meta: meta({ hostId: "a" }), presence: presenceMap, meUid: "a", now: NOW })).toBe(false);
  });

  it("não assume se estou offline", () => {
    const offlineMe = {
      ...presenceMap,
      a: presence({ name: "Ana", joinedAt: 5, online: false, lastSeen: NOW - 90_000 }),
    };

    expect(shouldClaimHost({ meta: meta({ hostId: "host" }), presence: offlineMe, meUid: "a", now: NOW })).toBe(false);
  });

  it("assume quando o host sumiu da presença", () => {
    const withoutHost = { a: presenceMap.a } as PresenceMap;

    expect(shouldClaimHost({ meta: meta({ hostId: "host" }), presence: withoutHost, meUid: "a", now: NOW })).toBe(true);
  });
});
