import { test, expect } from "@playwright/test";

/*
  Fluxo de kick:
  1. Ana abre ?mock=1 (host, uid único).
  2. Bruno abre ?mock=1 (uid único diferente) e entra como "Bruno".
  3. Ana kicka Bruno.
  4. Bruno vê tela de bloqueio com contagem regressiva.
  5. Bruno pode reentrar com nome diferente.
  6. Ana vê que Bruno sumiu da lista e depois vê "Bruno2".
*/
const BASE = "http://localhost:5173";

test.describe("kick de participante", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("host kicka participante e ele vê tela de bloqueio", async ({ page, context }) => {
    // Abre como Ana (host) em uma aba
    await page.goto(`${BASE}/r/bcdfgh?mock=1`, { waitUntil: "networkidle" });
    await page.waitForSelector('button[data-value="5"]');

    // Abre nova aba como Bruno
    const brunoPage = await context.newPage();
    await brunoPage.goto(`${BASE}/r/bcdfgh?mock=1`, { waitUntil: "networkidle" });

    // Bruno entra na sala como "Bruno"
    await brunoPage.getByLabel("Nome").fill("Bruno");
    await brunoPage.getByRole("button", { name: "Entrar na sala" }).click();
    await brunoPage.waitForSelector('button[data-value="5"]');

    // Ana vê Bruno na lista
    await expect(page.getByText("Bruno")).toBeVisible({ timeout: 5000 });

    // Ana kicka Bruno
    const brunoRow = page.locator("[data-testid='participant-row']").filter({ hasText: "Bruno" });
    const kickBtn = brunoRow.getByRole("button", { name: "Expulsar" });
    await kickBtn.click();

    // Bruno some da lista de Ana
    await expect(page.getByText("Bruno")).not.toBeVisible({ timeout: 5000 });

    // Bruno vê a tela de bloqueio (KickScreen)
    await expect(brunoPage.getByText("Você foi expulso da sala")).toBeVisible({ timeout: 5000 });

    // Bruno pode reentrar com nome diferente
    const newName = brunoPage.getByLabel("Nome");
    await newName.fill("Bruno2");
    await brunoPage.getByRole("button", { name: "Entrar" }).click();

    // Bruno2 entra na sala
    await expect(brunoPage.getByText("Bruno2")).toBeVisible({ timeout: 5000 });

    // Ana vê Bruno2 na lista
    await expect(page.getByText("Bruno2")).toBeVisible({ timeout: 5000 });

    await brunoPage.close();
  });
});