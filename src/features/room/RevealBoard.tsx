import { useEffect, useState } from "react";
import type { Participant } from "../../types/room";
import { isParticipantOnline } from "./presence-view";
import { prefersReducedMotion } from "../../lib/motion";

const SYMBOLS = new Set(["?", "☕"]);

function order(participants: Participant[]): Participant[] {
  return [...participants]
    .filter((person) => person.vote !== null)
    .sort((a, b) => {
      const aSymbol = SYMBOLS.has(a.vote as string);
      const bSymbol = SYMBOLS.has(b.vote as string);
      if (aSymbol !== bSymbol) return aSymbol ? 1 : -1;
      if (aSymbol) return (a.vote as string).localeCompare(b.vote as string);
      return Number(a.vote) - Number(b.vote);
    });
}

export function RevealBoard({
  participants,
  revealed,
  meUid,
  now,
  className = "",
}: {
  participants: Participant[];
  revealed: boolean;
  meUid: string | null;
  now: number;
  className?: string;
}) {
  if (!revealed) return null;

  const cards = order(participants);
  if (cards.length === 0) return null;

  const reduced = prefersReducedMotion();

  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), reduced ? 0 : 60);
    return () => window.clearTimeout(timer);
  }, [revealed, reduced]);

  return (
    <ul
      aria-label="Cartas reveladas"
      className={["scroll-slim flex w-full items-start gap-2 overflow-x-auto pb-1", className].join(" ")}
    >
      {cards.map((person, index) => {
        const mine = person.uid === meUid;
        const offline = !isParticipantOnline(person, now);

        return (
          <li
            key={person.uid}
            className="flex w-[60px] shrink-0 flex-col items-center gap-1.5"
          >
            <span
              data-value={person.vote ?? undefined}
              className={[
                "reveal-board-card num relative flex h-[80px] w-[60px] items-center justify-center rounded-[10px] border text-[20px] font-semibold transition-all duration-200",
                mine
                  ? "border-accent/70 bg-[#1d1811] text-accent shadow-[0_0_0_1px_rgba(217,160,91,0.3),0_4px_16px_-6px_rgba(217,160,91,0.35)]"
                  : "border-line bg-elevated text-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.4)]",
                offline ? "opacity-40" : "",
                ready && !reduced ? "flip-in" : "",
              ].join(" ")}
              style={
                ready && !reduced
                  ? { animationDelay: `${Math.min(index, 10) * 65}ms` }
                  : undefined
              }
            >
              {person.vote}
            </span>
          </li>
        );
      })}
    </ul>
  );
}