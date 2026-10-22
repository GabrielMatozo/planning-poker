import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INVALID_NAME_CHARS,
  MAX_NAME_LENGTH,
  ROOM_CODE_ALPHABET,
  newRoomCode,
  normalizeName,
  normalizeRoomName,
  normalizeRoomId,
} from "./ids";

const CONTROL_CHARS = ["\u0000", "\u0001", "\u0007", "\u0009", "\u000A", "\u000D", "\u001F", "\u007F"];
const BIDI_CHARS = ["\u202A", "\u202B", "\u202C", "\u202D", "\u202E", "\u2066", "\u2067", "\u2068", "\u2069"];
const ZERO_WIDTH_CHARS = ["\u200B", "\u200C", "\u200D", "\u200E", "\u200F", "\u2060", "\u2061", "\u206F"];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeName", () => {
  it("apara as pontas e colapsa espaços internos", () => {
    expect(normalizeName("  Ana    Maria  ")).toBe("Ana Maria");
    expect(normalizeName("Ana\u00A0Maria")).toBe("Ana Maria");
  });

  it("mantém acentos e emoji", () => {
    expect(normalizeName("José 😀")).toBe("José 😀");
    expect(normalizeName("Ação")).toBe("Ação");
  });

  it("recusa nome vazio", () => {
    expect(() => normalizeName("   ")).toThrow();
  });

  it.each(CONTROL_CHARS)("recusa caractere de controle %j", (char) => {
    expect(INVALID_NAME_CHARS.test(`Ana${char}Silva`)).toBe(true);
    expect(() => normalizeName(`Ana${char}Silva`)).toThrow();
  });

  it.each(BIDI_CHARS)("recusa marca de bidi %j", (char) => {
    expect(INVALID_NAME_CHARS.test(`Ana${char}Silva`)).toBe(true);
    expect(() => normalizeName(`Ana${char}Silva`)).toThrow();
  });

  it.each(ZERO_WIDTH_CHARS)("recusa caractere de largura zero %j", (char) => {
    expect(INVALID_NAME_CHARS.test(`Ana${char}Silva`)).toBe(true);
    expect(() => normalizeName(`Ana${char}Silva`)).toThrow();
  });

  it("corta em 40 sem partir um par surrogate", () => {
    const almost = "a".repeat(MAX_NAME_LENGTH - 1);
    const cut = normalizeName(`${almost}😀b`);

    expect(cut).toBe(almost);
    expect(cut.length).toBe(MAX_NAME_LENGTH - 1);
    const last = cut.charCodeAt(cut.length - 1);
    expect(last >= 0xd800 && last <= 0xdfff).toBe(false);
  });

  it("corta em 40 preservando pares inteiros antes do limite", () => {
    const cut = normalizeName("😀".repeat(30));

    expect(cut).toBe("😀".repeat(20));
    expect(cut.length).toBe(MAX_NAME_LENGTH);
  });

  it("não corta nome que já cabe", () => {
    expect(normalizeName("a".repeat(MAX_NAME_LENGTH))).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe("normalizeRoomName", () => {
  it("usa a mesma regra de conteúdo do nome de pessoa", () => {
    expect(normalizeRoomName("  Sprint   42 ")).toBe("Sprint 42");
    expect(() => normalizeRoomName("Sprint\u202E42")).toThrow();
    expect(() => normalizeRoomName(" ")).toThrow();
  });
});

describe("newRoomCode", () => {
  it("gera apenas caracteres do alfabeto", () => {
    for (let index = 0; index < 200; index++) {
      const code = newRoomCode();
      expect(code).toHaveLength(6);
      expect(Array.from(code).every((char) => ROOM_CODE_ALPHABET.includes(char))).toBe(true);
    }
  });

  it("descarta bytes fora do múltiplo do alfabeto antes de sortear", () => {
    const bytes = [255, 248, 0, 1, 2, 3, 4, 5];
    let cursor = 0;

    vi.stubGlobal("crypto", {
      getRandomValues(array: Uint8Array) {
        array[0] = bytes[cursor++] ?? 0;
        return array;
      },
    });

    // 255 e 248 enviesariam o alfabeto de 31 letras e são descartados.
    expect(newRoomCode()).toBe("234567");
  });

  it("funciona sem Web Crypto usando o fallback sem módulo", () => {
    vi.stubGlobal("crypto", undefined);

    const code = newRoomCode();
    expect(code).toHaveLength(6);
    expect(Array.from(code).every((char) => ROOM_CODE_ALPHABET.includes(char))).toBe(true);
  });
});

describe("normalizeRoomId", () => {
  it("normaliza para minúsculas sem espaços", () => {
    expect(normalizeRoomId("  ABCDEF ")).toBe("abcdef");
  });

  it("recusa código fora do alfabeto", () => {
    expect(() => normalizeRoomId("abcdei")).toThrow();
    expect(() => normalizeRoomId("abcde1")).toThrow();
  });
});
