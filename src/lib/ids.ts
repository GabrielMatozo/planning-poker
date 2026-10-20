export const MAX_NAME_LENGTH = 40;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

const AVATAR_COLORS = [
  "#D9A05B",
  "#5B8FD9",
  "#9A7BD9",
  "#4FA98C",
  "#C97B8A",
  "#86A34F",
  "#B07ACB",
  "#4E9AA8",
] as const;

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/**
 * Controles ASCII (C0 + DEL), marcas de bidi e caracteres de largura zero.
 * Nome é exibido em lista e em título: esses caracteres permitem disfarçar
 * texto, inverter a ordem visual ou esconder conteúdo.
 */
export const INVALID_NAME_CHARS = /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F]/;

const NAME_EMPTY = "Informe um nome";
const NAME_INVALID = "O nome tem caracteres invisíveis ou de controle. Remova e tente de novo.";
const ROOM_NAME_EMPTY = "Dê um nome para a sala";

/** Sorteia um índice sem viés de módulo: descarta bytes fora de um múltiplo do alfabeto. */
function randomLetterIndex(): number {
  if (globalThis.crypto?.getRandomValues) {
    const limit = Math.floor(256 / ROOM_CODE_ALPHABET.length) * ROOM_CODE_ALPHABET.length;
    const buffer = new Uint8Array(1);
    let byte = limit;

    while (byte >= limit) {
      globalThis.crypto.getRandomValues(buffer);
      byte = buffer[0] ?? limit;
    }

    return byte % ROOM_CODE_ALPHABET.length;
  }

  // Sem Web Crypto (navegador antigo): Math.random em [0, 1) não usa módulo,
  // então também não concentra letras no início do alfabeto.
  return Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
}

export function newRoomCode(): string {
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index++) {
    code += ROOM_CODE_ALPHABET[randomLetterIndex()] ?? "";
  }
  return code;
}

export function normalizeRoomId(raw: string): string {
  const code = raw.trim().toLowerCase();
  if (!ROOM_CODE_PATTERN.test(code)) throw new Error("Código de sala inválido");
  return code;
}

/** Corta em MAX_NAME_LENGTH unidades UTF-16, que é como as regras contam. */
function truncateName(value: string): string {
  if (value.length <= MAX_NAME_LENGTH) return value;

  let end = MAX_NAME_LENGTH;
  const last = value.charCodeAt(end - 1);
  // Não deixa metade de um par surrogate no fim do nome.
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return value.slice(0, end);
}

function normalizeLabel(raw: string, emptyMessage: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(emptyMessage);
  if (INVALID_NAME_CHARS.test(trimmed)) throw new Error(NAME_INVALID);
  return truncateName(trimmed.replace(/\s+/g, " "));
}

export function normalizeName(raw: string): string {
  return normalizeLabel(raw, NAME_EMPTY);
}

export function normalizeRoomName(raw: string): string {
  return normalizeLabel(raw, ROOM_NAME_EMPTY);
}

export function colorFromUid(uid: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < uid.length; index++) {
    hash ^= uid.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  const paletteIndex = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[paletteIndex] ?? AVATAR_COLORS[0];
}
