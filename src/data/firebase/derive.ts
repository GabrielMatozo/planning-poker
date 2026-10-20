import type { CardValue, Participant, RoundHistoryEntry, RoundStats } from "../../types/room";
import { isCardValue } from "../../lib/deck";
import { colorFromUid } from "../../lib/ids";
import { isOnline, isRemovable, pickNextHost } from "../../lib/presence";
import { computeStats } from "../../lib/stats";

export type MetaRecord = {
  name: string;
  hostId: string;
  revealed: boolean;
  round: number;
  autoReveal: boolean;
  /** `{ [round]: média }`, gravado pelo host a cada reveal. */
  history?: Record<string, unknown> | null;
  createdAt?: number | null;
  lastActivityAt?: number | null;
};

export type PresenceRecord = {
  name: string;
  color: string;
  online: boolean;
  lastSeen: number | null;
  joinedAt: number;
  hasVoted: boolean;
};

export type VoteRecord = { value: string; at: number | null };

export type PresenceMap = Record<string, PresenceRecord>;
export type VoteMap = Record<string, VoteRecord>;

export function parseCard(value: unknown): CardValue | null {
  return typeof value === "string" && isCardValue(value) ? value : null;
}

export function voteValues(votes: VoteMap): CardValue[] {
  const values: CardValue[] = [];

  for (const vote of Object.values(votes)) {
    const card = parseCard(vote?.value);
    if (card) values.push(card);
  }

  return values;
}

export function deriveStats(votes: VoteMap, revealed: boolean): RoundStats | null {
  if (!revealed) return null;
  return computeStats(voteValues(votes));
}

/**
 * Lê `meta.history` (`{ [round]: média | símbolo }`) e devolve a lista ordenada.
 * O SDK entrega chaves numéricas como array (`[null, 5]` para a rodada 1);
 * `Object.entries` cobre os dois formatos. Chave fora do padrão `1..9999` e valor
 * que não seja número finito nem símbolo válido são descartados: o banco é a fonte
 * da verdade, mas quem escreveu por fora não dita o que a UI mostra.
 */
export function deriveHistory(raw: Record<string, unknown> | undefined | null): RoundHistoryEntry[] {
  if (!raw || typeof raw !== "object") return [];

  const entries: RoundHistoryEntry[] = [];
  const SYMBOLS = new Set(["?", "☕"]);

  for (const [key, value] of Object.entries(raw)) {
    if (!/^[1-9][0-9]{0,3}$/.test(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      entries.push({ round: Number(key), average: value });
    } else if (typeof value === "string" && SYMBOLS.has(value)) {
      entries.push({ round: Number(key), average: value as CardValue });
    }
  }

  return entries.sort((a, b) => a.round - b.round);
}

export type DeriveParticipantsArgs = {
  presence: PresenceMap;
  votes: VoteMap;
  revealed: boolean;
  meUid: string | null;
  myVote: CardValue | null;
  now: number;
};

export function deriveParticipants({
  presence,
  votes,
  revealed,
  meUid,
  myVote,
  now,
}: DeriveParticipantsArgs): Participant[] {
  const participants: Participant[] = [];

  for (const [uid, record] of Object.entries(presence)) {
    if (!record || typeof record.name !== "string") continue;

    const isMe = uid === meUid;
    if (!isMe && isRemovable(record, now)) continue;

    const vote = revealed ? parseCard(votes[uid]?.value) : isMe ? myVote : null;

    participants.push({
      uid,
      name: record.name,
      color: typeof record.color === "string" && record.color ? record.color : colorFromUid(uid),
      online: isOnline(record, now),
      lastSeen: typeof record.lastSeen === "number" ? record.lastSeen : null,
      joinedAt: typeof record.joinedAt === "number" ? record.joinedAt : 0,
      hasVoted: record.hasVoted === true,
      vote,
    });
  }

  return participants.sort(
    (a, b) => Number(b.online) - Number(a.online) || a.joinedAt - b.joinedAt || a.name.localeCompare(b.name),
  );
}

export type AutoRevealArgs = {
  meta: MetaRecord | null;
  participants: readonly Participant[];
  meUid: string | null;
  firedRound: number | null;
};

export function shouldAutoReveal({ meta, participants, meUid, firedRound }: AutoRevealArgs): boolean {
  if (!meta || !meUid) return false;
  if (meta.revealed || !meta.autoReveal) return false;
  if (meta.hostId !== meUid) return false;
  if (firedRound !== null && firedRound === meta.round) return false;

  const online = participants.filter((participant) => participant.online);
  if (online.length === 0) return false;

  return online.every((participant) => participant.hasVoted);
}

export type ClaimHostArgs = {
  meta: MetaRecord | null;
  presence: PresenceMap;
  meUid: string | null;
  now: number;
};

export function shouldClaimHost({ meta, presence, meUid, now }: ClaimHostArgs): boolean {
  if (!meta || !meUid) return false;
  if (meta.hostId === meUid) return false;

  const currentHost = presence[meta.hostId];
  if (currentHost && isOnline(currentHost, now)) return false;

  const candidates = Object.entries(presence).map(([uid, record]) => ({ uid, ...record }));
  return pickNextHost(candidates, now, meta.hostId) === meUid;
}
