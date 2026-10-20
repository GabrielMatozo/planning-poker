import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { get, increment, onValue, ref, runTransaction, serverTimestamp, set, update, type Database } from "@firebase/database";
import { RoomContext } from "../../app/room-context";
import type { CardValue, RoomActions, RoomState } from "../../types/room";
import { isCardValue } from "../../lib/deck";
import { humanError } from "../../lib/errors";
import { checkQuota, recordCreation, QuotaExceededError } from "../../lib/quota";
import { colorFromUid, newRoomCode, normalizeName, normalizeRoomId, normalizeRoomName } from "../../lib/ids";
import { isRemovable } from "../../lib/presence";
import { unanimousSymbol } from "../../lib/stats";
import { recordKick } from "../../lib/kicks";
import { useHeartbeat } from "../../app/use-heartbeat";
import { ensureAuth, getDb } from "./client";
import {
  deriveHistory,
  deriveParticipants,
  deriveStats,
  parseCard,
  shouldAutoReveal,
  shouldClaimHost,
  voteValues,
  type MetaRecord,
  type PresenceMap,
  type VoteMap,
} from "./derive";

const NAME_STORAGE_KEY = "pp:name";
const ROOM_CODE_ATTEMPTS = 5;
const CLOCK_REFRESH_MS = 10_000;
/** Teto de rodadas guardadas em `meta/history`. */
const HISTORY_LIMIT = 50;

export class RoomNotFoundError extends Error {
  readonly roomId: string;

  constructor(roomId: string) {
    super(`Sala ${roomId} não encontrada`);
    this.name = "RoomNotFoundError";
    this.roomId = roomId;
  }
}

export type FirebaseRoomHandle = { state: RoomState; actions: RoomActions };

export function loadNameLocally(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNameLocally(name: string): void {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, normalizeName(name));
  } catch {
    // Armazenamento indisponível (modo privado): o nome vale só para esta sessão.
  }
}

async function readMeta(roomId: string, database: Database): Promise<MetaRecord | null> {
  const snapshot = await get(ref(database, `rooms/${roomId}/meta`));
  return (snapshot.val() ?? null) as MetaRecord | null;
}

function requireSelf(uid: string | null): string {
  if (!uid) throw new Error("Sessão ainda não pronta");
  return uid;
}

async function createRoomImpl(name: string, userName: string): Promise<string> {
  const roomName = normalizeRoomName(name);
  const displayName = normalizeName(userName);
  const user = await ensureAuth();
  const db = getDb();

  // Limite anti-spam: impede DoS por criação massiva de salas.
  // Em produção, App Check no console do Firebase é a proteção server-side.
  await checkQuota(user.uid);

  for (let attempt = 0; attempt < ROOM_CODE_ATTEMPTS; attempt++) {
    const roomId = newRoomCode();
    const taken = await get(ref(db, `rooms/${roomId}/meta`));
    if (taken.exists()) continue;

    try {
      await set(ref(db, `rooms/${roomId}`), {
        meta: {
          name: roomName,
          hostId: user.uid,
          revealed: false,
          round: 1,
          autoReveal: false,
          createdAt: serverTimestamp(),
          lastActivityAt: serverTimestamp(),
        },
        presence: {
          [user.uid]: {
            name: displayName,
            color: colorFromUid(user.uid),
            online: true,
            lastSeen: serverTimestamp(),
            joinedAt: serverTimestamp(),
            hasVoted: false,
          },
        },
      });
    } catch (error) {
      if (attempt === ROOM_CODE_ATTEMPTS - 1) throw error;
      continue;
    }

    saveNameLocally(displayName);
    recordCreation(user.uid);
    return roomId;
  }

  throw new Error("Não foi possível criar a sala agora");
}

export async function createRoom(name: string, userName: string): Promise<string> {
  try {
    return await createRoomImpl(name, userName);
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    throw humanError(error, "Não foi possível criar a sala agora. Tente de novo.");
  }
}

async function joinRoomImpl(rawRoomId: string, userName: string): Promise<void> {
  const roomId = normalizeRoomId(rawRoomId);
  const displayName = normalizeName(userName);
  const user = await ensureAuth();
  const db = getDb();

  const room = await get(ref(db, `rooms/${roomId}/meta`));
  if (!room.exists()) throw new RoomNotFoundError(roomId);

  const presenceRef = ref(db, `rooms/${roomId}/presence/${user.uid}`);
  const existing = await get(presenceRef);
  const base = {
    name: displayName,
    color: colorFromUid(user.uid),
    online: true,
    lastSeen: serverTimestamp(),
  };

  await update(presenceRef, existing.exists() ? base : { ...base, joinedAt: serverTimestamp(), hasVoted: false });
  saveNameLocally(displayName);
}

export async function joinRoom(rawRoomId: string, userName: string): Promise<void> {
  try {
    await joinRoomImpl(rawRoomId, userName);
  } catch (error) {
    throw humanError(error, "Não foi possível entrar na sala agora. Tente de novo.");
  }
}

/**
 * Entrada explícita de quem chegou pelo link sem nome salvo. Sem presença válida
 * o usuário fica invisível na lista e o voto é recusado pelas regras.
 */
export async function joinRoomPresence(
  roomId: string,
  uid: string,
  userName: string,
  database: Database = getDb(),
): Promise<void> {
  try {
    await joinRoomPresenceImpl(roomId, uid, userName, database);
  } catch (error) {
    throw humanError(error, "Não foi possível entrar na sala agora. Tente de novo.");
  }
}

async function joinRoomPresenceImpl(
  roomId: string,
  uid: string,
  userName: string,
  database: Database,
): Promise<void> {
  const displayName = normalizeName(userName);
  const room = await get(ref(database, `rooms/${roomId}/meta`));
  if (!room.exists()) throw new RoomNotFoundError(roomId);

  const presenceRef = ref(database, `rooms/${roomId}/presence/${uid}`);
  const existing = await get(presenceRef);

  if (existing.exists()) {
    await update(presenceRef, { name: displayName });
  } else {
    await set(presenceRef, {
      name: displayName,
      color: colorFromUid(uid),
      online: true,
      lastSeen: serverTimestamp(),
      joinedAt: serverTimestamp(),
      hasVoted: false,
    });
  }

  saveNameLocally(displayName);
}

export async function castVote(roomId: string, uid: string, value: CardValue, database: Database = getDb()): Promise<void> {
  try {
    await castVoteImpl(roomId, uid, value, database);
  } catch (error) {
    throw humanError(error, "Não foi possível registrar seu voto. Tente de novo.");
  }
}

async function castVoteImpl(roomId: string, uid: string, value: CardValue, database: Database): Promise<void> {
  if (!isCardValue(value)) throw new Error("Carta fora do deck");

  const meta = await readMeta(roomId, database);
  if (!meta) throw new RoomNotFoundError(roomId);
  if (meta.revealed) throw new Error("Rodada revelada: espere a próxima para votar");

  const mine = ref(database, `rooms/${roomId}/presence/${uid}`);
  const presence = await get(mine);
  if (!presence.exists()) throw new Error("Sua presença saiu da sala. Entre de novo para votar.");

  // Duas escritas em ordem: a regra de `hasVoted` exige que o voto já exista no
  // servidor, então a flag só é ligada depois que a carta está gravada.
  await update(ref(database, `rooms/${roomId}/votes/${uid}`), {
    value,
    at: serverTimestamp(),
  });

  try {
    await update(mine, { hasVoted: true });
  } catch (error) {
    // O host pode podar a presença entre as duas escritas. Sem presença o voto
    // fica órfão e ainda entraria na conta do reveal, então desfaz.
    await set(ref(database, `rooms/${roomId}/votes/${uid}`), null).catch(() => undefined);
    throw new Error("Sua presença saiu da sala. Entre de novo para votar.", { cause: error });
  }
}

export async function revealRound(roomId: string, uid: string, database: Database = getDb()): Promise<void> {
  try {
    await revealRoundImpl(roomId, uid, database);
  } catch (error) {
    throw humanError(error, "Não foi possível revelar a rodada. Tente de novo.");
  }
}

async function revealRoundImpl(roomId: string, uid: string, database: Database): Promise<void> {
  const meta = await readMeta(roomId, database);
  if (!meta) throw new RoomNotFoundError(roomId);
  if (meta.hostId !== uid) throw new Error("Só o host revela a rodada");
  if (meta.revealed) return;

  await update(ref(database, `rooms/${roomId}/meta`), {
    revealed: true,
    lastActivityAt: serverTimestamp(),
  });
}

export async function startNewRound(
  roomId: string,
  uid: string,
  participantUids: readonly string[],
  database: Database = getDb(),
): Promise<void> {
  try {
    await startNewRoundImpl(roomId, uid, participantUids, database);
  } catch (error) {
    throw humanError(error, "Não foi possível começar a nova rodada. Tente de novo.");
  }
}

async function startNewRoundImpl(
  roomId: string,
  uid: string,
  participantUids: readonly string[],
  database: Database,
): Promise<void> {
  const meta = await readMeta(roomId, database);
  if (!meta) throw new RoomNotFoundError(roomId);
  if (meta.hostId !== uid) throw new Error("Só o host inicia uma nova rodada");

  // Revela brevemente para permitir a deleção dos votos pelas regras; o host é
  // o único com permissão para apagar votos alheios e só pode fazê-lo quando a
  // rodada está revelada. Depois apaga e reinicia a rodada normalmente.
  await update(ref(database, `rooms/${roomId}/meta`), { revealed: true });

  for (const participantUid of participantUids) {
    await update(ref(database, `rooms/${roomId}/presence/${participantUid}`), { hasVoted: false });
    await set(ref(database, `rooms/${roomId}/votes/${participantUid}`), null);
  }

  await update(ref(database, `rooms/${roomId}/meta`), {
    revealed: false,
    round: increment(1),
    lastActivityAt: serverTimestamp(),
  });
}

export async function setRoomAutoReveal(
  roomId: string,
  uid: string,
  value: boolean,
  database: Database = getDb(),
): Promise<void> {
  try {
    await setRoomAutoRevealImpl(roomId, uid, value, database);
  } catch (error) {
    throw humanError(error, "Não foi possível mudar o reveal automático. Tente de novo.");
  }
}

async function setRoomAutoRevealImpl(
  roomId: string,
  uid: string,
  value: boolean,
  database: Database,
): Promise<void> {
  const meta = await readMeta(roomId, database);
  if (!meta) throw new RoomNotFoundError(roomId);
  if (meta.hostId !== uid) throw new Error("Só o host altera o reveal automático");

  await update(ref(database, `rooms/${roomId}/meta`), {
    autoReveal: value,
    lastActivityAt: serverTimestamp(),
  });
}

export async function claimHost(
  roomId: string,
  uid: string,
  expectedHostId: string,
  database: Database = getDb(),
): Promise<boolean> {
  try {
    return await claimHostImpl(roomId, uid, expectedHostId, database);
  } catch (error) {
    throw humanError(error, "Não foi possível assumir a sala. Tente de novo.");
  }
}

async function claimHostImpl(
  roomId: string,
  uid: string,
  expectedHostId: string,
  database: Database,
): Promise<boolean> {
  const hostRef = ref(database, `rooms/${roomId}/meta/hostId`);

  // A primeira passada da transação roda sem cache local (current null): assumimos
  // o valor esperado e deixamos o servidor revalidar a condição no retry.
  const result = await runTransaction(hostRef, (current) =>
    current === null || current === expectedHostId ? uid : undefined,
  );

  return result.committed && result.snapshot.val() === uid;
}

export function useFirebaseRoom(roomId: string): FirebaseRoomHandle {
  const [meta, setMeta] = useState<MetaRecord | null>(null);
  const [presence, setPresence] = useState<PresenceMap>({});
  const [presenceLoaded, setPresenceLoaded] = useState(false);
  const [ownVote, setOwnVote] = useState<CardValue | null>(null);
  const [ownVoteLoaded, setOwnVoteLoaded] = useState(false);
  const [votes, setVotes] = useState<VoteMap>({});
  const [votesLoaded, setVotesLoaded] = useState(false);
  const [meUid, setMeUid] = useState<string | null>(null);
  const [status, setStatus] = useState<RoomState["status"]>("connecting");
  const [tick, setTick] = useState(0);
  const [savedName] = useState(() => loadNameLocally());
  const autoJoinRef = useRef<string | null>(null);
  const autoRevealRoundRef = useRef<number | null>(null);
  const votedRoundRef = useRef<number | null>(null);
  const pendingHistoryRef = useRef<Set<number>>(new Set());
  const prunedRef = useRef<Set<string>>(new Set());
  const metaLoadedRef = useRef(false);
  const metaValueRef = useRef<MetaRecord | null>(null);
  const presenceLoadedRef = useRef(false);

  useEffect(() => {
    let active = true;

    ensureAuth()
      .then((user) => {
        if (active) setMeUid(user.uid);
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!meUid) return;

    const db = getDb();

    const stopMeta = onValue(
      ref(db, `rooms/${roomId}/meta`),
      (snapshot) => {
        const value = snapshot.val() as MetaRecord | null;
        metaLoadedRef.current = true;
        metaValueRef.current = value;
        setMeta(value);

        // Só libera a sala depois de presença e meta carregados: sem isso a tela
        // pode montar o palco antes de saber se a pessoa já está na lista.
        if (!value) setStatus("not-found");
        else if (presenceLoadedRef.current) setStatus("ready");
      },
      () => setStatus("error"),
    );

    const stopPresence = onValue(
      ref(db, `rooms/${roomId}/presence`),
      (snapshot) => {
        presenceLoadedRef.current = true;
        setPresence((snapshot.val() ?? {}) as PresenceMap);
        setPresenceLoaded(true);

        if (metaLoadedRef.current && metaValueRef.current) setStatus("ready");
      },
      () => setStatus("error"),
    );

    const stopOwnVote = onValue(ref(db, `rooms/${roomId}/votes/${meUid}`), (snapshot) => {
      const value = snapshot.val() as { value?: unknown } | null;
      setOwnVote(parseCard(value?.value));
      setOwnVoteLoaded(true);
    });

    return () => {
      stopMeta();
      stopPresence();
      stopOwnVote();
    };
  }, [meUid, roomId]);

  const revealed = meta?.revealed ?? false;

  useEffect(() => {
    if (!meUid || !revealed) {
      setVotes({});
      setVotesLoaded(false);
      return;
    }

    return onValue(ref(getDb(), `rooms/${roomId}/votes`), (snapshot) => {
      setVotes((snapshot.val() ?? {}) as VoteMap);
      setVotesLoaded(true);
    });
  }, [meUid, roomId, revealed]);

  useEffect(() => {
    if (!meUid || !presenceLoaded) return;
    if (!presence[meUid]) autoJoinRef.current = null;
  }, [meUid, presence, presenceLoaded]);

  useEffect(() => {
    if (!meUid || !presenceLoaded || status !== "ready") return;
    if (presence[meUid] || !savedName) return;
    if (autoJoinRef.current === meUid) return;

    autoJoinRef.current = meUid;
    void joinRoom(roomId, savedName).catch(() => {
      autoJoinRef.current = null;
    });
  }, [meUid, presenceLoaded, status, savedName, presence, roomId]);

  // Poda de presença obsoleta: só o host apaga, e só quem está offline há mais de
  // 5 min e sem voto pendente. O servidor revalida com `now`; se a leitura local
  // estiver adiantada, a escrita volta PERMISSION_DENIED e tentamos de novo depois.
  // A presença e o voto vão em escritas separadas: uma negação de voto (regra de
  // obsoleto) não pode bloquear a poda da presença; o voto órfão segue best-effort.
  useEffect(() => {
    if (!meUid || !meta || meta.hostId !== meUid || !presenceLoaded) return;

    const now = Date.now();
    const staleUids = Object.entries(presence)
      .filter(([uid, record]) => uid !== meUid && record && isRemovable(record, now))
      .map(([uid]) => uid)
      .filter((uid) => !prunedRef.current.has(uid));

    if (staleUids.length === 0) return;

    for (const uid of staleUids) {
      prunedRef.current.add(uid);

      void set(ref(getDb(), `rooms/${roomId}/presence/${uid}`), null)
        .catch(() => {
          prunedRef.current.delete(uid);
        })
        .then(() => {
          if (prunedRef.current.has(uid)) {
            // Voto órfão de quem saiu: sem isso a rodada seguinte abriria com a carta
            // antiga. Best-effort — se a regra de obsoleto não liberar, a presença já
            // foi podada e o voto sobra para a limpeza da próxima rodada.
            void set(ref(getDb(), `rooms/${roomId}/votes/${uid}`), null).catch(() => undefined);
          }
        });
    }
  }, [meUid, meta, presence, presenceLoaded, roomId]);

  const participants = useMemo(
    () => deriveParticipants({ presence, votes, revealed, meUid, myVote: ownVote, now: Date.now() }),
    [presence, votes, revealed, meUid, ownVote, tick],
  );

  const stats = useMemo(
    () => (revealed && votesLoaded ? deriveStats(votes, revealed) : null),
    [revealed, votesLoaded, votes],
  );

  // Histórico é derivado do banco (`meta/history`), nunca montado no cliente:
  // todo mundo vê a mesma lista e ela volta igual depois de F5.
  const history = useMemo(() => deriveHistory(meta?.history), [meta?.history]);

  // Fecha a média no banco quando o host observa a rodada revelada. Só o host
  // escreve: as regras recusam qualquer outro uid. Idempotente pela checagem em
  // `meta.history` e pela trava local, que cobre o intervalo entre a escrita e o
  // snapshot com o valor. Quando todos votam o mesmo símbolo (☕ ou ?) e não há
  // média numérica, grava o símbolo no histórico também.
  useEffect(() => {
    if (!meUid || !meta || meta.hostId !== meUid || !meta.revealed) return;
    if (!stats) return;

    const round = meta.round;
    if (meta.history?.[String(round)] !== undefined) return;
    if (pendingHistoryRef.current.has(round)) return;

    const value = stats.average !== null ? stats.average : unanimousSymbol(voteValues(votes));
    if (value === null) return;

    pendingHistoryRef.current.add(round);
    void set(ref(getDb(), `rooms/${roomId}/meta/history/${round}`), value).catch(() => {
      pendingHistoryRef.current.delete(round);
    });
  }, [meUid, meta, stats, roomId, votes]);

  // Poda: guarda as 50 rodadas mais recentes. A regra de escrita em `history`
  // exige reveal ativo, então a remoção acontece na mesma janela da escrita.
  useEffect(() => {
    if (!meUid || !meta || meta.hostId !== meUid || !meta.revealed) return;

    const entries = deriveHistory(meta.history);
    if (entries.length <= HISTORY_LIMIT) return;

    for (const entry of entries.slice(0, entries.length - HISTORY_LIMIT)) {
      void set(ref(getDb(), `rooms/${roomId}/meta/history/${entry.round}`), null).catch(() => undefined);
    }
  }, [meUid, meta, roomId]);

  useEffect(() => {
    if (!meUid || !meta) return;
    if (!shouldAutoReveal({ meta, participants, meUid, firedRound: autoRevealRoundRef.current })) return;

    autoRevealRoundRef.current = meta.round;
    void revealRound(roomId, meUid).catch(() => {
      autoRevealRoundRef.current = null;
    });
  }, [meUid, meta, participants, roomId]);

  useEffect(() => {
    if (!meUid || !meta || meta.revealed) return;
    if (votedRoundRef.current === meta.round) return;
    if (!ownVoteLoaded || ownVote !== null) return;
    if (!presence[meUid]?.hasVoted) return;

    void update(ref(getDb(), `rooms/${roomId}/presence/${meUid}`), { hasVoted: false }).catch(() => undefined);
  }, [meUid, meta, presence, ownVote, ownVoteLoaded, roomId]);

  // Reconciliação inversa: voto gravado mas flag `hasVoted` não. Acontece se a
  // segunda escrita de `castVote` falhar (aba fechada, rede caindo).
  useEffect(() => {
    if (!meUid || !meta || meta.revealed) return;
    if (!presenceLoaded || !ownVoteLoaded || ownVote === null) return;
    if (presence[meUid]?.hasVoted) return;

    void update(ref(getDb(), `rooms/${roomId}/presence/${meUid}`), { hasVoted: true }).catch(() => undefined);
  }, [meUid, meta, presence, presenceLoaded, ownVote, ownVoteLoaded, roomId]);

  useEffect(() => {
    if (!meUid || !meta || !presenceLoaded) return;
    if (!shouldClaimHost({ meta, presence, meUid, now: Date.now() })) return;

    const expectedHostId = meta.hostId;
    void claimHost(roomId, meUid, expectedHostId).catch(() => undefined);
  }, [meUid, meta, presence, presenceLoaded, roomId, tick]);

  useHeartbeat(roomId, meUid, Boolean(meUid && presence[meUid]));

  const actions = useMemo<RoomActions>(
    () => ({
      async join(name) {
        await joinRoomPresence(roomId, requireSelf(meUid), name);
      },
      async vote(value) {
        const uid = requireSelf(meUid);
        votedRoundRef.current = meta?.round ?? null;

        try {
          await castVote(roomId, uid, value);
        } catch (error) {
          votedRoundRef.current = null;
          throw error;
        }
      },
      async reveal() {
        await revealRound(roomId, requireSelf(meUid));
      },
      async newRound() {
        const uid = requireSelf(meUid);
        votedRoundRef.current = null;
        autoRevealRoundRef.current = null;
        await startNewRound(roomId, uid, Object.keys(presence));
      },
      async setAutoReveal(value) {
        await setRoomAutoReveal(roomId, requireSelf(meUid), value);
      },
      async kick(targetUid: string) {
        // Remove a presença do expulsado e registra o kick localmente para
        // bloquear reingresso com o mesmo nome durante o cooldown.
        await set(ref(getDb(), `rooms/${roomId}/presence/${targetUid}`), null).catch(() => undefined);
        const targetName = presence[targetUid]?.name ?? "alguém";
        recordKick(targetName, roomId, meta?.name ?? "");
      },
    }),
    [roomId, meUid, meta?.round, presence],
  );

  const state: RoomState = {
    status,
    // Nome vem só da presença: se a escrita falhou, a tela pede entrada de novo
    // em vez de fingir que a pessoa está na sala.
    me: meUid ? { uid: meUid, name: presence[meUid]?.name ?? "" } : null,
    meta: meta
      ? {
          id: roomId,
          name: meta.name,
          hostId: meta.hostId,
          revealed: meta.revealed,
          round: meta.round,
          autoReveal: meta.autoReveal,
        }
      : null,
    participants,
    myVote: ownVote,
    stats,
    history,
  };

  return { state, actions };
}

export function FirebaseRoomProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const value = useFirebaseRoom(roomId);
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
