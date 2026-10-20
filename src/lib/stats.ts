import type { CardValue } from "./deck";
import { numericValue } from "./deck";
import type { RoundStats } from "../types/room";

function medianOf(ordered: readonly number[]): number | null {
  if (ordered.length === 0) return null;

  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle] ?? null;

  const low = ordered[middle - 1];
  const high = ordered[middle];
  if (low === undefined || high === undefined) return null;

  return (low + high) / 2;
}

export function computeStats(votes: readonly CardValue[]): RoundStats {
  const counts: Record<string, number> = {};
  const numeric: number[] = [];

  for (const vote of votes) {
    counts[vote] = (counts[vote] ?? 0) + 1;
    const value = numericValue(vote);
    if (value !== null) numeric.push(value);
  }

  numeric.sort((a, b) => a - b);

  const average = numeric.length
    ? Math.round((numeric.reduce((sum, value) => sum + value, 0) / numeric.length) * 100) / 100
    : null;

  const first = votes[0];
  const consensus = votes.length >= 2 && first !== undefined && votes.every((vote) => vote === first);

  return { average, median: medianOf(numeric), consensus, counts };
}

/** Quando todos votam o mesmo símbolo (☕ ou ?), devolve esse símbolo; senão null. */
export function unanimousSymbol(votes: readonly CardValue[]): CardValue | null {
  if (votes.length === 0) return null;
  const first = votes[0];
  if (!votes.every((v) => v === first)) return null;
  if (first === "?" || first === "☕") return first;
  return null;
}
