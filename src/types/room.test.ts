import { describe, it, expect } from "vitest";
import { DECK, isCardValue } from "./room";

describe("contrato do deck", () => {
  it("deck tem exatamente 10 cartas na ordem do spec", () => {
    expect(DECK).toEqual(["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"]);
  });

  it("rejeita valores fora do deck", () => {
    expect(isCardValue("4")).toBe(false);
    expect(isCardValue("0.5")).toBe(false);
    expect(isCardValue("☕")).toBe(true);
  });
});
