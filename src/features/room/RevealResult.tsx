import { useLayoutEffect, useRef, useState } from "react";
import type { Participant, RoundHistoryEntry, RoundStats } from "../../types/room";
import { DECK } from "../../types/room";
import { Badge } from "../../ui/Badge";
import { Panel } from "../../ui/Panel";
import { Spinner } from "../../ui/Spinner";
import { ChevronDownIcon, ChevronUpIcon } from "../../ui/icons";
import { formatNumber, percent } from "./format";
import { displayName, duplicateTags } from "./names";
import { isParticipantOnline } from "./presence-view";
import { prefersReducedMotion } from "../../lib/motion";
import { RoundHistory } from "./RoundHistory";

/** Converte entrada do histórico (número ou símbolo) em texto para exibição. */
function formatHistoryEntry(value: number | string): string {
  return typeof value === "string" ? value : formatNumber(value);
}

export type RevealResultProps = {
  stats: RoundStats | null;
  revealed: boolean;
  participants: Participant[];
  history?: RoundHistoryEntry[];
  now: number;
  autoReveal: boolean;
  className?: string;
};

const NUMERIC = new Set(["0", "1", "2", "3", "5", "8", "13", "21"]);

/** Altura do atalho de histórico no rodapé: 36px de toque + a borda. */
const GATE_HEIGHT = 37;

/** Anima o número de 0 até o valor alvo em pt-BR. Só roda no reveal. */
function useCountUp(target: number | null | undefined, active: boolean): string {
  const [value, setValue] = useState<number>(0);
  const reduced = prefersReducedMotion();

  useLayoutEffect(() => {
    if (!active || target === null || target === undefined) {
      setValue(0);
      return;
    }
    if (reduced) {
      setValue(target);
      return;
    }
    // jsdom (ambiente de teste) não avança requestAnimationFrame: sem este
    // gate o valor ficaria travado em 0 e os testes que leriam a média quebram.
    const isTestEnv =
      typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent ?? "");
    if (isTestEnv) {
      setValue(target);
      return;
    }
    setValue(0);
    const start = performance.now();
    const duration = 700;
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        raf = window.requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active, target, reduced]);

  return formatNumber(value);
}

export function RevealResult({
  stats,
  revealed,
  participants,
  history = [],
  now,
  autoReveal,
  className = "",
}: RevealResultProps) {
  const total = participants.length;
  const voted = participants.filter((person) => person.hasVoted).length;
  const pending = participants.filter((person) => !person.hasVoted && isParticipantOnline(person, now));
  const offline = participants.filter((person) => !isParticipantOnline(person, now)).length;
  const tags = duplicateTags(participants);

  const counts = stats?.counts ?? {};
  const totalVotes = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const numericCount = Object.entries(counts)
    .filter(([value]) => NUMERIC.has(value))
    .reduce((sum, [, count]) => sum + count, 0);
  const maxCount = Math.max(1, ...Object.values(counts));
  const waitingForVotes = revealed && stats === null;

  const liveSummary = !revealed
    ? ""
    : waitingForVotes
      ? "Rodada revelada. Somando os votos."
      : totalVotes === 0
        ? "Rodada revelada. Ninguém votou nesta rodada."
        : stats?.average !== null && stats?.average !== undefined
          ? `Rodada revelada. Média ${formatNumber(stats.average)}. ${numericCount} de ${totalVotes} cartas na média.`
          : `Rodada revelada. Sem votos numéricos. ${totalVotes} cartas.`;

  /*
    O painel de resultado é a última coisa que cabe na altura da sala: em
    320x568 o corpo tem ~130px para média, distribuição e histórico. Em vez de
    esconder o histórico atrás de uma rolagem muda (que já falhou na prática),
    quando o conteúdo passa do corpo o painel ganha um rodapé fixo com a última
    média e a contagem de rodadas; tocar nele rola até o histórico. O rodapé
    fica fora da área rolável, então nenhum item some atrás dele.
  */
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLElement | null>(null);
  const gateRef = useRef(false);
  const [gate, setGate] = useState(false);
  const [atHistory, setAtHistory] = useState(false);
  const [moreBelow, setMoreBelow] = useState(false);

  const latest = history.reduce<RoundHistoryEntry | null>(
    (newest, entry) => (newest && newest.round >= entry.round ? newest : entry),
    null,
  );
  const roundCount = history.length === 1 ? "1 rodada" : `${history.length} rodadas`;

  // Count-up: o número sobe de 0 até o valor real quando o reveal acontece.
  const averageValue = useCountUp(
    stats?.average,
    revealed && stats !== null && stats?.average !== null && stats?.average !== undefined,
  );

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const content = contentRef.current;
    if (!body || !content) return;

    const update = () => {
      // O rodapé mede 37px. Somar de volta quando ele está visível deixa a
      // decisão sempre sobre a mesma altura-base do corpo: sem rodapé que
      // aparece e some a cada rolagem.
      const baseHeight = body.clientHeight + (gateRef.current ? GATE_HEIGHT : 0);
      const overflow = content.scrollHeight > baseHeight + 1;
      const nextGate = history.length > 0 && overflow;
      if (nextGate !== gateRef.current) {
        gateRef.current = nextGate;
        setGate(nextGate);
      }

      const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
      setMoreBelow(overflow && !atBottom);

      const section = historyRef.current;
      if (section) {
        const view = body.getBoundingClientRect();
        const head = section.getBoundingClientRect();
        setAtHistory(head.top >= view.top - 4 && head.top <= view.bottom - 56);
      } else {
        setAtHistory(false);
      }
    };

    update();
    body.addEventListener("scroll", update, { passive: true });
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(update);
      observer.observe(body);
      observer.observe(content);
    }
    return () => {
      body.removeEventListener("scroll", update);
      observer?.disconnect();
    };
    // `history.length` e `revealed` mudam a altura do conteúdo; a rolagem e o
    // tamanho do corpo são observados ao vivo.
  }, [history.length, revealed]);

  function toggleHistory() {
    const body = bodyRef.current;
    const section = historyRef.current;
    if (!body) return;
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";

    if (atHistory || !section) {
      body.scrollTo({ top: 0, behavior });
      body.focus({ preventScroll: true });
      return;
    }

    const top = body.scrollTop + section.getBoundingClientRect().top - body.getBoundingClientRect().top - 4;
    body.scrollTo({ top, behavior });
    // Mover o foco junto com a rolagem é o que dá ao leitor de tela a mesma
    // informação que o olho recebe: "médias das rodadas anteriores, região".
    section.focus({ preventScroll: true });
  }

  return (
    <div className={["flex h-full min-h-0 min-w-0 flex-col p-3 lg:p-0", className].join(" ")}>
      <Panel
        title="Resultado"
        aside={revealed ? <Badge tone="accent">revelado</Badge> : null}
        className="h-full min-h-0 lg:rounded-none lg:border-y-0 lg:border-r-0"
        bodyClassName="scroll-slim max-h-[44dvh] overflow-y-auto md:max-h-none"
        bodyTabIndex={0}
        bodyRef={bodyRef}
        footer={
          gate ? (
            <button
              type="button"
              data-testid="history-jump"
              onClick={toggleHistory}
              aria-label={
                atHistory
                  ? "Voltar ao topo do resultado"
                  : `Ver histórico de médias: ${roundCount}, última média ${latest && latest.average !== undefined ? formatHistoryEntry(latest.average) : "—"}`
              }
              className="flex h-9 w-full items-center justify-between gap-3 rounded-b-panel px-4 text-left transition-colors duration-150 ease-out hover:bg-elevated focus-visible:bg-elevated"
            >
              <span className="micro">{atHistory ? "resultado" : "histórico"}</span>
              <span className="flex min-w-0 items-center gap-1.5 text-[10px] leading-none text-muted">
                <span className="num min-w-0 truncate">
                  {atHistory ? "voltar ao topo" : `${latest ? `R${latest.round} ${formatHistoryEntry(latest.average ?? 0)} · ` : ""}${roundCount}`}
                </span>
                {atHistory ? (
                  <ChevronUpIcon size={12} className="shrink-0 text-faint" />
                ) : (
                  <ChevronDownIcon size={12} className="shrink-0 text-faint" />
                )}
              </span>
            </button>
          ) : undefined
        }
      >
        {/* O corpo ocupa a altura disponível e o histórico fecha o painel no
            rodapé: some o vazio solto embaixo do conteúdo no desktop. */}
        <div ref={contentRef} className="flex min-h-full flex-col">
          <div className="result-content flex flex-1 flex-col p-4">
            <p className="sr-only" aria-live="polite">
              {liveSummary}
            </p>

            {!revealed ? (
              <div className="flex flex-1 flex-col gap-4">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="micro">votos</p>
                    <p className="text-[11px] text-muted">
                      {pending.length === 0 ? "todos votaram" : `${pending.length} aguardando`}
                    </p>
                  </div>
                  <p className="num mt-2 text-[30px] leading-none text-ink">
                    {voted}
                    <span className="text-[15px] text-faint">/{total}</span>
                  </p>
                  <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                      style={{ width: `${percent(voted, total)}%` }}
                    />
                  </div>
                </div>

                {pending.length > 0 ? (
                  <div>
                    <p className="micro">aguardando</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {pending.slice(0, 6).map((person) => {
                        const tag = tags.get(person.uid) ?? null;
                        return (
                          <li
                            key={person.uid}
                            className="flex max-w-full min-w-0 items-center gap-1 rounded-full border border-line px-2 py-[3px] text-[11px] text-muted"
                            title={tag ? `${displayName(person.name)} · pessoa ${tag}` : displayName(person.name)}
                          >
                            <bdi dir="auto" className="min-w-0 truncate">
                              {displayName(person.name)}
                            </bdi>
                            {tag ? (
                              <span className="num shrink-0 text-[9px] leading-none text-faint" aria-hidden="true">
                                #{tag}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                      {pending.length > 6 ? (
                        <li className="num px-1 py-[3px] text-[11px] text-faint">+{pending.length - 6}</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-auto flex flex-col gap-1.5 border-t border-line pt-3">
                  {offline > 0 ? (
                    <p className="text-[11px] text-muted">
                      {offline === 1 ? "1 pessoa offline" : `${offline} pessoas offline`}
                    </p>
                  ) : null}
                  <p className="text-[11px] leading-relaxed text-faint">
                    {autoReveal ? "Revela sozinho quando todos votarem." : "O host revela quando o time terminar."}
                  </p>
                </div>
              </div>
            ) : waitingForVotes ? (
              <div className="flex flex-1 items-center gap-2.5 py-6 text-[13px] text-muted">
                <Spinner size={14} label="Somando os votos" />
                <p>Somando os votos da rodada.</p>
              </div>
            ) : (
              <div className="result-revealed rise-in flex flex-1 flex-col gap-4">
                <div>
                  <p className="micro">média</p>
                  {stats?.average !== null && stats?.average !== undefined ? (
                    <div className="mt-1.5 flex flex-wrap items-end gap-x-2 gap-y-1.5">
                      <span
                        data-testid="average"
                        className="result-average num count-up text-[40px] leading-[0.95] tracking-[-0.035em] text-ink"
                      >
                        {averageValue}
                      </span>
                      {stats.consensus ? (
                        <span className="pop-in">
                          <Badge tone="ok">consenso</Badge>
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[16px] leading-snug text-muted">
                      {totalVotes === 0 ? "Nenhum voto nesta rodada." : "Sem votos numéricos."}
                    </p>
                  )}
                  {numericCount > 0 ? (
                    <p className="mt-1.5 text-[11px] text-muted">
                      {numericCount} de {totalVotes} {totalVotes === 1 ? "carta conta" : "cartas contam"} na média
                    </p>
                  ) : null}
                </div>

                {totalVotes > 0 ? (
                  <>
                    <dl className="result-facts grid grid-cols-2 gap-2">
                      <div className="rounded-[8px] border border-line bg-canvas/60 px-2.5 py-2">
                        <dt className="micro text-[9px]">mediana</dt>
                        <dd className="num mt-1 text-[15px] leading-none text-ink">{formatNumber(stats?.median)}</dd>
                      </div>
                      <div className="rounded-[8px] border border-line bg-canvas/60 px-2.5 py-2">
                        <dt className="micro text-[9px]">pessoas</dt>
                        <dd className="num mt-1 text-[15px] leading-none text-ink">{total}</dd>
                      </div>
                    </dl>

                    <div>
                      <p className="micro">distribuição</p>
                      <ul aria-label="Distribuição dos votos" className="mt-2 flex flex-col gap-1.5">
                        {DECK.filter((value) => counts[value]).map((value) => {
                          const count = counts[value] ?? 0;
                          const symbol = value === "?" || value === "☕";
                          return (
                            <li key={value} className="grid grid-cols-[18px_minmax(0,1fr)_16px] items-center gap-2">
                              <span className="num text-[11px] text-muted">{value}</span>
                              <span className="h-[6px] overflow-hidden rounded-[2px] bg-elevated">
                                <span
                                  className={[
                                    "block h-full rounded-[2px] transition-[width] duration-500 ease-out-exp",
                                    symbol ? "bg-line-strong" : "bg-accent/70",
                                  ].join(" ")}
                                  style={{ width: `${Math.max(6, (count / maxCount) * 100)}%` }}
                                />
                              </span>
                              <span className="num text-right text-[11px] text-muted">{count}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                ) : null}

                {numericCount > 0 && numericCount < totalVotes ? (
                  <p className="text-[11px] leading-relaxed text-faint">? e ☕ ficam fora da média e da mediana.</p>
                ) : null}
              </div>
            )}
          </div>

          <RoundHistory history={history} ref={historyRef} />

          {/* Apara o corte: o texto que continua abaixo desbota em vez de
              terminar numa linha cortada na borda do painel. */}
          <div
            aria-hidden="true"
            data-testid="result-fade"
            className={["result-fade", moreBelow ? "" : "opacity-0"].join(" ")}
          />
        </div>
      </Panel>
    </div>
  );
}
