import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CardValue } from "../types/room";
import { useRoom } from "../app/room-context";
import { Brand } from "../ui/Brand";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Panel } from "../ui/Panel";
import { Spinner } from "../ui/Spinner";
import { AlertIcon, SearchIcon } from "../ui/icons";
import { limitField, limitName, validateName } from "../features/home/validation";
import { friendlyError } from "../features/room/errors";
import { displayName, displayRoomCode, duplicateTags } from "../features/room/names";
import { RoomHeader } from "../features/room/RoomHeader";
import { ParticipantsSidebar } from "../features/room/ParticipantsSidebar";
import { ConnectionBanner } from "../features/room/ConnectionBanner";
import { VoteDeck } from "../features/room/VoteDeck";
import { RevealResult } from "../features/room/RevealResult";
import { HostControls } from "../features/room/HostControls";
import { RevealBoard } from "../features/room/RevealBoard";
import { isParticipantOnline } from "../features/room/presence-view";
import { KickScreen } from "../features/home/KickScreen";

type GateKind = "connecting" | "not-found" | "error";

const ENTER_FALLBACK = "Não foi possível entrar na sala. Tente de novo.";
const ACTION_FALLBACK = "Não foi possível concluir. Confira a conexão e tente de novo.";

function RoomGate({ kind, roomId }: { kind: GateKind; roomId: string }) {
  const navigate = useNavigate();
  const code = displayRoomCode(roomId);

  const content = {
    connecting: {
      icon: <Spinner size={18} label="Conectando" />,
      title: "Entrando na sala",
      body: (
        <>
          Abrindo <span className="num text-ink">{code}</span> e sincronizando as presenças.
        </>
      ),
    },
    "not-found": {
      icon: <SearchIcon size={18} />,
      title: "Sala não encontrada",
      body: (
        <>
          O código <span className="num text-ink">{code}</span> não existe ou a sala já foi encerrada. Confira se o
          link está completo.
        </>
      ),
    },
    error: {
      icon: <AlertIcon size={18} />,
      title: "Não foi possível abrir a sala",
      body: <>A conexão falhou antes de ler a sala. Tente de novo em instantes.</>,
    },
  }[kind];

  return (
    <div className="grid min-h-dvh grid-rows-[56px_1fr]">
      <div className="flex items-center border-b border-line px-4 sm:px-6">
        <Brand />
      </div>
      <main className="grid place-items-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <span className="grid h-11 w-11 place-items-center rounded-[12px] border border-line bg-surface text-muted">
            {content.icon}
          </span>
          <h1 className="mt-6 text-[22px] leading-tight font-medium tracking-[-0.02em]">{content.title}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{content.body}</p>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            {kind !== "connecting" ? (
              <Button onClick={() => navigate("/")}>Voltar ao início</Button>
            ) : null}
            {kind === "error" ? (
              <Button variant="ghost" onClick={() => window.location.reload()}>
                Tentar de novo
              </Button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

function NameGate({
  roomId,
  roomName,
  onJoin,
}: {
  roomId: string;
  roomName?: string | null;
  onJoin: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const roomLabel = roomName ? displayName(roomName, "") || null : null;

  async function submit() {
    const problem = validateName(name);
    setError(problem);
    if (problem) {
      inputRef.current?.focus();
      return;
    }

    const finalName = limitName(name);
    setServerError(null);
    setPending(true);
    try {
      await onJoin(finalName);
    } catch (failure) {
      setServerError(friendlyError(failure, ENTER_FALLBACK));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-dvh grid-rows-[56px_1fr]">
      <div className="flex items-center border-b border-line px-4 sm:px-6">
        <Brand />
      </div>
      <main className="grid place-items-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[22px] leading-tight font-medium tracking-[-0.02em]">Entrar na sala</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            {roomLabel ? (
              <>
                A sala{" "}
                <bdi dir="auto" className="font-medium break-words text-ink">
                  {roomLabel}
                </bdi>{" "}
                está aberta. Diga seu nome para aparecer no time e votar.
              </>
            ) : (
              <>Esta sala está aberta. Diga seu nome para aparecer no time e votar.</>
            )}
          </p>
          <p className="num mt-1.5 text-[11px] text-faint">{displayRoomCode(roomId)}</p>

          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="mt-6"
          >
            <Panel bodyClassName="p-5">
              <div className="flex flex-col gap-4">
                <Input
                  ref={inputRef}
                  id="pp-entrada-nome"
                  label="Seu nome"
                  value={name}
                  onChange={(event) => {
                    setName(limitField(event.target.value));
                    if (error) setError(null);
                  }}
                  onBlur={() => setError(validateName(name))}
                  error={error ?? undefined}
                  hint="Fica salvo neste navegador."
                  autoComplete="name"
                  enterKeyHint="go"
                  autoFocus
                />

                {serverError ? (
                  <p role="alert" className="text-[12px] leading-relaxed text-danger-text">
                    {serverError}
                  </p>
                ) : null}

                <Button type="submit" fullWidth loading={pending}>
                  Entrar na sala
                </Button>
              </div>
            </Panel>
          </form>
        </div>
      </main>
    </div>
  );
}

export function Room({ roomId }: { roomId: string }) {
  const { state, actions } = useRoom();
  const [now, setNow] = useState(() => Date.now());
  const [connected, setConnected] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [notice, setNotice] = useState<string | null>(null);
  const [reconnected, setReconnected] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [kickScreen, setKickScreen] = useState(false);
  const lastHost = useRef<string | null>(null);
  const lastAction = useRef<(() => Promise<void>) | null>(null);
  const wasOffline = useRef(typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setConnected(true);
      if (wasOffline.current) setReconnected(true);
      wasOffline.current = false;
    };
    const goOffline = () => {
      setConnected(false);
      wasOffline.current = true;
      setReconnected(false);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!reconnected) return;
    const timer = window.setTimeout(() => setReconnected(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [reconnected]);

  const meta = state.meta;
  const myUid = state.me?.uid ?? null;
  const hostId = meta?.hostId ?? null;
  const isHost = Boolean(myUid && hostId && myUid === hostId);
  const host = state.participants.find((person) => person.uid === hostId) ?? null;
  const hostOnline = host ? isParticipantOnline(host, now) : false;

  // Host transfer: quando o hostId muda para o meu uid, mostro um aviso.
  // Quando muda para outro, o host atual assumiu sozinho sem aviso.
  useEffect(() => {
    if (!hostId || !myUid) return;
    const previous = lastHost.current;
    if (previous && previous !== hostId && hostId === myUid) {
      setNotice("Você assumiu a sala: o host anterior saiu.");
    }
    lastHost.current = hostId;
  }, [hostId, myUid]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 12_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Entrada automática leva alguns milissegundos. Segura o NameGate por um
  // instante para ele não piscar na tela de quem já tem nome salvo.
  const hasPresence = Boolean(state.me && state.me.name.trim());
  const [gateGraceOver, setGateGraceOver] = useState(hasPresence);

  useEffect(() => {
    if (hasPresence) {
      setGateGraceOver(true);
      return;
    }
    const timer = window.setTimeout(() => setGateGraceOver(true), 400);
    return () => window.clearTimeout(timer);
  }, [hasPresence]);



  // Quando o nome some do estado (foi expulso pelo host), mostra a tela de kick
  // em vez do NameGate. Só aciona se o usuário já foi presente antes — não no
  // carregamento inicial, quando o nome ainda não chegou do Firebase.
  // Detecta tanto state.me?.name === "" (mock) quanto state.me === null (firebase).
  const kickRef = useRef(false);
  const wasPresentRef = useRef(false);
  const kickGrace = useRef(0);
  useEffect(() => {
    if (state.status !== "ready" || !myUid) return;
    const hasName = Boolean(state.me?.name?.trim());
    if (hasName) {
      wasPresentRef.current = true;
      return;
    }
    // Só aciona o kick se o usuário já foi presente e depois foi expulso.
    if (!wasPresentRef.current) return;
    if (kickRef.current) return; // Já acionou
    kickRef.current = true;
    kickGrace.current = window.setTimeout(() => {
      setKickScreen(true);
    }, 1000);
    return () => window.clearTimeout(kickGrace.current);
  }, [state.status, myUid, state.me?.name]);

  if (state.status === "connecting") return <RoomGate kind="connecting" roomId={roomId} />;
  if (state.status === "not-found") return <RoomGate kind="not-found" roomId={roomId} />;
  if (state.status === "error" || !meta) return <RoomGate kind="error" roomId={roomId} />;

  // Sem presença com nome o usuário fica invisível e o voto é barrado pelas regras:
  // a entrada acontece por aqui antes de liberar o palco.
  const myName = state.me?.name.trim() ?? "";

  if (!state.me || !myName) {
    if (kickScreen) {
      return <KickScreen onTryAgain={async (newName) => {
        setKickScreen(false);
        kickRef.current = false;
        await actions.join(newName);
      }} />;
    }
    return gateGraceOver ? (
      <NameGate roomId={roomId} roomName={meta.name} onJoin={(value) => actions.join(value)} />
    ) : (
      <RoomGate kind="connecting" roomId={roomId} />
    );
  }

  const tags = duplicateTags(state.participants);
  const meParticipant = state.participants.find((person) => person.uid === myUid) ?? null;
  const identity = {
    name: meParticipant?.name ?? myName,
    color: meParticipant?.color ?? "#D9A05B",
    tag: myUid ? (tags.get(myUid) ?? null) : null,
    isHost,
  };
  const hostTag = host ? (tags.get(host.uid) ?? null) : null;

  const onlineCount = state.participants.filter((person) => isParticipantOnline(person, now)).length;
  const hostGone = !isHost && host !== null && !hostOnline;
  const bannerNotice =
    notice ?? (hostGone ? "Sem sinal do host. O comando passa para quem está online." : reconnected ? "Conexão restabelecida." : null);

  async function run(action: () => Promise<void>) {
    setActionError(null);
    lastAction.current = action;
    console.log("[Room] run action, action:", action.name);
    try {
      await action();
      lastAction.current = null;
      console.log("[Room] action completed, state:", { status: state.status, revealed: state.meta?.revealed, stats: state.stats });
    } catch (error) {
      setActionError(friendlyError(error, ACTION_FALLBACK));
    }
  }

  function retryLastAction() {
    const action = lastAction.current;
    if (action) void run(action);
  }

  return (
    // Altura fixa da viewport no app inteiro: a bandeja de voto é a ação
    // principal e não pode nascer abaixo da dobra em telas baixas.
    <div className="flex h-dvh flex-col">
      <RoomHeader
        name={meta.name}
        code={roomId}
        onlineCount={onlineCount}
        totalCount={state.participants.length}
        revealed={meta.revealed}
        round={meta.round}
        identity={identity}
      />

      <ConnectionBanner
        status={connected ? state.status : "offline"}
        notice={bannerNotice}
        onDismissNotice={() => setNotice(null)}
        onReload={() => window.location.reload()}
      />

      {actionError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-danger/30 bg-danger/10 px-4 py-2 text-center text-[12px] text-danger-text"
        >
          <span className="min-w-0">{actionError}</span>
          {lastAction.current ? (
            <button
              type="button"
              onClick={retryLastAction}
              className="text-[11px] font-medium underline underline-offset-2 hover:text-ink"
            >
              Tentar de novo
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-[11px] underline underline-offset-2 hover:text-ink"
          >
            Fechar aviso
          </button>
        </div>
      ) : null}

      <div className="room-layout mx-auto grid min-h-0 w-full max-w-[1440px] flex-1">
        <ParticipantsSidebar
          className="[grid-area:people]"
          participants={state.participants}
          revealed={meta.revealed}
          meUid={myUid}
          hostId={hostId}
          now={now}
          onKick={isHost ? (uid) => run(() => actions.kick(uid)) : undefined}
        />

        <RevealResult
          className="[grid-area:result]"
          stats={state.stats}
          revealed={meta.revealed}
          participants={state.participants}
          history={state.history}
          now={now}
          autoReveal={meta.autoReveal}
        />

        <main className="[grid-area:stage] flex min-h-0 min-w-0 flex-col md:px-6 md:py-6 lg:px-8 lg:py-8">
          {/* Cartas reveladas e bandeja formam um bloco ancorado no rodapé do
              palco: no desktop ele não flutua no meio do vazio e no mobile a
              ordem já era essa. A mesa vazia fica acima. */}
          <div className="room-stage-group mt-auto flex w-full flex-col gap-4 md:gap-5">
            <RevealBoard
              className="room-stage-board px-4 md:px-0"
              participants={state.participants}
              revealed={meta.revealed}
              meUid={myUid}
              now={now}
            />
            <div className="room-tray border-t border-line bg-surface/55 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-6 md:rounded-panel md:border md:border-line md:bg-surface/40 md:p-6 lg:p-8">
              <div className="room-tray-body flex w-full flex-col gap-4 min-[1280px]:mx-auto min-[1280px]:max-w-[720px]">
                <div className="order-1 lg:order-2">
                  <HostControls
                    isHost={isHost}
                    revealed={meta.revealed}
                    autoReveal={meta.autoReveal}
                    hostName={host?.name ?? null}
                    hostTag={hostTag}
                    onReveal={() => run(actions.reveal)}
                    onNewRound={() => run(actions.newRound)}
                    onToggleAutoReveal={(next) => run(() => actions.setAutoReveal(next))}
                  />
                </div>

                <div className="order-2 lg:order-1">
                  <VoteDeck
                    myVote={state.myVote}
                    revealed={meta.revealed}
                    onVote={(value: CardValue) => run(() => actions.vote(value))}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
