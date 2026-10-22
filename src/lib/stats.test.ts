import { describe, it, expect } from "vitest";
import { DECK, isCardValue, isNumericCard, numericValue } from "./deck";
import { computeStats } from "./stats";

describe("deck", () => {
  it("isNumericCard separa símbolos de números", () => {
    expect(DECK.filter(isNumericCard)).toEqual(["0", "1", "2", "3", "5", "8", "13", "21"]);
    expect(isNumericCard("?")).toBe(false);
    expect(isNumericCard("☕")).toBe(false);
  });

  it("numericValue devolve null para símbolos", () => {
    expect(numericValue("13")).toBe(13);
    expect(numericValue("0")).toBe(0);
    expect(numericValue("?")).toBeNull();
    expect(numericValue("☕")).toBeNull();
  });

  it("isCardValue rejeita lixo", () => {
    expect(isCardValue("4")).toBe(false);
    expect(isCardValue("")).toBe(false);
    expect(isCardValue("21")).toBe(true);
  });
});

describe("computeStats", () => {
  it("média e mediana ignoram ? e ☕", () => {
    expect(computeStats(["1", "2", "?", "☕"])).toMatchObject({ average: 1.5, median: 1.5, consensus: false });
  });

  it("consenso exige todos os votos iguais, inclusive símbolos", () => {
    expect(computeStats(["5", "5"]).consensus).toBe(true);
    expect(computeStats(["?", "?"]).consensus).toBe(true);
    expect(computeStats(["5", "8"]).consensus).toBe(false);
  });

  it("sem votos devolve nulos, nunca NaN", () => {
    expect(computeStats([])).toEqual({ average: null, median: null, consensus: false, counts: {} });
  });

  it("só símbolos devolve média nula mas conta a distribuição", () => {
    const stats = computeStats(["?", "☕"]);
    expect(stats.average).toBeNull();
    expect(stats.median).toBeNull();
    expect(stats.counts).toEqual({ "?": 1, "☕": 1 });
    expect(stats.consensus).toBe(false);
  });

  it("mediana de quantidade par é a média dos dois centrais", () => {
    expect(computeStats(["1", "2", "8", "13"]).median).toBe(5);
  });

  it("mediana de quantidade ímpar é o valor central", () => {
    expect(computeStats(["1", "13", "21"]).median).toBe(13);
  });

  it("média arredonda para duas casas", () => {
    expect(computeStats(["1", "2", "2"]).average).toBe(1.67);
  });

  it("conta zero e todos os valores do deck", () => {
    expect(computeStats(["0", "0", "1"]).average).toBe(0.33);
    expect(computeStats([...DECK]).counts).toEqual(Object.fromEntries(DECK.map((card) => [card, 1])));
  });

  it("counts soma repetições", () => {
    expect(computeStats(["3", "3", "5"]).counts).toEqual({ "3": 2, "5": 1 });
  });
});
