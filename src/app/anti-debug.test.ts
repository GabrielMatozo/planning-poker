import { afterEach, describe, expect, it, vi } from "vitest";
import { antiDebugMode, installDevToolsDeterrent, isDevToolsShortcut } from "./anti-debug";

function key(
  value: string,
  modifiers: Partial<Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">> = {},
) {
  return { key: value, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...modifiers };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("modo de dissuasão", () => {
  it("produção assume strict por padrão", () => {
    expect(antiDebugMode({ PROD: true })).toBe("strict");
  });

  it("produção respeita 0 e shortcuts", () => {
    expect(antiDebugMode({ PROD: true, VITE_ANTI_DEBUG: "0" })).toBe("off");
    expect(antiDebugMode({ PROD: true, VITE_ANTI_DEBUG: "shortcuts" })).toBe("shortcuts");
  });

  it("desenvolvimento fica desligado sem flag explícita", () => {
    expect(antiDebugMode({ PROD: false })).toBe("off");
    expect(antiDebugMode({ PROD: false, VITE_ANTI_DEBUG: "strict" })).toBe("strict");
  });
});

describe("atalhos de DevTools", () => {
  it("reconhece F12", () => {
    expect(isDevToolsShortcut(key("F12"))).toBe(true);
  });

  it("reconhece Windows/Linux", () => {
    for (const letter of ["i", "j", "c", "k"]) {
      expect(isDevToolsShortcut(key(letter, { ctrlKey: true, shiftKey: true }))).toBe(true);
    }
    expect(isDevToolsShortcut(key("u", { ctrlKey: true }))).toBe(true);
  });

  it("reconhece macOS", () => {
    for (const letter of ["i", "j", "c", "u"]) {
      expect(isDevToolsShortcut(key(letter, { metaKey: true, altKey: true }))).toBe(true);
    }
  });

  it("não bloqueia digitação normal", () => {
    expect(isDevToolsShortcut(key("i"))).toBe(false);
    expect(isDevToolsShortcut(key("u", { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isDevToolsShortcut(key("p", { ctrlKey: true, shiftKey: true }))).toBe(false);
  });
});

describe("instalação", () => {
  it("não instala em desenvolvimento sem flag", () => {
    const stop = installDevToolsDeterrent();
    const event = new KeyboardEvent("keydown", { key: "F12", cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    stop();
  });
});
