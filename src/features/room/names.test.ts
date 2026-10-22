import { describe, expect, it } from "vitest";
import type { Participant } from "../../types/room";
import { displayRoomCode, duplicateTags, nameKey } from "./names";

function person(uid: string, name: string, joinedAt: number): Participant {
  return {
    uid,
    name,
    color: "#D9A05B",
    online: true,
    lastSeen: 1_700_000_000_000,
    joinedAt,
    hasVoted: false,
    vote: null,
  };
}

describe("nomes repetidos", () => {
  it("numera só o grupo repetido, na ordem de entrada", () => {
    const tags = duplicateTags([
      person("u3", "Ana", 30),
      person("u1", "Ana", 10),
      person("u2", "Bruno", 20),
      person("u4", "ana", 40),
    ]);

    expect(tags.get("u1")).toBe(1);
    expect(tags.get("u3")).toBe(2);
    expect(tags.get("u4")).toBe(3);
    expect(tags.has("u2")).toBe(false);
  });

  it("ignora invisíveis na comparação", () => {
    const tags = duplicateTags([person("u1", "Ana", 1), person("u2", "\u200BAna\u200B", 2)]);
    expect(tags.get("u1")).toBe(1);
    expect(tags.get("u2")).toBe(2);
  });

  it("desempata pelo uid quando a entrada é igual", () => {
    const tags = duplicateTags([person("b", "Ana", 10), person("a", "Ana", 10)]);
    expect(tags.get("a")).toBe(1);
    expect(tags.get("b")).toBe(2);
  });

  it("trata nome vazio como o mesmo rótulo", () => {
    const tags = duplicateTags([person("u1", "", 1), person("u2", "\u200B", 2)]);
    expect(tags.get("u1")).toBe(1);
    expect(tags.get("u2")).toBe(2);
  });

  it("compara sem caixa", () => {
    expect(nameKey("Ana")).toBe(nameKey("ANA"));
  });
});

describe("código de sala na tela", () => {
  it("mostra o código curto como veio", () => {
    expect(displayRoomCode("abc234")).toBe("abc234");
  });

  it("não deixa código gigante da URL quebrar o layout", () => {
    const label = displayRoomCode("x".repeat(400));
    expect(label).toHaveLength(13);
    expect(label.endsWith("…")).toBe(true);
  });

  it("nunca fica vazio", () => {
    expect(displayRoomCode("\u200B")).toBe("—");
  });
});
