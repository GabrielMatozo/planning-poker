import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { MockRoomProvider } from "./mock-provider";
import { useRoom } from "../../app/room-context";
import type { Participant, RoomState } from "../../types/room";

/**
 * BroadcastChannel não existe no jsdom: cada provider mock se conecta a um
 * transport e troca mensagens com as outras instâncias no teste.
 */
class TestBroadcastChannel {
  static readonly instances: TestBroadcastChannel[] = [];
  readonly name: string;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(name: string) {
    this.name = name;
    TestBroadcastChannel.instances.push(this);
  }
  static reset(): void {
    this.instances.length = 0;
  }
  postMessage(data: unknown): void {
    for (const peer of TestBroadcastChannel.instances) {
      if (peer !== this && peer.name === this.name) {
        peer.onmessage?.({ data });
      }
    }
  }
  close(): void {
    const index = TestBroadcastChannel.instances.indexOf(this);
    if (index >= 0) TestBroadcastChannel.instances.splice(index, 1);
  }
}

beforeEach(() => {
  TestBroadcastChannel.reset();
  window.localStorage.clear();
  // Força o BroadcastChannel no jsdom (não existe por padrão)
  global.BroadcastChannel = TestBroadcastChannel as any;
});

afterEach(() => {
  // Remove o BroadcastChannel global para não afetar outros testes
  delete (global as any).BroadcastChannel;
});

function setup(initial?: Partial<RoomState>, roomId?: string) {
  return renderHook(() => useRoom(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MockRoomProvider roomId={roomId} initial={initial}>
        {children}
      </MockRoomProvider>
    ),
  });
}

function participant(overrides: Partial<Participant>): Participant {
  return {
    uid: "u1",
    name: "Ana",
    color: "#D9A05B",
    online: true,
    lastSeen: 1_700_000_000_000,
    joinedAt: 1,
    hasVoted: false,
    vote: null,
    ...overrides,
  };
}

describe("provider mock", () => {
  it("grava o voto do usuário atual", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.actions.vote("5");
    });

    expect(result.current.state.myVote).toBe("5");
    expect(result.current.state.participants[0]?.hasVoted).toBe(true);
  });

  it("revela e publica média da rodada", async () => {
    const { result } = setup({
      participants: [participant({ uid: "u1", vote: "3", hasVoted: true }), participant({ uid: "u2", vote: "5", hasVoted: true })],
    });

    await act(async () => {
      await result.current.actions.reveal();
    });

    expect(result.current.state.meta?.revealed).toBe(true);
    expect(result.current.state.stats?.average).toBe(4);
    expect(result.current.state.history).toEqual([{ round: 1, average: 4 }]);
  });

  it("nova rodada limpa votos e mantém participantes", async () => {
    const { result } = setup({ participants: [participant({ uid: "u1", vote: "8", hasVoted: true })] });

    await act(async () => {
      await result.current.actions.newRound();
    });

    expect(result.current.state.meta?.round).toBe(2);
    expect(result.current.state.meta?.revealed).toBe(false);
    expect(result.current.state.myVote).toBeNull();
    expect(result.current.state.participants).toHaveLength(1);
    expect(result.current.state.participants[0]?.hasVoted).toBe(false);
  });

  it("recusa voto depois do reveal", async () => {
    const { result } = setup({ meta: { id: "mock01", name: "Sprint 42", hostId: "mock-ana", revealed: true, round: 1, autoReveal: false } });

    await expect(result.current.actions.vote("5")).rejects.toThrow();
  });

  it("revela sozinho quando todos votaram e autoReveal está ligado", async () => {
    const { result } = setup({
      meta: { id: "mock01", name: "Sprint 42", hostId: "mock-ana", revealed: false, round: 1, autoReveal: true },
      participants: [participant({ uid: "mock-ana" })],
    });

    await act(async () => {
      await result.current.actions.vote("13");
    });

    expect(result.current.state.meta?.revealed).toBe(true);
    expect(result.current.state.stats?.average).toBe(13);
  });

  it("dois providers do mesmo roomId enxergam os participantes uns dos outros", async () => {
    const first = setup(undefined, "abc123");
    const second = setup(undefined, "abc123");

    // Espera os effects de sync executarem (onShared, requestState)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await act(async () => {
      await second.result.current?.actions.join("Bruno");
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await act(async () => {
      await first.result.current?.actions.join("Ana");
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(first.result.current?.state.participants.map((p) => p.name)).toContain("Ana");
    expect(first.result.current?.state.participants.map((p) => p.name)).toContain("Bruno");
    expect(second.result.current?.state.participants.map((p) => p.name)).toContain("Ana");
    expect(second.result.current?.state.participants.map((p) => p.name)).toContain("Bruno");
    expect(second.result.current?.state.myVote).toBeNull();
  });

  it("um provider sem roomId não se mistura com providers com roomId", async () => {
    TestBroadcastChannel.reset();
    const solo = setup(undefined, undefined);
    const first = setup(undefined, "abc123");

    await act(async () => {
      await first.result.current?.actions.join("Ana");
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(solo.result.current?.state.participants.map((p) => p.name)).toEqual(["Ana"]);
    expect(first.result.current?.state.participants.map((p) => p.name)).toEqual(["Ana"]);
  });

  it("kick remove o alvo da presença de todos os providers da sala", async () => {
    TestBroadcastChannel.reset();
    const host = setup({ meta: { id: "abc123", name: "Sprint 42", hostId: "mock-ana", revealed: false, round: 1, autoReveal: false } }, "abc123");
    const guest = setup(undefined, "abc123");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      await guest.result.current?.actions.join("Bruno");
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const guestUid = guest.result.current?.state.participants.find((p) => p.name === "Bruno")?.uid;
    expect(guestUid).toBeTruthy();

    await act(async () => {
      await host.result.current?.actions.kick(guestUid as string);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    console.log("[KICK TEST] After kick:", {
      hostParticipants: host.result.current?.state.participants.map(p => p.name),
      guestParticipants: guest.result.current?.state.participants.map(p => p.name),
      guestMe: guest.result.current?.state.me?.name,
    });

    expect(host.result.current?.state.participants.map((p) => p.name)).not.toContain("Bruno");
    expect(guest.result.current?.state.participants.map((p) => p.name)).not.toContain("Bruno");
    expect(guest.result.current?.state.me?.name).toBe("");
  });
});
