import type { ReactElement, ReactNode } from "react";
import type { CardValue } from "../lib/deck";

export { DECK, isCardValue } from "../lib/deck";
export type { CardValue } from "../lib/deck";

export type Participant = {
  uid: string;
  name: string;
  color: string;
  online: boolean;
  lastSeen: number | null;
  joinedAt: number;
  hasVoted: boolean;
  vote: CardValue | null;
};

export type RoomMeta = {
  id: string;
  name: string;
  hostId: string;
  revealed: boolean;
  round: number;
  autoReveal: boolean;
};

export type RoundStats = {
  average: number | null;
  median: number | null;
  consensus: boolean;
  counts: Record<string, number>;
};

/** Média fechada de uma rodada, ou símbolo unânime (☕/?) quando não há votos numéricos. */
export type RoundHistoryEntry = { round: number; average: number | CardValue };

export type RoomState = {
  status: "connecting" | "ready" | "not-found" | "error";
  me: { uid: string; name: string } | null;
  meta: RoomMeta | null;
  participants: Participant[];
  myVote: CardValue | null;
  stats: RoundStats | null;
  history: RoundHistoryEntry[];
};

export type RoomActions = {
  join(name: string): Promise<void>;
  vote(v: CardValue): Promise<void>;
  reveal(): Promise<void>;
  newRound(): Promise<void>;
  setAutoReveal(v: boolean): Promise<void>;
  kick(uid: string): Promise<void>;
};

export type RoomContextValue = {
  state: RoomState;
  actions: RoomActions;
};

export type RoomProviderProps = {
  children: ReactNode;
  initial?: Partial<RoomState>;
  roomId?: string;
};

export type RoomProvider = (props: RoomProviderProps) => ReactElement;
