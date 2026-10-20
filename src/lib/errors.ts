const FALLBACK = "Não foi possível concluir a ação. Tente de novo.";

const MESSAGES: Record<string, string> = {
  PERMISSION_DENIED: "Sem permissão para essa ação agora. Se a sala mudou de host ou de rodada, recarregue a página.",
  UNAVAILABLE: "Sem conexão com a sala. Verifique a internet e tente de novo.",
  DISCONNECTED: "Sem conexão com a sala. Verifique a internet e tente de novo.",
  NETWORK_ERROR: "Sem conexão com a sala. Verifique a internet e tente de novo.",
  "auth/network-request-failed": "Não foi possível concluir. Confira a conexão e tente de novo.",
  "auth/too-many-requests": "Muitas tentativas seguidas. Espere um instante e tente de novo.",
  "auth/admin-restricted-operation": "A entrada anônima está desativada neste projeto do Firebase.",
  "auth/operation-not-allowed": "A entrada anônima está desativada neste projeto do Firebase.",
  "auth/invalid-api-key": "A configuração do Firebase está inválida. Avise quem administra o projeto.",
  "auth/unauthorized-domain": "Este domínio não está liberado no Firebase Auth.",
  "auth/internal-error": "O serviço de entrada falhou. Tente de novo em instantes.",
};

const RAW_CODE = /\b(PERMISSION_DENIED|UNAVAILABLE|DISCONNECTED|NETWORK_ERROR|auth\/[a-z0-9-]+)\b/;

function codeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code ? code : null;
}

/**
 * Traduz erro do Firebase para texto de tela. Mensagens que já são nossas
 * (pt-BR, sem prefixo técnico) passam intactas.
 */
export function userMessage(error: unknown, fallback: string = FALLBACK): string {
  const code = codeOf(error);
  if (code) {
    const mapped = MESSAGES[code] ?? MESSAGES[code.toLowerCase()];
    if (mapped) return mapped;
  }

  if (!(error instanceof Error)) return fallback;

  const message = error.message.trim();
  if (!message) return fallback;

  const raw = message.match(RAW_CODE)?.[0];
  if (raw) return MESSAGES[raw] ?? fallback;

  if (message.startsWith("Firebase:")) return fallback;

  return message;
}

/** Devolve um Error com mensagem de tela, preservando o erro original quando ele já é legível. */
export function humanError(error: unknown, fallback?: string): Error {
  const message = userMessage(error, fallback);
  if (error instanceof Error && error.message.trim() === message) return error;
  return new Error(message, { cause: error });
}
