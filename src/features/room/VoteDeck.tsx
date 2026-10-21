import type { CardValue } from "../../types/room";
import { DECK } from "../../types/room";
import { Card } from "../../ui/Card";
import { LockIcon } from "../../ui/icons";

export type VoteDeckProps = {
  myVote: CardValue | null;
  revealed: boolean;
  onVote: (value: CardValue) => void;
};

export function VoteDeck({ myVote, revealed, onVote }: VoteDeckProps) {
  let hint = "escolha uma carta";
  if (revealed) hint = "travado nesta rodada";
  else if (myVote) hint = "troque à vontade antes de revelar";

  return (
    <section aria-label="Cartas de votação" className="flex w-full flex-col gap-3.5">
      <div className="deck-caption mx-auto flex w-full max-w-[400px] items-center justify-between gap-3 min-[1280px]:max-w-none">
        <h2 className="micro">Sua carta</h2>
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          {revealed ? <LockIcon size={11} /> : null}
          {hint}
        </p>
      </div>

      <div className="vote-deck-grid mx-auto grid w-full max-w-[400px] grid-cols-5 gap-2.5 min-[1280px]:max-w-none min-[1280px]:grid-cols-10 min-[1280px]:gap-3">
        {DECK.map((value) => (
          <Card
            key={value}
            value={value}
            selected={myVote === value}
            disabled={revealed}
            onSelect={(next) => onVote(next as CardValue)}
          />
        ))}
      </div>
    </section>
  );
}
