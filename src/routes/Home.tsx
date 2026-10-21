import { useRef, useState } from "react";
import { Brand } from "../ui/Brand";
import { Input } from "../ui/Input";
import { Panel } from "../ui/Panel";
import { CreateRoomForm } from "../features/home/CreateRoomForm";
import { JoinRoomForm } from "../features/home/JoinRoomForm";
import { loadStoredName, storeName } from "../features/home/name-storage";
import { isKicked } from "../lib/kicks";
import { KickScreen } from "../features/home/KickScreen";
import {
  keepCodeChars,
  limitField,
  limitName,
  normalizeCode,
  validateCode,
  validateName,
  validateRoomName,
} from "../features/home/validation";

export type HomeProps = {
  onCreate: (roomName: string, userName: string) => void | Promise<void>;
  onJoin: (code: string, userName: string) => void | Promise<void>;
  createError?: string | null;
  joinError?: string | null;
};

const PREVIEW_DECK = ["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"];

const STEPS = [
  "Crie a sala e mande o link para o time.",
  "Cada pessoa escolhe uma carta sem ver a dos outros.",
  "O host revela. O time compara média, mediana e consenso.",
];

/** Ícones minimalistas em SVG inline para cada passo. */
function StepIcon({ path }: { path: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-muted"
    >
      <path d={path} />
    </svg>
  );
}

const STEP_ICONS = [
  <StepIcon key="0" path="M3 3h10v10H3zM5 7h6M5 10h4" />,
  <StepIcon key="1" path="M8 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />,
  <StepIcon key="2" path="M8 2v10M4 7h8M4 11h8" />,
];

export function Home({ onCreate, onJoin, createError, joinError }: HomeProps) {
  const [name, setName] = useState(() => limitName(loadStoredName()));
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [kickDenied, setKickDenied] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function checkName(): boolean {
    const problem = validateName(name);
    setNameError(problem);
    if (problem) {
      nameRef.current?.focus();
      return false;
    }
    return true;
  }

  async function submitCreate() {
    const nameOk = checkName();
    const roomProblem = validateRoomName(roomName);
    setRoomError(roomProblem);
    if (!nameOk || roomProblem) return;

    const finalName = limitName(name);
    storeName(finalName);
    setPending("create");
    setRoomError(null);
    try {
      await onCreate(limitName(roomName), finalName);
    } catch (error) {
      if (error instanceof Error && error.message === "Muitas salas criadas. Aguarde um momento e tente de novo.") {
        setRoomError("Muitas salas criadas. Aguarde um momento e tente de novo.");
      }
    } finally {
      setPending(null);
    }
  }

  async function submitJoin() {
    const nameOk = checkName();
    const codeProblem = validateCode(code);
    setCodeError(codeProblem);
    if (!nameOk || codeProblem) return;

    const finalName = limitName(name);
    storeName(finalName);

    // Verifica se o nome está bloqueado por expulsão
    if (isKicked(finalName)) {
      setKickDenied(true);
      return;
    }

    setPending("join");
    try {
      await onJoin(normalizeCode(code), finalName);
    } finally {
      setPending(null);
    }
  }

  function handleKickTryAgain(newName: string) {
    setName(newName);
    setKickDenied(false);
    // Tenta entrar automaticamente com o novo nome se houver um código preenchido
    if (code.trim()) {
      void submitJoinWith(newName, code);
    }
  }

  async function submitJoinWith(finalName: string, codeValue: string) {
    setPending("join");
    try {
      await onJoin(normalizeCode(codeValue), finalName);
    } finally {
      setPending(null);
    }
  }

  if (kickDenied) {
    return <KickScreen onTryAgain={handleKickTryAgain} />;
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Fundo: grade pontilhada em deriva lenta + glow radial atrás do hero. */}
      <div aria-hidden="true" className="home-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[320px] -left-[240px] h-[640px] w-[640px] rounded-full opacity-[0.55]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(217,160,91,0.10), rgba(217,160,91,0.035) 55%, transparent 72%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 -right-[280px] h-[560px] w-[560px] rounded-full opacity-[0.4]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(217,160,91,0.07), rgba(217,160,91,0.025) 55%, transparent 72%)",
        }}
      />

      <main className="relative mx-auto flex w-full max-w-[1180px] flex-col gap-9 px-5 py-8 sm:px-8 sm:py-12 lg:grid lg:min-h-dvh lg:grid-cols-[minmax(0,1fr)_408px] lg:content-center lg:gap-y-0 lg:gap-x-20 lg:py-20">
        <div className="order-1 flex flex-col gap-7 lg:col-start-1 lg:row-start-1">
          <Brand />

          <div className="hero-enter flex max-w-[540px] flex-col gap-4">
            <h1 className="font-display text-[34px] leading-[1.06] font-semibold tracking-[-0.035em] text-balance sm:text-[46px] lg:text-[56px]">
              Estimem sem{" "}
              <span className="relative inline-block whitespace-nowrap text-accent">
                se influenciar
                <svg
                  aria-hidden="true"
                  className="absolute -bottom-[0.12em] left-0 h-[3px] w-full text-accent/55"
                  viewBox="0 0 240 6"
                  preserveAspectRatio="none"
                  fill="none"
                >
                  <path d="M2 4.5C60 1.5 180 1.5 238 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              .
            </h1>
            <p className="max-w-[46ch] text-[15px] leading-[1.65] text-muted">
              Cada pessoa escolhe uma carta em segredo. A média, a mediana e o consenso aparecem quando o host
              revela, com todos os votos abertos ao mesmo tempo.
            </p>
          </div>
        </div>

        <div className="order-2 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-center">
          <Panel bodyClassName="p-5 sm:p-6">
            <div className="flex flex-col gap-6">
              <Input
                ref={nameRef}
                id="pp-nome"
                label="Seu nome"
                value={name}
                onChange={(event) => setName(limitField(event.target.value))}
                onBlur={() => setNameError(validateName(name))}
                error={nameError ?? undefined}
                hint="Fica salvo neste navegador."
                autoComplete="name"
                enterKeyHint="next"
              />

              <div className="h-px bg-line" />

              <CreateRoomForm
                roomName={roomName}
                onRoomNameChange={(value) => {
                  setRoomName(limitField(value));
                  if (roomError) setRoomError(null);
                }}
                error={roomError}
                serverError={createError}
                pending={pending === "create"}
                onSubmit={submitCreate}
              />

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="micro">ou</span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <JoinRoomForm
                code={code}
                onCodeChange={(value) => {
                  setCode(keepCodeChars(value));
                  if (codeError) setCodeError(null);
                }}
                error={codeError}
                serverError={joinError}
                pending={pending === "join"}
                onSubmit={submitJoin}
              />
            </div>
          </Panel>
        </div>

        <div className="order-3 flex flex-col gap-6 lg:col-start-1 lg:row-start-2 lg:mt-10">
          <div aria-hidden="true" className="preview-deck flex items-end gap-1.5">
            {PREVIEW_DECK.map((value, index) => {
              const selected = value === "8";
              return (
                <span
                  key={value}
                  className={[
                    "num deal-in grid h-9 w-7 place-items-center rounded-[6px] border text-[12px] sm:h-11 sm:w-8 sm:text-[13px]",
                    selected
                      ? "z-10 -translate-y-2.5 border-accent bg-[#1d1811] text-accent shadow-[0_10px_24px_-10px_rgba(217,160,91,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "border-line bg-elevated text-muted",
                  ].join(" ")}
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  {value}
                </span>
              );
            })}
          </div>
        </div>

        <div className="order-4 flex flex-col gap-3 lg:col-start-1 lg:row-start-3 lg:mt-5">
          <h2 className="micro">Como funciona</h2>
          <ol className="flex flex-col">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-4 border-t border-line py-2.5 last:border-b">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-line bg-elevated">
                  {STEP_ICONS[index]}
                </span>
                <span className="text-[13px] leading-relaxed text-muted">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-[12px] text-faint">Sem cadastro. A sala existe enquanto houver gente nela.</p>
        </div>
      </main>
    </div>
  );
}
