import { describe, expect, it } from "vitest";
import { humanError, userMessage } from "./errors";

function firebaseError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

describe("userMessage", () => {
  it("traduz PERMISSION_DENIED do Realtime Database", () => {
    const error = firebaseError("PERMISSION_DENIED", "PERMISSION_DENIED: Permission denied");

    expect(userMessage(error)).not.toContain("PERMISSION_DENIED");
    expect(userMessage(error)).toContain("Sem permissão");
  });

  it("traduz erro de rede sem expor código técnico", () => {
    const error = firebaseError("UNAVAILABLE", "UNAVAILABLE: Network error");

    expect(userMessage(error)).toContain("Sem conexão");
    expect(userMessage(error)).not.toContain("UNAVAILABLE");
  });

  it("traduz erro de autenticação", () => {
    const error = firebaseError("auth/network-request-failed", "Firebase: Error (auth/network-request-failed).");

    expect(userMessage(error)).toContain("Confira a conexão");
    expect(userMessage(error)).not.toContain("auth/");
  });

  it("traduz mensagem crua mesmo sem code", () => {
    expect(userMessage(new Error("PERMISSION_DENIED: Permission denied"))).toContain("Sem permissão");
    expect(userMessage(new Error("Firebase: Error (auth/too-many-requests)."))).toContain("Muitas tentativas");
  });

  it("mantém mensagens de domínio em pt-BR", () => {
    expect(userMessage(new Error("Só o host revela a rodada"))).toBe("Só o host revela a rodada");
    expect(userMessage(new Error("Rodada revelada: espere a próxima para votar"))).toContain("Rodada revelada");
  });

  it("usa fallback para erro desconhecido sem mensagem", () => {
    expect(userMessage(null, "Falhou")).toBe("Falhou");
    expect(userMessage(new Error("Firebase: Error (auth/unknown)."), "Falhou")).toBe("Falhou");
  });
});

describe("humanError", () => {
  it("preserva o erro original quando a mensagem já é legível", () => {
    const original = new Error("Carta fora do deck");
    expect(humanError(original)).toBe(original);
  });

  it("troca a mensagem técnica por uma humana", () => {
    const original = firebaseError("PERMISSION_DENIED", "PERMISSION_DENIED: Permission denied");
    const converted = humanError(original);

    expect(converted).not.toBe(original);
    expect(converted.message).not.toContain("PERMISSION_DENIED");
    expect(converted.cause).toBe(original);
  });
});
