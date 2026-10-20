export const DECK = ["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"] as const;

export type CardValue = (typeof DECK)[number];

const SYMBOLS = new Set<string>(["?", "☕"]);

export function isCardValue(value: string): value is CardValue {
  return (DECK as readonly string[]).includes(value);
}

export function isNumericCard(value: CardValue): boolean {
  return !SYMBOLS.has(value);
}

export function numericValue(value: CardValue): number | null {
  return isNumericCard(value) ? Number(value) : null;
}
