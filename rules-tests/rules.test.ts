// @vitest-environment node
import { describe, expect, it } from "vitest";

const DB_ORIGIN = process.env.RULES_DB_ORIGIN ?? "http://127.0.0.1:9000";
const DB_NAMESPACE = process.env.RULES_DB_NAMESPACE ?? "demo-planning-poker-default-rtdb";
const AUTH_ORIGIN = process.env.RULES_AUTH_ORIGIN ?? "http://127.0.0.1:9099";
const AUTH_SIGN_UP = `${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`;
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const ENABLED = Boolean(process.env.FIREBASE_EMULATOR);

type Session = { uid: string; token: string };
type Response = { status: number; body: unknown };

async function signIn(): Promise<Session> {
  const response = await fetch(AUTH_SIGN_UP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const body = (await response.json()) as { idToken: string; localId: string };

  return { uid: body.localId, token: body.idToken };
}

function url(path: string, token: string): string {
  return `${DB_ORIGIN}/${path}.json?ns=${DB_NAMESPACE}&auth=${encodeURIComponent(token)}`;
}

async function read(path: string, token: string): Promise<Response> {
  const response = await fetch(url(path, token));
  return { status: response.status, body: await response.json() };
}

async function write(path: string, token: string, body: unknown): Promise<Response> {
  const response = await fetch(url(path, token), { method: "PUT", body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

async function erase(path: string, token: string): Promise<Response> {
  const response = await fetch(url(path, token), { method: "DELETE" });
  return { status: response.status, body: await response.json() };
}

function roomCode(): string {
  let code = "";
  for (let index = 0; index < 6; index++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

function presence(name: string, overrides: Partial<Record<string, unknown>> = {}) {
  return { name, color: "#D9A05B", online: true, lastSeen: 1, joinedAt: 1, hasVoted: false, ...overrides };
}

type SeededRoom = { roomId: string; host: Session; guest: Session };

async function seedRoom(): Promise<SeededRoom> {
  const host = await signIn();
  const guest = await signIn();
  const roomId = roomCode();

  const created = await write(`rooms/${roomId}`, host.token, {
    meta: { name: "Sprint 42", hostId: host.uid, revealed: false, round: 1, autoReveal: false },
    presence: { [host.uid]: presence("Ana") },
  });
  expect(created.status).toBe(200);

  const joined = await write(`rooms/${roomId}/presence/${guest.uid}`, guest.token, presence("Bruno"));
  expect(joined.status).toBe(200);

  return { roomId, host, guest };
}

async function seedVotes(room: SeededRoom): Promise<void> {
  const hostVote = await write(`rooms/${room.roomId}/votes/${room.host.uid}`, room.host.token, {
    value: "5",
    at: 1,
  });
  const guestVote = await write(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token, {
    value: "8",
    at: 1,
  });

  expect(hostVote.status).toBe(200);
  expect(guestVote.status).toBe(200);
}

describe.skipIf(!ENABLED)("regras do Realtime Database", () => {
  it("nega ler o voto de outro antes do reveal", async () => {
    const room = await seedRoom();
    await seedVotes(room);

    const other = await read(`rooms/${room.roomId}/votes/${room.host.uid}`, room.guest.token);
    const all = await read(`rooms/${room.roomId}/votes`, room.guest.token);

    expect(other.status).toBe(401);
    expect(all.status).toBe(401);
  });

  it("permite ler o próprio voto antes do reveal", async () => {
    const room = await seedRoom();
    await seedVotes(room);

    const own = await read(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token);

    expect(own.status).toBe(200);
    expect((own.body as { value: string }).value).toBe("8");
  });

  it("permite ler todos os votos depois do reveal", async () => {
    const room = await seedRoom();
    await seedVotes(room);

    const reveal = await write(`rooms/${room.roomId}/meta/revealed`, room.host.token, true);
    expect(reveal.status).toBe(200);

    const other = await read(`rooms/${room.roomId}/votes/${room.host.uid}`, room.guest.token);
    const all = await read(`rooms/${room.roomId}/votes`, room.guest.token);

    expect(other.status).toBe(200);
    expect((other.body as { value: string }).value).toBe("5");
    expect(all.status).toBe(200);
    expect(Object.keys(all.body as Record<string, unknown>)).toHaveLength(2);
  });

  it("nega voto fora do deck", async () => {
    const room = await seedRoom();

    const outside = await write(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token, {
      value: "4",
      at: 1,
    });

    expect(outside.status).toBe(401);
  });

  it("nega escrita de voto em uid alheio", async () => {
    const room = await seedRoom();

    const forged = await write(`rooms/${room.roomId}/votes/${room.host.uid}`, room.guest.token, {
      value: "13",
      at: 1,
    });

    expect(forged.status).toBe(401);
  });

  it("nega voto depois do reveal", async () => {
    const room = await seedRoom();
    await sendReveal(room);

    const late = await write(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token, {
      value: "13",
      at: 2,
    });

    expect(late.status).toBe(401);
  });

  it("nega não-host alterando meta", async () => {
    const room = await seedRoom();

    const revealed = await write(`rooms/${room.roomId}/meta/revealed`, room.guest.token, true);
    const round = await write(`rooms/${room.roomId}/meta/round`, room.guest.token, 2);
    const autoReveal = await write(`rooms/${room.roomId}/meta/autoReveal`, room.guest.token, true);
    const name = await write(`rooms/${room.roomId}/meta/name`, room.guest.token, "Invadida");

    expect(revealed.status).toBe(401);
    expect(round.status).toBe(401);
    expect(autoReveal.status).toBe(401);
    expect(name.status).toBe(401);
  });

  it("nega presença em uid alheio", async () => {
    const room = await seedRoom();

    const forged = await write(`rooms/${room.roomId}/presence/${room.host.uid}`, room.guest.token, presence("Hacker"));
    const removed = await erase(`rooms/${room.roomId}/presence/${room.host.uid}`, room.guest.token);

    expect(forged.status).toBe(401);
    expect(removed.status).toBe(401);
  });

  it("permite ao host revelar e iniciar nova rodada", async () => {
    const room = await seedRoom();
    await seedVotes(room);

    const reveal = await write(`rooms/${room.roomId}/meta/revealed`, room.host.token, true);
    expect(reveal.status).toBe(200);

    // Limpeza de votos só vale enquanto a rodada está revelada (transição atômica).
    const clearedByHost = await erase(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.host.token);
    const clearedOwn = await erase(`rooms/${room.roomId}/votes/${room.host.uid}`, room.host.token);

    expect(clearedByHost.status).toBe(200);
    expect(clearedOwn.status).toBe(200);

    const guestVote = await read(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token);
    expect(guestVote.body).toBeNull();

    const round = await write(`rooms/${room.roomId}/meta/round`, room.host.token, 2);
    const closed = await write(`rooms/${room.roomId}/meta/revealed`, room.host.token, false);

    expect(round.status).toBe(200);
    expect(closed.status).toBe(200);
  });

  it("nega não-host limpando votos alheios", async () => {
    const room = await seedRoom();
    await seedVotes(room);

    const cleared = await erase(`rooms/${room.roomId}/votes/${room.host.uid}`, room.guest.token);

    expect(cleared.status).toBe(401);
  });

  it("exige que a criação da sala traga o próprio uid como host", async () => {
    const host = await signIn();
    const intruder = await signIn();
    const roomId = roomCode();

    const forged = await write(`rooms/${roomId}`, intruder.token, {
      meta: { name: "Sprint 42", hostId: host.uid, revealed: false, round: 1, autoReveal: false },
      presence: { [intruder.uid]: presence("Bruno") },
    });

    expect(forged.status).toBe(401);
  });

  it("nega sobrescrever sala existente", async () => {
    const room = await seedRoom();

    const overwrite = await write(`rooms/${room.roomId}`, room.guest.token, {
      meta: { name: "Outra", hostId: room.guest.uid, revealed: true, round: 9, autoReveal: true },
      presence: { [room.guest.uid]: presence("Bruno") },
    });

    expect(overwrite.status).toBe(401);
  });

  it("nega sala com meta incompleta", async () => {
    const host = await signIn();
    const roomId = roomCode();

    const incomplete = await write(`rooms/${roomId}`, host.token, {
      meta: { name: "Sprint 42", hostId: host.uid },
      presence: { [host.uid]: presence("Ana") },
    });

    expect(incomplete.status).toBe(401);
  });

  it("nega leitura anônima da sala", async () => {
    const room = await seedRoom();

    const anonymous = await fetch(`${DB_ORIGIN}/rooms/${room.roomId}/meta.json?ns=${DB_NAMESPACE}`);

    expect(anonymous.status).toBe(401);
  });

  it("nega tomada de host enquanto o host está vivo", async () => {
    const room = await seedRoom();
    await write(`rooms/${room.roomId}/presence/${room.host.uid}/lastSeen`, room.host.token, Date.now());

    const hijack = await write(`rooms/${room.roomId}/meta/hostId`, room.guest.token, room.guest.uid);

    expect(hijack.status).toBe(401);
  });

  it("permite assumir quando o host sumiu", async () => {
    const room = await seedRoom();
    await write(`rooms/${room.roomId}/presence/${room.host.uid}/lastSeen`, room.host.token, 1);

    const takeover = await write(`rooms/${room.roomId}/meta/hostId`, room.guest.token, room.guest.uid);

    expect(takeover.status).toBe(200);
  });

  it("nega presença em sala que não existe", async () => {
    const guest = await signIn();
    const ghostRoom = roomCode();

    const squat = await write(`rooms/${ghostRoom}/presence/${guest.uid}`, guest.token, presence("Fantasma"));

    expect(squat.status).toBe(401);
  });

  it("nega marcar votou sem voto gravado", async () => {
    const room = await seedRoom();

    const forged = await write(`rooms/${room.roomId}/presence/${room.guest.uid}/hasVoted`, room.guest.token, true);

    expect(forged.status).toBe(401);
  });

  it("permite marcar votou depois do voto existir", async () => {
    const room = await seedRoom();
    await write(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token, { value: "8", at: 1 });

    const flag = await write(`rooms/${room.roomId}/presence/${room.guest.uid}/hasVoted`, room.guest.token, true);

    expect(flag.status).toBe(200);
  });

  it("nega código de sala fora do alfabeto", async () => {
    const host = await signIn();

    const created = await write("rooms/ABC123", host.token, {
      meta: { name: "Sprint 42", hostId: host.uid, revealed: false, round: 1, autoReveal: false },
      presence: { [host.uid]: presence("Ana") },
    });

    expect(created.status).toBe(401);
  });

  it("nega chave desconhecida no meta", async () => {
    const room = await seedRoom();

    const injected = await write(`rooms/${room.roomId}/meta/injected`, room.host.token, "payload");

    expect(injected.status).toBe(401);
  });

  it("nega chave desconhecida na presença", async () => {
    const room = await seedRoom();

    const injected = await write(`rooms/${room.roomId}/presence/${room.guest.uid}/injected`, room.guest.token, 1);

    expect(injected.status).toBe(401);
  });

  it("aceita acento e emoji no nome da sala e na presença", async () => {
    const room = await seedRoom();
    const name = "José 😀";

    const roomName = await write(`rooms/${room.roomId}/meta/name`, room.host.token, name);
    const presenceName = await write(`rooms/${room.roomId}/presence/${room.guest.uid}/name`, room.guest.token, name);

    expect(roomName.status).toBe(200);
    expect(presenceName.status).toBe(200);
  });

  it("nega caractere de controle no nome", async () => {
    const room = await seedRoom();

    const roomName = await write(`rooms/${room.roomId}/meta/name`, room.host.token, "Ana\u0007Silva");
    const presenceName = await write(
      `rooms/${room.roomId}/presence/${room.guest.uid}/name`,
      room.guest.token,
      "Bruno\u0000",
    );

    expect(roomName.status).toBe(401);
    expect(presenceName.status).toBe(401);
  });

  it("nega marca de bidi no nome", async () => {
    const room = await seedRoom();

    const override = await write(`rooms/${room.roomId}/meta/name`, room.host.token, "Ana\u202ESilva");
    const isolate = await write(
      `rooms/${room.roomId}/presence/${room.guest.uid}/name`,
      room.guest.token,
      "Bruno\u2066",
    );

    expect(override.status).toBe(401);
    expect(isolate.status).toBe(401);
  });

  it("nega caractere de largura zero no nome", async () => {
    const room = await seedRoom();

    const zeroWidthSpace = await write(`rooms/${room.roomId}/meta/name`, room.host.token, "Ana\u200BSilva");
    const wordJoiner = await write(
      `rooms/${room.roomId}/presence/${room.guest.uid}/name`,
      room.guest.token,
      "Bruno\u2060",
    );

    expect(zeroWidthSpace.status).toBe(401);
    expect(wordJoiner.status).toBe(401);
  });

  it("host apaga presença obsoleta de terceiro", async () => {
    const room = await seedRoom();

    const offline = await write(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.guest.token, {
      ...presence("Bruno"),
      online: false,
      lastSeen: 1,
    });
    expect(offline.status).toBe(200);

    const pruned = await erase(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.host.token);

    expect(pruned.status).toBe(200);
    const readBack = await read(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.host.token);
    expect(readBack.body).toBeNull();
  });

  it("host não apaga presença recente", async () => {
    const room = await seedRoom();

    await write(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.guest.token, {
      ...presence("Bruno"),
      online: false,
      lastSeen: Date.now(),
    });

    const pruned = await erase(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.host.token);

    expect(pruned.status).toBe(401);
  });

  it("host não apaga presença marcada como online", async () => {
    const room = await seedRoom();

    await write(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.guest.token, {
      ...presence("Bruno"),
      online: true,
      lastSeen: 1,
    });

    const pruned = await erase(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.host.token);

    expect(pruned.status).toBe(401);
  });

  it("convidado não apaga presença alheia", async () => {
    const room = await seedRoom();
    const other = await signIn();
    await write(`rooms/${room.roomId}/presence/${other.uid}`, other.token, {
      ...presence("Carla"),
      online: false,
      lastSeen: 1,
    });

    const byGuest = await erase(`rooms/${room.roomId}/presence/${other.uid}`, room.guest.token);
    const byHostTarget = await erase(`rooms/${room.roomId}/presence/${room.host.uid}`, room.guest.token);

    expect(byGuest.status).toBe(401);
    expect(byHostTarget.status).toBe(401);
  });

  it("ninguém apaga a própria presença", async () => {
    const room = await seedRoom();

    await write(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.guest.token, {
      ...presence("Bruno"),
      online: false,
      lastSeen: 1,
    });

    const guestSelf = await erase(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.guest.token);
    const hostSelf = await erase(`rooms/${room.roomId}/presence/${room.host.uid}`, room.host.token);

    expect(guestSelf.status).toBe(401);
    expect(hostSelf.status).toBe(401);
  });

  it("presença do host fica protegida da poda", async () => {
    const room = await seedRoom();
    await write(`rooms/${room.roomId}/presence/${room.host.uid}`, room.host.token, {
      ...presence("Ana"),
      online: false,
      lastSeen: 1,
    });

    const other = await signIn();
    await write(`rooms/${room.roomId}/presence/${other.uid}`, other.token, presence("Carla"));

    const prunedByGuest = await erase(`rooms/${room.roomId}/presence/${room.host.uid}`, other.token);
    const prunedByHost = await erase(`rooms/${room.roomId}/presence/${room.host.uid}`, room.host.token);

    expect(prunedByGuest.status).toBe(401);
    expect(prunedByHost.status).toBe(401);
  });

  it("nega auto-delete do próprio voto", async () => {
    const room = await seedRoom();
    await write(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token, { value: "8", at: 1 });

    const selfDeleted = await erase(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token);
    expect(selfDeleted.status).toBe(401);
  });

  it("nega host apagar voto no meio da rodada", async () => {
    const room = await seedRoom();
    await seedVotes(room);

    const cleared = await erase(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.host.token);
    expect(cleared.status).toBe(401);
  });

  it("permite host apagar voto depois do reveal", async () => {
    const room = await seedRoom();
    await seedVotes(room);
    await sendReveal(room);

    const cleared = await erase(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.host.token);
    expect(cleared.status).toBe(200);
  });

  it("permite host apagar voto de membro obsoleto com hasVoted falso", async () => {
    const room = await seedRoom();

    const stale = await write(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.guest.token, {
      ...presence("Bruno"),
      online: false,
      lastSeen: 1,
    });
    expect(stale.status).toBe(200);
    await write(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token, { value: "8", at: 1 });

    const cleared = await erase(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.host.token);
    expect(cleared.status).toBe(200);
  });

  it("permite host apagar voto órfão sem presença", async () => {
    const room = await seedRoom();

    // Voto órfão: presença podada deixa `presence/{uid}` inexistente; a regra
    // trata a ausência como obsoleto e libera a limpeza pelo host.
    const dropped = await erase(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.guest.token);
    expect(dropped.status).toBe(401); // regra de host com lastSeen recente nega
    await write(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.guest.token, {
      ...presence("Bruno"),
      online: false,
      lastSeen: 1,
    });
    await write(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token, { value: "8", at: 1 });

    const cleared = await erase(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.host.token);
    expect(cleared.status).toBe(200);
  });

  it("host não apaga voto de membro online", async () => {
    const room = await seedRoom();

    const online = await write(`rooms/${room.roomId}/presence/${room.guest.uid}`, room.guest.token, {
      ...presence("Bruno"),
      online: true,
      lastSeen: Date.now(),
    });
    expect(online.status).toBe(200);
    await write(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.guest.token, { value: "8", at: 1 });

    const cleared = await erase(`rooms/${room.roomId}/votes/${room.guest.uid}`, room.host.token);
    expect(cleared.status).toBe(401);
  });

  it("não-host não apaga voto de terceiro offline", async () => {
    const room = await seedRoom();

    const stale = await write(`rooms/${room.roomId}/presence/${room.host.uid}`, room.host.token, {
      ...presence("Ana"),
      online: false,
      lastSeen: 1,
    });
    expect(stale.status).toBe(200);
    await write(`rooms/${room.roomId}/votes/${room.host.uid}`, room.host.token, { value: "5", at: 1 });

    // O guest só pode apagar votos com a rodada revelada; com `revealed` falso,
    // nem presença e nem `hasVoted` importam.
    const cleared = await erase(`rooms/${room.roomId}/votes/${room.host.uid}`, room.guest.token);
    expect(cleared.status).toBe(401);
  });

  it("nega leitura de votos por quem não entrou na sala", async () => {
    const room = await seedRoom();
    await seedVotes(room);
    await sendReveal(room);

    const stranger = await signIn();
    const votes = await read(`rooms/${room.roomId}/votes`, stranger.token);
    const own = await read(`rooms/${room.roomId}/votes/${room.host.uid}`, stranger.token);

    expect(votes.status).toBe(401);
    expect(own.status).toBe(401);
  });

  it("nega timestamp de presença no futuro", async () => {
    const room = await seedRoom();

    const future = await write(`rooms/${room.roomId}/presence/${room.guest.uid}/lastSeen`, room.guest.token, Date.now() + 1_000_000);
    expect(future.status).toBe(401);
  });

  it("nega payload gigante em campo de voto", async () => {
    const room = await seedRoom();
    const bigValue = "x".repeat(4_000_000);

    const tooBig = await write(`rooms/${room.roomId}/votes/${room.guest.uid}/at`, room.guest.token, bigValue);
    expect(tooBig.status).toBe(401);
  });

  it("rejeita criação de sala com votes e lixo", async () => {
    const host = await signIn();
    const roomId = roomCode();

    const created = await write(`rooms/${roomId}`, host.token, {
      meta: { name: "Sprint 42", hostId: host.uid, revealed: false, round: 1, autoReveal: false },
      presence: { [host.uid]: presence("Ana") },
      votes: { fake: { value: "5", at: 1 } },
      junk: "quatro megas de nonsense".repeat(100_000),
    });

    expect(created.status).toBe(401);
  });

  it("nega não-host gravando ou apagando histórico", async () => {
    const room = await seedRoom();
    await sendReveal(room);
    await write(`rooms/${room.roomId}/meta/history/1`, room.host.token, 5);

    const forged = await write(`rooms/${room.roomId}/meta/history/2`, room.guest.token, 8);
    const erased = await erase(`rooms/${room.roomId}/meta/history/1`, room.guest.token);

    expect(forged.status).toBe(401);
    expect(erased.status).toBe(401);
  });

  it("nega histórico com a rodada escondida", async () => {
    const room = await seedRoom();

    const early = await write(`rooms/${room.roomId}/meta/history/1`, room.host.token, 5);

    expect(early.status).toBe(401);
  });

  it("nega chave inválida no histórico", async () => {
    const room = await seedRoom();
    await sendReveal(room);

    const word = await write(`rooms/${room.roomId}/meta/history/abc`, room.host.token, 5);
    const zero = await write(`rooms/${room.roomId}/meta/history/0`, room.host.token, 5);
    const padded = await write(`rooms/${room.roomId}/meta/history/02`, room.host.token, 5);

    expect(word.status).toBe(401);
    expect(zero.status).toBe(401);
    expect(padded.status).toBe(401);
  });

  it("nega valor inválido no histórico", async () => {
    const room = await seedRoom();
    await sendReveal(room);

    const text = await write(`rooms/${room.roomId}/meta/history/1`, room.host.token, "5");
    const tooBig = await write(`rooms/${room.roomId}/meta/history/1`, room.host.token, 1000);
    const negative = await write(`rooms/${room.roomId}/meta/history/1`, room.host.token, -1);

    expect(text.status).toBe(401);
    expect(tooBig.status).toBe(401);
    expect(negative.status).toBe(401);
  });

  it("host grava a média da rodada revelada", async () => {
    const room = await seedRoom();
    await sendReveal(room);

    const saved = await write(`rooms/${room.roomId}/meta/history/1`, room.host.token, 6.5);
    expect(saved.status).toBe(200);

    const readBack = await read(`rooms/${room.roomId}/meta/history/1`, room.guest.token);

    expect(readBack.status).toBe(200);
    expect(readBack.body).toBe(6.5);
  });

  it("escrita no histórico não derruba o validate do meta", async () => {
    const room = await seedRoom();
    await sendReveal(room);

    const saved = await write(`rooms/${room.roomId}/meta/history/1`, room.host.token, 6.5);
    expect(saved.status).toBe(200);

    const meta = await read(`rooms/${room.roomId}/meta`, room.guest.token);
    expect(meta.status).toBe(200);
    expect(Object.keys(meta.body as Record<string, unknown>).sort()).toEqual([
      "autoReveal",
      "history",
      "hostId",
      "name",
      "revealed",
      "round",
    ]);

    // O meta continua aceitando as escritas normais do host depois da entrada nova.
    const closed = await write(`rooms/${room.roomId}/meta/revealed`, room.host.token, false);
    const next = await write(`rooms/${room.roomId}/meta/round`, room.host.token, 2);

    expect(closed.status).toBe(200);
    expect(next.status).toBe(200);
  });

  it("host poda entrada antiga com a rodada revelada", async () => {
    const room = await seedRoom();
    await sendReveal(room);
    await write(`rooms/${room.roomId}/meta/history/1`, room.host.token, 5);

    const pruned = await erase(`rooms/${room.roomId}/meta/history/1`, room.host.token);

    expect(pruned.status).toBe(200);
    const readBack = await read(`rooms/${room.roomId}/meta/history`, room.host.token);
    expect(readBack.body).toBeNull();
  });
});

async function sendReveal(room: SeededRoom): Promise<void> {
  const reveal = await write(`rooms/${room.roomId}/meta/revealed`, room.host.token, true);
  expect(reveal.status).toBe(200);
}
