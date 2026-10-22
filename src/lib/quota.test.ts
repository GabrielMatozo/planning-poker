import { afterEach, describe, expect, it } from "vitest";
import {
  checkQuota,
  getQuotaInfo,
  isQuotaDisabled,
  QuotaExceededError,
} from "./quota";

function seed(uid: string, count: number, offsetMs = 0): void {
  for (let i = 0; i < count; i++) {
    // Manipula diretamente o localStorage para simular criações passadas
    const key = "pp:quota:creations";
    let log: { uid: string; ts: number }[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) log = JSON.parse(raw);
    } catch {}
    log.push({ uid, ts: Date.now() - offsetMs - i * 100 });
    localStorage.setItem(key, JSON.stringify(log));
  }
}

afterEach(() => {
  localStorage.removeItem("pp:quota:creations");
});

describe("quota", () => {
  it("permite criação quando não há registro", async () => {
    await expect(checkQuota("uid-1")).resolves.toBeUndefined();
  });

  it("bloqueia após 5 criações no mesmo minuto", async () => {
    seed("uid-1", 5, 10_000); // todas há ~10s
    await expect(checkQuota("uid-1")).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("permite após窗口 expirar", async () => {
    seed("uid-1", 5, 70_000); // todas há ~70s
    await expect(checkQuota("uid-1")).resolves.toBeUndefined();
  });

  it("bloqueia após 20 criações na hora", async () => {
    seed("uid-1", 20, 30_000);
    await expect(checkQuota("uid-1")).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("getQuotaInfo reflete estado correto", () => {
    expect(getQuotaInfo("uid-x").canCreate).toBe(true);
    seed("uid-1", 5, 5_000);
    expect(getQuotaInfo("uid-1").canCreate).toBe(false);
    expect(getQuotaInfo("uid-1").retryMs).toBeGreaterThan(0);
  });

  it("isQuotaDisabled verifica flag", () => {
    // Em produção (sem flag) volta false
    expect(isQuotaDisabled()).toBe(false);
  });
});
