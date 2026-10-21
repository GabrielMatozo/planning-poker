import { useMemo } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { FirebaseRoomProvider } from "../data/firebase/room-provider";
import { MockRoomProvider } from "../data/mock/mock-provider";
import type { Participant, RoomState } from "../types/room";

/**
 * O provider real é o padrão. O mock existe para QA visual e testes de componente:
 * abre com `?mock=1` ou `VITE_USE_MOCK=1`.
 */
export function useMockRoom(): boolean {
  const { search } = useLocation();

  return useMemo(() => {
    const fromQuery = new URLSearchParams(search).get("mock") === "1";
    const fromEnv = ["1", "true"].includes(String(import.meta.env.VITE_USE_MOCK ?? "").toLowerCase());
    return fromQuery || fromEnv;
  }, [search]);
}

export function mockLink(path: string, mock: boolean): string {
  if (!mock) return path;
  return `${path}${path.includes("?") ? "&" : "?"}mock=1`;
}

/*
 * Presets do mock usados pelo design em QA visual. Nunca rodam no provider real
 * nem em produção: exigem `?mock=1` e uma build de desenvolvimento.
 */
const DEV_PEOPLE = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabriela", "Heitor"];
const DEV_COLORS = ["#D9A05B", "#6E9FDB", "#65B08A", "#C98A8A", "#8FB3A8", "#B8A46E", "#8C93B8", "#A3A3A3"];

function devParticipants(count: number, voted: Array<string | null>): Participant[] {
  const now = Date.now();
  return DEV_PEOPLE.slice(0, count).map((name, index) => ({
    uid: index === 0 ? "mock-ana" : `mock-${index}`,
    name,
    color: DEV_COLORS[index % DEV_COLORS.length] ?? "#A3A3A3",
    online: true,
    lastSeen: now - index * 900,
    joinedAt: now - (count - index) * 60_000,
    hasVoted: voted[index] !== null && voted[index] !== undefined,
    vote: (voted[index] as Participant["vote"]) ?? null,
  }));
}

export function devPreset(search: string): Partial<RoomState> | undefined {
  if (!import.meta.env.DEV) return undefined;

  const params = new URLSearchParams(search);
  if (params.get("mock") !== "1") return undefined;
  const estado = params.get("estado");
  console.log("[devPreset] estado:", estado);

  switch (estado) {
    case "conectando":
      return { status: "connecting" };
    case "nao-encontrada":
      return { status: "not-found" };
    case "erro":
      return { status: "error" };
    case "cheio":
      return {
        participants: devParticipants(8, ["3", null, "5", null, "8", null, null, null]),
        myVote: "3",
      };
    case "vazio":
      return {
        meta: { id: "mock01", name: "Sprint 42", hostId: "mock-ana", revealed: true, round: 4, autoReveal: false },
        participants: devParticipants(3, [null, null, null]),
        stats: { average: null, median: null, consensus: false, counts: {} },
      };
    case "simbolos":
      return {
        meta: { id: "mock01", name: "Sprint 42", hostId: "mock-ana", revealed: true, round: 3, autoReveal: false },
        participants: devParticipants(3, ["?", "☕", "?"]),
        stats: { average: null, median: null, consensus: false, counts: { "?": 2, "☕": 1 } },
        history: [{ round: 1, average: 5 }, { round: 2, average: 8 }],
        myVote: "?",
      };
    case "nao-host":
      return {
        meta: { id: "mock01", name: "Sprint 42", hostId: "mock-1", revealed: false, round: 2, autoReveal: true },
        participants: devParticipants(4, [null, "8", null, null]),
      };
    default:
      return undefined;
  }
}

export function RoomProviderFor({ roomId, children }: { roomId: string; children: ReactNode }) {
  const { search } = useLocation();
  const mock = useMockRoom();
  const initial = useMemo(() => (mock ? devPreset(search) : undefined), [mock, search]);

  if (mock) {
    return (
      <MockRoomProvider key={roomId} roomId={roomId} initial={initial}>
        {children}
      </MockRoomProvider>
    );
  }

  return (
    <FirebaseRoomProvider key={roomId} roomId={roomId}>
      {children}
    </FirebaseRoomProvider>
  );
}
