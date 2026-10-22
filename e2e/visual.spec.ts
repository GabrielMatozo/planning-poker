import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = "http://localhost:5173";

async function audit(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));

  expect(summary, `violações em ${label}`).toEqual([]);
}

test("home sem violações AA", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /criar sala/i }).waitFor();
  await audit(page, "home");
});

test("gate de nome sem violações AA", async ({ page, browser }) => {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Seu nome").fill("Axe");
  await page.getByLabel("Nome da sala").fill("Auditoria");
  await page.getByRole("button", { name: /criar sala/i }).click();
  await page.waitForURL(/\/r\/.+/);

  const code = page.url().split("/r/")[1];

  // Contexto novo: uid novo, sem pp:name, abrindo o link direto da sala.
  const fresh = await browser.newContext();
  const gated = await fresh.newPage();
  await gated.goto(`${BASE}/r/${code}`, { waitUntil: "domcontentloaded" });
  await gated.getByLabel("Seu nome", { exact: true }).waitFor();

  await audit(gated, "gate de nome");
  await fresh.close();
});

test("sala e reveal sem violações AA", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Seu nome").fill("Axe");
  await page.getByLabel("Nome da sala").fill("Auditoria de sala");
  await page.getByRole("button", { name: /criar sala/i }).click();
  await page.waitForURL(/\/r\/.+/);

  await page.locator('button[data-value="5"]').click();
  await audit(page, "sala em votação");

  await page.getByRole("button", { name: /revelar cartas/i }).click();
  await page.getByTestId("average").waitFor();
  await audit(page, "sala revelada");
});
