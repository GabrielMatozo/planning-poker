import { MAX_NAME_LENGTH, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../../lib/ids";
import { cleanText, sanitizeTyping, truncateToUnits } from "../../ui/text";

export const NAME_MAX = MAX_NAME_LENGTH;

const CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
const CODE_CHAR = new RegExp(`[${ROOM_CODE_ALPHABET}]`);

export { cleanText };

/**
 * Limite de digitação: invisível sai, espaço duplo vira um, corte em 40 unidades
 * (o mesmo limite que o servidor aplica). O espaço no fim fica para não atrapalhar
 * quem ainda está digitando.
 */
export function limitField(raw: string): string {
  return truncateToUnits(sanitizeTyping(raw), NAME_MAX);
}

/** Versão de envio: limpa e apara de verdade. */
export function limitName(raw: string): string {
  return truncateToUnits(cleanText(raw), NAME_MAX);
}

export function validateName(raw: string): string | null {
  if (cleanText(raw).length === 0) return "Informe seu nome para continuar.";
  return null;
}

export function validateRoomName(raw: string): string | null {
  if (cleanText(raw).length === 0) return "Dê um nome para a sala.";
  return null;
}

export function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateCode(raw: string): string | null {
  const code = normalizeCode(raw);
  if (code.length === 0) return "Cole ou digite o código da sala.";
  if (code.length !== ROOM_CODE_LENGTH) return `O código tem ${ROOM_CODE_LENGTH} caracteres.`;
  if (!CODE_PATTERN.test(code)) return "O código não usa 0, 1, l, i nem o. Confira o link.";
  return null;
}

export function keepCodeChars(raw: string): string {
  return Array.from(raw.toLowerCase())
    .filter((char) => CODE_CHAR.test(char))
    .join("")
    .slice(0, ROOM_CODE_LENGTH);
}
