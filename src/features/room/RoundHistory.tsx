import { useEffect, useState } from "react";
import type { Ref } from "react";
import type { RoundHistoryEntry } from "../../types/room";
import { formatNumber } from "./format";
import { prefersReducedMotion } from "../../lib/motion";

/*
  Histórico de médias como registro vertical, não como faixa horizontal.
  A faixa antiga escondia 20 de 30 médias atrás de um scroll sem affordance.
  Aqui cada rodada tem linha própria (R30 · 5,5 ou R3 · ☕), a mais recente
  primeiro, em duas colunas que quebram linha no painel de 320px sem cortar nada.

  Quando o painel é mais baixo que a lista, o atalho do rodapé rola até esta
  seção: por isso a ref aponta para o section inteiro, cabeçalho incluso.
*/
export function RoundHistory({
  history,
  className = "",
  ref,
}: {
  history: RoundHistoryEntry[];
  className?: string;
  ref?: Ref<HTMLElement>;
}) {
  const entries = [...history].sort((a, b) => b.round - a.round);
  const reduced = prefersReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), reduced ? 0 : 60);
    return () => window.clearTimeout(timer);
  }, [entries.length, reduced]);

  function displayValue(entry: RoundHistoryEntry): string {
    return typeof entry.average === "string" ? entry.average : formatNumber(entry.average);
  }

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label="médias das rodadas anteriores"
      className={["mt-auto border-t border-line px-4 pt-3 pb-4", className].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="micro">histórico</h3>
        <p className="num text-[10px] leading-none text-faint">
          {entries.length === 0 ? "nenhuma rodada" : entries.length === 1 ? "1 rodada" : `${entries.length} rodadas`}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          Aparecem aqui depois do primeiro reveal.
        </p>
      ) : (
        <ol className="mt-2 grid grid-cols-2 gap-x-3">
          {entries.map((entry, index) => (
            <li
              key={entry.round}
              title={`Rodada ${entry.round} · ${displayValue(entry)}`}
              className={[
                "num relative flex items-baseline justify-between gap-2 border-b border-line/70 py-[5px] text-[10px] leading-none",
                ready && !reduced ? "slide-in" : "",
              ].join(" ")}
              style={
                ready && !reduced
                  ? { animationDelay: `${Math.min(index, 12) * 40}ms` }
                  : undefined
              }
            >
              <span aria-hidden="true" className={index === 0 ? "text-accent" : "text-faint"}>
                R{entry.round}
              </span>
              <span
                aria-hidden="true"
                className={[
                  "num",
                  index === 0 ? "text-ink" : "text-muted",
                  typeof entry.average === "string" ? "text-[11px]" : "",
                ].join(" ")}
              >
                {displayValue(entry)}
              </span>
              <span className="sr-only">
                Rodada {entry.round}: {displayValue(entry)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}