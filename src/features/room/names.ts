import type { Participant } from "../../types/room";
import { cleanText, displayName, truncateText } from "../../ui/text";

export { displayName };

/**
 * Chave de comparação para nomes iguais. Caixa não conta ("Ana"/"ana" colidem);
 * acento conta ("Ana"/"aná" não). O que importa aqui é o que o olho lê como o
 * mesmo rótulo.
 */
export function nameKey(name: string): string {
  return cleanText(name).toLocaleLowerCase("pt-BR");
}

/**
 * Quando duas pessoas escolhem o mesmo nome, cada uma ganha um número estável
 * (ordem de entrada, uid como desempate). Sem isso, "Ana" duas vezes na sidebar
 * e no reveal viram adivinhação.
 */
export function duplicateTags(participants: readonly Participant[]): Map<string, number> {
  const groups = new Map<string, Participant[]>();

  for (const person of participants) {
    const key = nameKey(person.name) || "sem-nome";
    const group = groups.get(key);
    if (group) group.push(person);
    else groups.set(key, [person]);
  }

  const tags = new Map<string, number>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const ordered = [...group].sort(
      (a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid),
    );
    ordered.forEach((person, index) => tags.set(person.uid, index + 1));
  }

  return tags;
}

/** Código que veio da URL pode ser qualquer coisa. Na tela, só um rótulo curto. */
export function displayRoomCode(raw: string): string {
  const value = cleanText(raw);
  if (!value) return "—";
  if (value.length <= 14) return value;
  return `${truncateText(value, 12)}…`;
}
