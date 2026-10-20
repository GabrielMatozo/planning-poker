/**
 * Rate limiter para criação de salas.
 *
 * Impede DoS por criação massiva de salas com contas anônimas.
 * Limites:
 * - 5 salas a cada 60 segundos
 * - 20 salas a cada hora
 *
 * Em desenvolvimento (VITE_QUOTA_DISABLED=1) o limiter fica desligado.
 */

const CREATIONS_KEY = "pp:quota:creations";
const MAX_PER_MINUTE = 5;
const WINDOW_MS = 60_000;
const MAX_PER_HOUR = 20;
const HOUR_MS = 3_600_000;

type Entry = { uid: string; ts: number };

function loadLog(): Entry[] {
  try {
    const raw = localStorage.getItem(CREATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Entry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveLog(log: Entry[]): void {
  try {
    localStorage.setItem(CREATIONS_KEY, JSON.stringify(log));
  } catch {
    // localStorage cheio ou bloqueado: ignora, o rate limiter não quebra o app
  }
}

function prune(log: Entry[], now: number): Entry[] {
  const cutoff = now - HOUR_MS;
  return log.filter((e) => e.ts > cutoff);
}

export class QuotaExceededError extends Error {
  constructor() {
    super("Muitas salas criadas. Aguarde um momento e tente de novo.");
    this.name = "QuotaExceededError";
  }
}

export function isQuotaDisabled(): boolean {
  const meta = typeof import.meta !== "undefined" ? import.meta : (null as unknown);
  if (!meta || typeof meta !== "object" || !("env" in meta)) return false;
  const env = (meta as { env: Record<string, string | undefined> }).env;
  return typeof env.VITE_QUOTA_DISABLED === "string" && env.VITE_QUOTA_DISABLED.toLowerCase() === "1";
}

export async function checkQuota(uid: string): Promise<void> {
  if (isQuotaDisabled()) return;

  const now = Date.now();
  const log = prune(loadLog(), now);
  const recent = log.filter((e) => e.uid === uid && now - e.ts < WINDOW_MS);

  if (recent.length >= MAX_PER_MINUTE) {
    throw new QuotaExceededError();
  }

  const hourly = log.filter((e) => e.uid === uid);
  if (hourly.length >= MAX_PER_HOUR) {
    throw new QuotaExceededError();
  }
}

export function recordCreation(uid: string): void {
  if (isQuotaDisabled()) return;

  const log = prune(loadLog(), Date.now());
  log.push({ uid, ts: Date.now() });
  saveLog(log);
}

/**
 * Retorna info de quota para exibição (ex.: tempo até o próximo slot).
 */
export function getQuotaInfo(uid: string): { canCreate: boolean; retryMs: number } {
  if (isQuotaDisabled()) return { canCreate: true, retryMs: 0 };

  const now = Date.now();
  const log = prune(loadLog(), now);
  const recent = log.filter((e) => e.uid === uid && now - e.ts < WINDOW_MS);
  const hourly = log.filter((e) => e.uid === uid);

  if (recent.length < MAX_PER_MINUTE && hourly.length < MAX_PER_HOUR) {
    return { canCreate: true, retryMs: 0 };
  }

  // Quando redefinir o window mais próximo
  const lastTs = recent.length > 0 ? recent[recent.length - 1]!.ts : 0;
  const windowReset = lastTs + WINDOW_MS - now;
  const retryMs = Math.max(windowReset, 1000);
  return { canCreate: false, retryMs };
}
