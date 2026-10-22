import { describe, expect, it } from "vitest";
import {
  cleanText,
  displayName,
  sanitizeTyping,
  stripUnsafeText,
  truncateText,
  truncateToUnits,
} from "./text";

describe("limpeza de texto", () => {
  it("remove controle, zero-width e marcas de bidi", () => {
    expect(stripUnsafeText("A\u0000n\u200Ba\u200F")).toBe("Ana");
    expect(stripUnsafeText("\u202Eevil\u202C")).toBe("evil");
    expect(stripUnsafeText("a\uFEFFb")).toBe("ab");
    expect(stripUnsafeText("a\u00ADb")).toBe("ab");
  });

  it("preserva acento, emoji e RTL", () => {
    const rtl = "مرحبا بالعالم";
    expect(cleanText(rtl)).toBe(rtl);
    expect(cleanText("João 🚀 Coração")).toBe("João 🚀 Coração");
    expect(cleanText("👩‍💻")).toBe("👩‍💻");
  });

  it("não deixa quebra de linha virar cola entre palavras", () => {
    expect(cleanText("Ana\nBeatriz")).toBe("Ana Beatriz");
  });

  it("colapsa espaço duplo e apara no envio", () => {
    expect(cleanText("  Ana   Beatriz  ")).toBe("Ana Beatriz");
    expect(sanitizeTyping("Ana  ")).toBe("Ana ");
    expect(sanitizeTyping("Ana  Beatriz")).toBe("Ana Beatriz");
  });

  it("fornece um rótulo quando o nome fica vazio", () => {
    expect(displayName("\u200B\u200B")).toBe("Sem nome");
    expect(displayName("  ")).toBe("Sem nome");
  });
});

describe("corte de texto", () => {
  it("conta como o servidor (unidades UTF-16) sem partir emoji", () => {
    const cut = truncateToUnits(`${"a".repeat(39)}😀`, 40);
    expect(cut).toBe("a".repeat(39));
    expect(cut.length).toBe(39);
    expect(/[\uD800-\uDBFF]$/.test(cut)).toBe(false);
  });

  it("corta por code point para rótulos curtos", () => {
    expect(truncateText("abcdef", 3)).toBe("abc");
    expect(truncateText("🚀🚀🚀", 2)).toBe("🚀🚀");
    expect(truncateText("abc", 3)).toBe("abc");
  });
});
