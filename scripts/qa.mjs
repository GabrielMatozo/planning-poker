import { chromium } from "@playwright/test";

const B = "http://localhost:5173";
const out = "docs/design";
const NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabi", "Hugo", "Iris"];
const VOTES = ["1", "2", "3", "5", "8", "13", "?", "☕", "3"];

const browser = await chromium.launch();
const shot = async (page, name, width) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: false });
  console.log(`shot ${name}-${width}`);
};

// Home
for (const width of [1440, 834, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(B, { waitUntil: "domcontentloaded" });
  await shot(page, "home", width);
  await ctx.close();
}

// Cria a sala com 8 pessoas votando
const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const host = await hostCtx.newPage();
await host.goto(B, { waitUntil: "domcontentloaded" });
await host.getByLabel("Seu nome").fill(NAMES[0]);
await host.getByLabel("Nome da sala").fill("Sprint 42");
await host.getByRole("button", { name: /criar sala/i }).click();
await host.waitForURL(/\/r\/.+/, { timeout: 15000 });
const code = host.url().split("/r/")[1];

const guests = [];
for (let i = 1; i < 5; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${B}/r/${code}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Seu nome", { exact: true }).fill(NAMES[i]);
  await page.getByRole("button", { name: /entrar na sala/i }).click();
  await page.locator(`button[data-value="${VOTES[i]}"]`).click().catch(() => {});
  guests.push({ ctx, page });
  await host.waitForTimeout(400);
}
await host.locator('button[data-value="3"]').click();
await host.waitForTimeout(800);

// Sala com 8 pessoas, sem reveal
for (const width of [1440, 834, 390]) {
  await host.setViewportSize({ width, height: 900 });
  await shot(host, "sala-8", width);
}

// Reveal (Ana é host)
await host.getByRole("button", { name: /revelar cartas/i }).click();
await host.waitForTimeout(1400);
for (const width of [1440, 834, 390]) {
  await host.setViewportSize({ width, height: 900 });
  await shot(host, "reveal", width);
}

// Gate de nome (navegador sem pp:name)
const gateCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const gate = await gateCtx.newPage();
await gate.goto(`${B}/r/${code}`, { waitUntil: "domcontentloaded" });
await gate.getByLabel("Seu nome", { exact: true }).waitFor();
await shot(gate, "gate-nome", 390);
await gateCtx.close();

// Sala não encontrada
const miss = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const missPage = await miss.newPage();
await missPage.goto(`${B}/r/zzzzzz`, { waitUntil: "domcontentloaded" });
await shot(missPage, "nao-encontrada", 1440);
await miss.close();

for (const g of guests) await g.ctx.close();
await hostCtx.close();
await browser.close();
console.log(`ROOM=${code}`);
