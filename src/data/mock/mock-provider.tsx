import { useEffect, useRef, useState } from "react";
import type { CardValue, Participant, RoomActions, RoomMeta, RoomProviderProps, RoomState } from "../../types/room";
import { computeStats, unanimousSymbol } from "../../lib/stats";
import { colorFromUid, normalizeName } from "../../lib/ids";
import { recordKick } from "../../lib/kicks";
import { RoomContext } from "../../app/room-context";
import { createMockSync, type SharedPayload } from "./mock-sync";

const HISTORY_LIMIT = 50;

let uidCounter = 0;

function randomUid(): string {
  uidCounter += 1;
  try {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "-" + uidCounter;
  } catch {
    return `mock-${Math.random().toString(36).slice(2, 10)}-${uidCounter}`;
  }
}

/**
 * Gera um uid único por instância do provider. Cada montagem do React
 * (aba, contexto, teste) recebe um uid diferente. No navegador real,
 * cada aba é uma montagem separada; em jsdom, cada `setup()` é uma
 * montagem separada. A estabilidade dentro de uma mesma sessão é
 * garantida pelo `useRef` no component.
 */
function ownUid(): string {
  return randomUid();
}

function seedParticipant(uid: string, now: number): Participant {
  return {
    uid,
    name: "Ana",
    color: "#D9A05B",
    online: true,
    lastSeen: now,
    joinedAt: now,
    hasVoted: false,
    vote: null,
  };
}

function defaultState(uid: string): RoomState {
  const joinedAt = Date.now();
  return {
    status: "ready",
    me: { uid, name: "Ana" },
    meta: {
      id: "mock01",
      name: "Sprint 42",
      hostId: uid,
      revealed: false,
      round: 1,
      autoReveal: false,
    },
    participants: [seedParticipant(uid, joinedAt)],
    myVote: null,
    stats: null,
    history: [],
  };
}

function revealState(state: RoomState): RoomState {
  if (!state.meta || state.meta.revealed) return state;

  const votes = state.participants.flatMap((p) => (p.vote ? [p.vote] : []));
  const stats = computeStats(votes);
  const history =
    stats.average !== null
      ? [...state.history, { round: state.meta.round, average: stats.average }].slice(-HISTORY_LIMIT)
      : unanimousSymbol(votes) !== null
        ? [...state.history, { round: state.meta.round, average: unanimousSymbol(votes)! }].slice(-HISTORY_LIMIT)
        : state.history;

  return { ...state, meta: { ...state.meta, revealed: true }, stats, history };
}

function voteState(state: RoomState, value: CardValue): RoomState {
  if (!state.meta || state.meta.revealed || !state.me) return state;

  const uid = state.me.uid;
  const participants = state.participants.map((p) => (p.uid === uid ? { ...p, hasVoted: true, vote: value } : p));

  const next: RoomState = { ...state, participants, myVote: value };
  const everyoneVoted = participants.filter((p) => p.online).every((p) => p.hasVoted);

  return next.meta?.autoReveal && everyoneVoted ? revealState(next) : next;
}

function newRoundState(state: RoomState): RoomState {
  if (!state.meta) return state;

  const participants = state.participants.map((p) => ({ ...p, hasVoted: false, vote: null }));

  return {
    ...state,
    meta: { ...state.meta, revealed: false, round: state.meta.round + 1 },
    participants,
    myVote: null,
    stats: null,
  };
}

/**
 * Combina participantes locais com o compartilhado.
 *
 * O compartilhado (remote) é a fonte de verdade quando existe.
 * O próprio usuário (me) é adicionado se:
 * 1. Não está no remote E meu uid NUNCA esteve no shared
 *    (significa que ainda não "entrei" na visão do grupo - primeira vez)
 * 2. NÃO é adicionado se meu uid JÁ esteve no shared mas sumiu
 *    (significa que fui expulso)
 */
function mergeParticipants(
  local: Participant[],
  remote: Participant[],
  myUid: string | null,
  myUidWasInShared: boolean,
): Participant[] {
  const byUid = new Map<string, Participant>();
  for (const p of remote) byUid.set(p.uid, p);
  // Só re-adiciona meu uid do local se NUNCA esteve no shared.
  // Se já esteve e sumiu do shared, fui expulso: não re-adiciona.
  if (myUid && !myUidWasInShared) {
    const meLocal = local.find((p) => p.uid === myUid);
    if (meLocal) byUid.set(myUid, meLocal);
  }
  const result = [...byUid.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  return result;
}

export function MockRoomProvider({ children, initial, roomId }: RoomProviderProps) {
  // Gera o uid deste provider uma vez e reutiliza em todo o ciclo.
  // Se houver preset com meta.hostId, usa esse uid.
  // Se houver preset com participants mas sem meta, usa o uid do primeiro participante.
  // Se não há roomId (testes de componente), usa uid fixo "mock-ana".
  // Senão, usa ownUid() que gera um uid único por instância.
  const isComponentTest = !roomId;
  const presetHostId = initial?.meta?.hostId ?? initial?.participants?.[0]?.uid;
  const baseUid = presetHostId ?? (isComponentTest ? "mock-ana" : ownUid());

  const [localState, setLocalState] = useState<RoomState>(() => {
    const base = defaultState(baseUid);
    if (initial && Object.keys(initial).length > 0) {
      const presetMeta = initial.meta;
      const resolvedMeta: RoomMeta = {
        id: presetMeta?.id ?? base.meta!.id,
        name: presetMeta?.name ?? base.meta!.name,
        hostId: presetMeta?.hostId ?? baseUid,
        revealed: presetMeta?.revealed ?? base.meta!.revealed,
        round: presetMeta?.round ?? base.meta!.round,
        autoReveal: presetMeta?.autoReveal ?? base.meta!.autoReveal,
      };
      return {
        ...base,
        ...initial,
        me: initial.me ?? (initial.participants?.length ? { uid: baseUid, name: initial.participants[0]?.name ?? "Ana" } : base.me),
        meta: resolvedMeta,
        participants: initial.participants ?? base.participants,
        stats: initial.stats ?? base.stats,
        history: initial.history ?? base.history,
      };
    }
    return base;
  });

  // UID estável do provider para identificar mensagens de eco no sync
  const providerUid = useRef<string>(localState.me?.uid ?? "anon");
  providerUid.current = localState.me?.uid ?? "anon";

  const [shared, setShared] = useState<SharedPayload | null>(null);
  const sharedReceivedRef = useRef(false);
  // Marca se o meu uid JÁ esteve no shared alguma vez
  // Usado no merge para não re-adicionar o me se fui expulso
  const myUidWasInSharedRef = useRef(false);
  const syncRef = useRef<ReturnType<typeof createMockSync> | null>(null);
  const localStateRef = useRef(localState);
  localStateRef.current = localState;

  useEffect(() => {
    if (!roomId) return;
    const sync = createMockSync(roomId, providerUid.current);
    syncRef.current = sync;
    const unsub = sync.onShared((payload) => {
      if (!sharedReceivedRef.current) sharedReceivedRef.current = true;
      // Atualiza myUidWasInShared: uma vez true, permanece true.
      // Se meu uid sumiu do shared, fui expulso, mas não quero ser re-adicionado.
      const myUid = localStateRef.current.me?.uid;
      if (myUid && payload.participants.some((p) => p.uid === myUid)) {
        myUidWasInSharedRef.current = true;
      }
      setShared(payload);
    });
    const persisted = sync.latest();
    // persisted NÃO marca sharedReceivedRef - é dado local, não broadcast
    if (persisted) setShared(persisted);
    sync.requestState();
    return () => {
      // Avisa que este provider saiu, para outros removam a presença
      sync.publishBye(providerUid.current);
      unsub();
      sync.close();
      syncRef.current = null;
    };
  }, [roomId]);

  // Estado final: sem roomId, é local puro. Com roomId, junta local + shared.
  // Se o shared não contém o meu uid, fui expulso: zera o nome.
  const myUid = localState.me?.uid ?? null;
  const myInShared = shared?.participants.some((p) => p.uid === myUid) ?? false;
  const state: RoomState = roomId && shared
    ? {
        ...localState,
        status: "ready",
        me: localState.me && myInShared
          ? localState.me
          : localState.me
            ? { ...localState.me, name: "" }
            : null,
        meta: shared.meta ?? localState.meta,
        participants: mergeParticipants(
          localState.participants,
          shared.participants,
          myUid,
          myUidWasInSharedRef.current,
        ),
        myVote: localState.myVote,
        stats: shared.stats ?? localState.stats,
        history: shared.history ?? localState.history,
      }
    : localState;

  // Publica o estado LOCAL quando um campo compartilhado muda.
  // Para evitar loop infinito, só publica quando o LOCAL muda (não quando
  // o shared muda por remote update). O timestamp no sync evita eco.
  const prevLocal = useRef(localState);
  useEffect(() => {
    if (!roomId || !syncRef.current) return;
    const prev = prevLocal.current;
    prevLocal.current = localState;
    const changedShared =
      prev.participants !== localState.participants ||
      prev.meta !== localState.meta ||
      prev.stats !== localState.stats ||
      prev.history !== localState.history;
    if (changedShared) {
      // Publica o estado FINAL (com merge) para que os outros vejam todos
      const payload: SharedPayload = {
        participants: state.participants,
        meta: state.meta!,
        stats: state.stats,
        history: state.history,
      };
      syncRef.current.publishShared(payload);
    }
  }, [roomId, localState]);

  const actions: RoomActions = {
    async join(name) {
      const displayName = normalizeName(name);
      setLocalState((prev) => {
        const uid = prev.me?.uid ?? ownUid();
        const joinedAt = Date.now();
        const known = prev.participants.some((person) => person.uid === uid);
        const participants = known
          ? prev.participants.map((person) => (person.uid === uid ? { ...person, name: displayName } : person))
          : [
              ...prev.participants,
              {
                uid,
                name: displayName,
                color: colorFromUid(uid),
                online: true,
                lastSeen: joinedAt,
                joinedAt,
                hasVoted: false,
                vote: null,
              },
            ];
        return { ...prev, me: { uid, name: displayName }, participants };
      });
    },
    async vote(value) {
      if (localState.meta?.revealed) throw new Error("Rodada revelada: espere a próxima para votar");
      setLocalState((prev) => voteState(prev, value));
    },
    async reveal() {
      console.log("[MockRoomProvider] reveal called, localState.meta:", localState.meta);
      setLocalState((prev) => {
        const next = revealState(prev);
        console.log("[MockRoomProvider] reveal updater result:", { revealed: next.meta?.revealed, stats: next.stats });
        return next;
      });
    },
    async newRound() {
      setLocalState(newRoundState);
    },
    async setAutoReveal(value) {
      setLocalState((prev) => (prev.meta ? { ...prev, meta: { ...prev.meta, autoReveal: value } } : prev));
    },
    async kick(targetUid: string) {
      const local = localStateRef.current;
      const target = local.participants.find((p) => p.uid === targetUid);
      setLocalState((prev) => {
        const participants = prev.participants.filter((p) => p.uid !== targetUid);
        const me = prev.me?.uid === targetUid ? { ...prev.me, name: "" } : prev.me;
        const newHostId =
          prev.meta?.hostId === targetUid ? participants.find((p) => p.online)?.uid ?? null : prev.meta?.hostId ?? null;
        const newMeta = newHostId && prev.meta ? { ...prev.meta, hostId: newHostId } : prev.meta;
        return { ...prev, participants, me: me ?? null, meta: newMeta };
      });
      // Notifica os outros providers via BroadcastChannel para remover o alvo
      if (roomId && syncRef.current) {
        syncRef.current.publishBye(targetUid);
      }
      if (target) recordKick(target.name, roomId ?? "mock01", local.meta?.name ?? "Sprint 42");
    },
  };

  return <RoomContext.Provider value={{ state, actions }}>{children}</RoomContext.Provider>;
}
