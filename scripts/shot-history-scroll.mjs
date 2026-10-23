import { chromium } from "@playwright/test";

/* Captura o painel de resultado rolado até o histórico: prova que as médias
   ficam legíveis no mobile mesmo com o painel curto. */
const BASE = process.env.BASE ?? "http://localhost:5174";
const OUT = process.env.OUT ?? "docs/design";

const browser = await chromium.launch();
for (const [name, width, height] of [
  ["mobile-390x844", 390, 844],
  ["mobile-320x568", 320, 568],
]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${BASE}/r/bcdfgh?mock=1`, { waitUntil: "networkidle" });
  await page.waitForSelector('button[data-value="5"]');
  for (let round = 1; round <= 12; round += 1) {
    await page.locator('button[data-value="5"]').click();
    await page.getByRole("button", { name: "Revelar cartas" }).click();
    if (round < 12) await page.getByRole("button", { name: "Nova rodada" }).click();
  }
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const history = document.querySelector('[aria-label="médias das rodadas anteriores"]');
    const body = history?.parentElement?.closest("section")?.querySelector(".overflow-y-auto");
    if (body) body.scrollTop = body.scrollHeight;
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${OUT}/historico-${name}-painel-rolado.png` });
  await context.close();
}
await browser.close();
