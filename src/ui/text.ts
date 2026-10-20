/*
  Texto que vem de gente (nome, sala) passa por aqui antes de virar estado ou
  pixel. A regra é a mesma dos dois lados: o que não tem forma visível não entra,
  e o que entra nunca pode virar markup.

  Fora da lista: U+200D (ZWJ). Ele é invisível sozinho, mas é o que mantém
  emoji composto (👩‍💻, 👨‍👩‍👧) inteiro. Todo o resto de largura zero sai.
*/

/** Controles C0/C1, marcas de bidi, largura zero e separadores de linha. */
const UNSAFE_CHARS =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b\u200c\u200e\u200f\u2028\u2029\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g;

/** Qualquer corrida de espaço, inclusive NBSP, ideográfico e tab. */
const SPACE_RUN = /[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;

/** Remove o que não deveria existir em um nome: controle, bidi e largura zero. */
export function stripUnsafeText(value: string): string {
  return value.replace(UNSAFE_CHARS, "");
}

/**
 * Limpa o que a pessoa digitou sem atropelar a digitação: mantém um espaço no
 * fim para quem está no meio de "Ana Beatriz", mas derruba espaço duplo.
 */
export function sanitizeTyping(value: string): string {
  return stripUnsafeText(value.replace(SPACE_RUN, " "))
    .replace(SPACE_RUN, " ")
    .replace(/^ +/, "");
}

/** Texto pronto para exibir ou enviar: sem invisíveis, sem espaço sobrando. */
export function cleanText(value: string): string {
  return sanitizeTyping(value).trim();
}

/** Nome exibido nunca fica vazio na tela. */
export function displayName(value: string, fallback = "Sem nome"): string {
  return cleanText(value) || fallback;
}

/**
 * Corta em unidades UTF-16, que é como o servidor conta (ver MAX_NAME_LENGTH em
 * src/lib/ids). Não deixa metade de par surrogate no fim.
 */
export function truncateToUnits(value: string, max: number): string {
  if (value.length <= max) return value;

  let end = max;
  const last = value.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return value.slice(0, end);
}

/** Corta por code point, para rótulo curto de tela (não para nome de gente). */
export function truncateText(value: string, max: number): string {
  const chars = Array.from(value);
  if (chars.length <= max) return value;
  return chars.slice(0, max).join("");
}
