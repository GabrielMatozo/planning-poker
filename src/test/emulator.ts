import {
  EMULATOR_DB_HOST,
  EMULATOR_DB_NAMESPACE,
  EMULATOR_DB_PORT,
} from "../data/firebase/client";

const DB_ORIGIN = `http://${EMULATOR_DB_HOST}:${EMULATOR_DB_PORT}`;

export const EMULATOR_ENABLED = Boolean(process.env.FIREBASE_EMULATOR);

export function restUrl(path: string, auth?: string): string {
  const normalized = path.replace(/^\//, "");
  const suffix = normalized ? `/${normalized}` : "";
  const token = auth ? `&auth=${encodeURIComponent(auth)}` : "";
  return `${DB_ORIGIN}${suffix}.json?ns=${EMULATOR_DB_NAMESPACE}${token}`;
}

export async function resetDatabase(): Promise<void> {
  const response = await fetch(`${DB_ORIGIN}/.json?ns=${EMULATOR_DB_NAMESPACE}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer owner" },
  });

  if (!response.ok) throw new Error(`Falha ao limpar o emulador: ${response.status}`);
}

export type RestResponse = { status: number; body: unknown };

export async function restGet(path: string, token: string): Promise<RestResponse> {
  const response = await fetch(restUrl(path, token));
  const text = await response.text();

  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
}

/** Leitura fora das regras, como o próprio emulador enxerga. */
export async function adminGet(path: string): Promise<RestResponse> {
  const response = await fetch(restUrl(path), { headers: { Authorization: "Bearer owner" } });
  const text = await response.text();

  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
}

/** Escrita fora das regras, como a poda feita por outro cliente. */
export async function adminWrite(path: string, body: unknown): Promise<void> {
  const response = await fetch(restUrl(path), {
    method: "PUT",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Falha ao gravar ${path}: ${response.status}`);
}

/** Apaga um caminho sem passar pelas regras: simula a poda feita por outro cliente. */
export async function adminErase(path: string): Promise<void> {
  const response = await fetch(restUrl(path), {
    method: "DELETE",
    headers: { Authorization: "Bearer owner" },
  });

  if (!response.ok) throw new Error(`Falha ao apagar ${path}: ${response.status}`);
}
