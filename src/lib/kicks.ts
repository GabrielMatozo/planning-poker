/**
 * Registros de expulsão (kick) por nome.
 *
 * O host pode expulsar um participante da sala. A expulsão é registrada no
 * localStorage do navegador do host (para persistir entre refreshes) e o uid
 * do expulsado é removido da presença em tempo real.
 *
 * Quando o expulsado tenta entrar de novo na mesma sala com o mesmo nome, o
 * app mostra uma tela de bloqueio com contagem regressiva. Após o cooldown,
 * o registro é limpo automaticamente e a pessoa pode tentar de novo.
 */

const KICKS_KEY = "pp:kicks";
export const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

export type KickRecord = {
  name: string;
  roomId: string;
  roomName: string;
  kickedAt: number;
};

function loadKicks(): KickRecord[] {
  try {
    const raw = localStorage.getItem(KICKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as KickRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveKicks(kicks: KickRecord[]): void {
  try {
    localStorage.setItem(KICKS_KEY, JSON.stringify(kicks));
  } catch {
    // localStorage cheio ou bloqueado
  }
}

/**
 * Registra uma expulsão. Chamar do lado do host quando ele confirma o kick.
 */
export function recordKick(name: string, roomId: string, roomName: string): void {
  const kicks = loadKicks();
  kicks.push({ name, roomId, roomName, kickedAt: Date.now() });
  saveKicks(kicks);
}

/**
 * Limpa todos os registros mais antigos que o cooldown.
 */
export function pruneKicks(): void {
  const cutoff = Date.now() - COOLDOWN_MS;
  const kept = loadKicks().filter((k) => k.kickedAt > cutoff);
  if (kept.length !== loadKicks().length) saveKicks(kept);
}

/**
 * Retorna o registro de expulsão mais recente para um nome, ou null.
 */
export function getKickRecord(name: string): KickRecord | null {
  pruneKicks();
  const kicks = loadKicks().filter((k) => k.name === name);
  return kicks.length > 0 ? kicks.at(-1)! : null;
}

/**
 * Retorna quanto tempo falta (ms) para o cooldown expirar. Zero se não há registro ativo.
 */
export function remainingKickMs(name: string): number {
  const record = getKickRecord(name);
  if (!record) return 0;
  const elapsed = Date.now() - record.kickedAt;
  return Math.max(0, COOLDOWN_MS - elapsed);
}

/**
 * Verifica se o nome está atualmente bloqueado por expulsão.
 */
export function isKicked(name: string): boolean {
  return remainingKickMs(name) > 0;
}
