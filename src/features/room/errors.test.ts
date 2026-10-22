import { describe, expect, it } from "vitest";
import { friendlyError, readableMessage } from "./errors";

describe("mensagem de erro na tela", () => {
  it("traduz PERMISSION_DENIED sem citar o serviço", () => {
    const error = Object.assign(new Error("PERMISSION_DENIED: Permission denied"), { code: "PERMISSION_DENIED" });
    const message = friendlyError(error);

    expect(message).not.toMatch(/permission|firebase/i);
    expect(message).toMatch(/permiss/i);
  });

  it("não vaza prefixo do SDK", () => {
    const message = friendlyError(new Error("Firebase: Error (auth/network-request-failed)."));
    expect(message).toBe("Não foi possível concluir. Confira a conexão e tente de novo.");
  });

  it("deixa passar mensagem que já é nossa", () => {
    expect(friendlyError(new Error("Rodada revelada: espere a próxima para votar"))).toBe(
      "Rodada revelada: espere a próxima para votar",
    );
  });

  it("troca a frase genérica pela do contexto da tela", () => {
    const error = new Error("Firebase: Error (auth/network-request-failed).");
    expect(friendlyError(error, "Não foi possível entrar na sala. Tente de novo.")).toBe(
      "Não foi possível entrar na sala. Tente de novo.",
    );
  });

  it("usa o fallback quando o erro não tem mensagem", () => {
    expect(friendlyError(null, "Tente de novo.")).toBe("Tente de novo.");
    expect(friendlyError(new Error("   "), "Tente de novo.")).toBe("Tente de novo.");
  });

  it("limpa texto técnico que chega por prop", () => {
    expect(readableMessage("Firebase: PERMISSION_DENIED", "Sem acesso agora.")).toBe("Sem acesso agora.");
    expect(readableMessage(null, "Sem acesso agora.")).toBeNull();
    expect(readableMessage("Essa sala não existe.", "Sem acesso agora.")).toBe("Essa sala não existe.");
  });
});
