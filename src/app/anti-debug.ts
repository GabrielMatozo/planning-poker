/**
 * Dissuasão contra DevTools. Não é segurança: o código já está no navegador.
 *
 * O que funciona de verdade:
 * - `debugger` em loop: com o DevTools aberto e breakpoints ativos, o navegador
 *   pausa a cada 250ms. `Ctrl+F8` (desativar breakpoints), abrir o DevTools antes
 *   do load, usar outro navegador/perfil ou chamar o banco por `curl` passam por cima.
 * - Bloqueio de atalhos (F12, Ctrl+Shift+I/J/C/K, Ctrl+U e variantes do macOS).
 *
 * Modos:
 * - `strict` (padrão em produção): atalhos + `debugger` em loop.
 * - `shortcuts`: só bloqueio de atalhos.
 * - `0`: desligado.
 *
 * Em desenvolvimento fica desligado, a menos que `VITE_ANTI_DEBUG=strict|shortcuts`
 * seja passado explicitamente. Escape para suporte/QA: abrir a URL com `?pp_debug=1`
 * (vale para a sessão do navegador).
 */

type EnvLike = {
  PROD?: boolean;
  VITE_ANTI_DEBUG?: string;
};

type KeyLike = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

const ALLOW_KEY = "pp:devtools-allowed";
const DEBUGGER_INTERVAL_MS = 250;

export type AntiDebugMode = "off" | "shortcuts" | "strict";

export function antiDebugMode(env: EnvLike = import.meta.env): AntiDebugMode {
  const raw = String(env.VITE_ANTI_DEBUG ?? "").toLowerCase();

  if (env.PROD) {
    if (raw === "0" || raw === "off") return "off";
    if (raw === "shortcuts") return "shortcuts";
    return "strict";
  }

  if (raw === "strict") return "strict";
  if (raw === "shortcuts") return "shortcuts";
  return "off";
}

export function isDevToolsShortcut(event: KeyLike): boolean {
  const key = event.key.toUpperCase();
  const accel = Boolean(event.ctrlKey || event.metaKey);

  if (event.key === "F12") return true;
  if (!accel) return false;

  // Windows/Linux: Ctrl+Shift+I/J/C/K. macOS: Cmd+Option+I/J/C, Cmd+Option+U.
  if (event.ctrlKey && event.shiftKey) {
    return key === "I" || key === "J" || key === "C" || key === "K";
  }
  if (event.metaKey && event.altKey) {
    return key === "I" || key === "J" || key === "C" || key === "U";
  }

  // Ver código-fonte: Ctrl+U / Cmd+U.
  return key === "U" && !event.shiftKey;
}

function hasEscapeFlag(): boolean {
  if (typeof window === "undefined") return true;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pp_debug") === "1") {
      window.sessionStorage.setItem(ALLOW_KEY, "1");
      return true;
    }
    return window.sessionStorage.getItem(ALLOW_KEY) === "1";
  } catch {
    return false;
  }
}

export function installDevToolsDeterrent(): () => void {
  const mode = antiDebugMode();
  if (mode === "off" || hasEscapeFlag()) return () => {};

  const onKeyDown = (event: KeyboardEvent) => {
    if (!isDevToolsShortcut(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  window.addEventListener("keydown", onKeyDown, true);

  let timer: number | undefined;
  if (mode === "strict") {
    timer = window.setInterval(() => {
      // eslint-disable-next-line no-debugger
      debugger;
    }, DEBUGGER_INTERVAL_MS);
  }

  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    if (timer !== undefined) window.clearInterval(timer);
  };
}
