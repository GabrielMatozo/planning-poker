import type { Participant } from "../../types/room";
import { isOnline } from "../../lib/presence";

/**
 * A janela de presença vive em src/lib/presence; a UI só apelida o nome para
 * deixar claro que está olhando um participante.
 */
export const isParticipantOnline = isOnline;

function sortKey(vote: string | null): [number, number] {
  if (vote === null) return [2, 0];
  if (vote === "?") return [1, 0];
  if (vote === "☕") return [1, 1];
  return [0, Number(vote)];
}

/** Depois do reveal: numéricos crescentes, símbolos no fim, quem não votou por último. */
export function sortForReveal(participants: Participant[], hostId: string | null): Participant[] {
  return [...participants].sort((a, b) => {
    const [groupA, valueA] = sortKey(a.vote);
    const [groupB, valueB] = sortKey(b.vote);
    if (groupA !== groupB) return groupA - groupB;
    if (valueA !== valueB) return valueA - valueB;
    if (a.uid === hostId) return -1;
    if (b.uid === hostId) return 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

/** Antes do reveal: host primeiro, depois ordem de entrada. Nada de ordenar por voto. */
export function sortByArrival(participants: Participant[], hostId: string | null): Participant[] {
  return [...participants].sort((a, b) => {
    if (a.uid === hostId) return -1;
    if (b.uid === hostId) return 1;
    return a.joinedAt - b.joinedAt;
  });
}
