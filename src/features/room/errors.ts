import { userMessage } from "../../lib/errors";

/**
 * O que pode chegar de erro: mensagem nossa em pt-BR (passa), erro do SDK
 * traduzido pelo lib/errors (passa, se não citar serviço) ou stack técnica
 * (vira o texto da tela). Nenhuma tela deste app mostra nome de produto,
 * código de permissão ou caminho de banco.
 */
const TECHNICAL = /\bfirebase\b|\bsdk\b|permission[_ ]denied|auth\/|database|emulator|websocket/i;

const GENERIC = "Não foi possível concluir. Confira a conexão e tente de novo.";

/**
 * O lib/errors devolve esta frase quando não reconhece o erro. Ela é honesta,
 * mas perde o contexto da tela ("entrar na sala" ≠ "concluir"). Se quem chamou
 * passou um fallback próprio, ele vale mais.
 */
const UPSTREAM_GENERIC = /^não foi possível (concluir|concluir a ação)\./i;

export function friendlyError(error: unknown, fallback: string = GENERIC): string {
  const message = userMessage(error, fallback).trim();
  if (!message || TECHNICAL.test(message)) return fallback;
  if (message !== fallback && UPSTREAM_GENERIC.test(message)) return fallback;
  return message;
}

/** Para texto que já vem pronto de outra camada (props de erro do formulário). */
export function readableMessage(message: string | null | undefined, fallback: string): string | null {
  const text = message?.trim();
  if (!text) return null;
  if (text.startsWith("Firebase:") || TECHNICAL.test(text)) return fallback;
  return text;
}
