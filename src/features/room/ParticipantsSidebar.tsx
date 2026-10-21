import { useEffect, useState } from "react";
import type { Participant } from "../../types/room";
import { Avatar } from "../../ui/Avatar";
import { Badge } from "../../ui/Badge";
import { Dot } from "../../ui/Dot";
import { TrashIcon } from "../../ui/icons";
import { displayName, duplicateTags } from "./names";
import { isParticipantOnline, sortByArrival, sortForReveal } from "./presence-view";
import { prefersReducedMotion } from "../../lib/motion";

export type ParticipantsSidebarProps = {
  participants: Participant[];
  revealed: boolean;
  meUid: string | null;
  hostId: string | null;
  now: number;
  onKick?: (uid: string) => void;
  className?: string;
};

export function ParticipantsSidebar({
  participants,
  revealed,
  meUid,
  hostId,
  now,
  onKick,
  className = "",
}: ParticipantsSidebarProps) {
  const ordered = revealed ? sortForReveal(participants, hostId) : sortByArrival(participants, hostId);
  const votedCount = participants.filter((person) => person.hasVoted).length;
  const tags = duplicateTags(participants);
  const reduced = prefersReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), reduced ? 0 : 80);
    return () => window.clearTimeout(timer);
  }, [participants.length, revealed, reduced]);

  return (
    <aside
      aria-label="Participantes"
      className={["flex min-h-0 min-w-0 flex-col border-b border-line lg:border-r lg:border-b-0", className].join(" ")}
    >
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 px-4 lg:h-11 lg:border-b lg:border-line lg:px-3.5">
        <h2 className="micro">Participantes</h2>
        <span className="num text-[10px] text-faint" aria-hidden="true">
          {votedCount}/{participants.length}
        </span>
        <span className="sr-only">
          {votedCount} de {participants.length} votaram
        </span>
      </div>

      <ul className="scroll-slim flex snap-x items-start gap-2 overflow-x-auto px-3 pb-2 lg:min-h-0 lg:flex-1 lg:snap-none lg:flex-col lg:gap-0 lg:overflow-x-hidden lg:overflow-y-auto lg:px-0 lg:pb-3">
        {ordered.map((person, index) => {
          const online = isParticipantOnline(person, now);
          const isMe = person.uid === meUid;
          const isHost = person.uid === hostId;
          const tag = tags.get(person.uid) ?? null;

          return (
            <li
              key={person.uid}
              className={[
                "shrink-0 snap-start lg:w-full lg:border-t lg:border-line/70 lg:first:border-t-0",
                ready && !reduced ? "slide-in" : "",
              ].join(" ")}
              style={
                ready && !reduced
                  ? { animationDelay: `${Math.min(index, 12) * 45}ms` }
                  : undefined
              }
            >
              <div
                data-testid={`participant-${person.uid}`}
                className={[
                  "flex h-[100px] w-[120px] shrink-0 flex-col items-center gap-1.5 rounded-[8px] px-1.5 py-2",
                  "lg:h-11 lg:w-full lg:flex-row lg:items-center lg:gap-2.5 lg:rounded-none lg:px-3.5 lg:py-0",
                  isMe ? "bg-elevated/55" : "",
                ].join(" ")}
              >
                <span className="relative inline-flex shrink-0">
                  <Avatar name={person.name} color={person.color} size="sm" />
                  <span className="absolute -right-1 -bottom-1 grid h-3 w-3 place-items-center rounded-full bg-canvas">
                    <Dot
                      state={online ? "online" : "offline"}
                      label={`${person.name}: ${online ? "online" : "offline"}`}
                    />
                  </span>
                  {online ? (
                    <span
                      aria-hidden="true"
                      className="pulse-dot absolute -right-1 -bottom-1 grid h-3 w-3 place-items-center rounded-full"
                    >
                      <Dot state="online" label="" />
                    </span>
                  ) : null}
                </span>

                <span className="flex w-full min-w-0 flex-col items-center gap-1 lg:w-auto lg:flex-1 lg:items-start lg:gap-1">
                  <span className="flex w-full min-w-0 items-center justify-center gap-1 lg:justify-start">
                    <bdi
                      dir="auto"
                      title={person.name}
                      className={[
                        "min-w-0 truncate text-center text-[12px] lg:text-left lg:text-[13px]",
                        online ? "text-ink" : "text-muted",
                      ].join(" ")}
                    >
                      {displayName(person.name)}
                    </bdi>
                    {tag ? (
                      <>
                        <span className="num shrink-0 text-[9px] leading-none text-faint" aria-hidden="true">
                          #{tag}
                        </span>
                        <span className="sr-only">pessoa {tag}</span>
                      </>
                    ) : null}
                  </span>

                  {isHost || isMe ? (
                    <span className="flex h-[15px] shrink-0 items-center justify-center gap-1">
                      {isMe ? (
                        <Badge size="xs" tone="ink">
                          você
                        </Badge>
                      ) : null}
                      {isHost ? (
                        <Badge size="xs" tone="accent">
                          host
                        </Badge>
                      ) : null}
                    </span>
                  ) : (
                    <span aria-hidden="true" className="h-[15px]" />
                  )}

                  {onKick && !isMe && !isHost ? (
                    <button
                      type="button"
                      onClick={() => onKick(person.uid)}
                      aria-label={`Expulsar ${displayName(person.name)}`}
                      title="Expulsar da sala"
                      className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-line bg-canvas text-faint transition-colors duration-150 hover:border-danger/40 hover:bg-danger/10 hover:text-danger-text lg:ml-0"
                    >
                      <TrashIcon size={11} />
                    </button>
                  ) : null}
                </span>

                {revealed ? (
                  person.vote ? (
                    <span className="num mt-auto grid h-[22px] min-w-[26px] shrink-0 place-items-center rounded-[5px] border border-line bg-canvas px-1 text-[11px] text-ink lg:mt-0">
                      {person.vote}
                    </span>
                  ) : (
                    <span className="num mt-auto shrink-0 text-[11px] text-muted lg:mt-0" aria-label="não votou">
                      —
                    </span>
                  )
                ) : (
                  <span
                    className={[
                      "mt-auto shrink-0 text-[10px] whitespace-nowrap lg:mt-0 lg:text-[11px]",
                      person.hasVoted ? "text-ok-text" : "text-muted",
                    ].join(" ")}
                  >
                    {person.hasVoted ? "votou" : "aguardando"}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}