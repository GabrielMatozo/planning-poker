import { chromium } from "@playwright/test";

/*
  Medição do layout da sala em viewports reais. Prova quatro coisas por captura:
  o histórico é alcançável (sem rolagem ou pelo atalho do rodapé), o documento
  não rola (nem na horizontal), a última carta do deck segue dentro da dobra e
  o atalho aparece/desaparece onde deve. Uso:
    BASE=http://localhost:5173 LABEL=depois OUT=docs/design node scripts/measure-layout.mjs
*/
const BASE = process.env.BASE ?? "http://localhost:5173";
const OUT = process.env.OUT ?? "/tmp";
const label = process.env.LABEL ?? "depois";

const VIEWPORTS = (process.env.VIEWPORTS ?? "desktop-1440x900,tablet-768x900,mobile-390x844,mobile-360x640,mobile-320x568")
  .split(",")
  .map((name) => {
    const [w, h] = name.split("-")[1].split("x").map(Number);
    return { name, width: w, height: h };
  });

const browser = await chromium.launch();

function measure(page) {
  return page.evaluate(() => {
    const history = document.querySelector('[aria-label="médias das rodadas anteriores"]');
    const panel = history?.parentElement?.closest("section") ?? null;
    const body = panel?.querySelector(".overflow-y-auto") ?? null;
    const items = history ? [...history.querySelectorAll("ol > li")] : [];
    const outsideViewport = items.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > window.innerWidth + 0.5 || r.left < -0.5;
    }).length;
    const lastCard = [...document.querySelectorAll("button[data-value]")].pop();
    const lastRect = lastCard?.getBoundingClientRect() ?? null;
    const gate = document.querySelector('[data-testid="history-jump"]');
    const gateRect = gate?.getBoundingClientRect() ?? null;
    const fade = document.querySelector('[data-testid="result-fade"]');
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };
    const view = body?.getBoundingClientRect() ?? null;
    const head = history?.getBoundingClientRect() ?? null;
    const headerInside = Boolean(view && head && head.top >= view.top - 1 && head.top < view.bottom);
    return {
      historyItems: items.length,
      historyOutsideViewport: outsideViewport,
      historyWidth: head ? Math.round(head.width) : null,
      historyHeaderVisible: headerInside,
      historyScrollsInsidePanel: body ? body.scrollHeight > body.clientHeight + 1 : null,
      docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      docScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight,
      lastCardBottom: lastRect ? Math.round(lastRect.bottom) : null,
      lastCardVisible: lastRect ? lastRect.bottom <= window.innerHeight && lastRect.top >= 0 : null,
      // Como o usuário descobre o resto do painel: o atalho no rodapé, com a
      // última média e a contagem, e o desbotamento na borda do corpo.
      gate: gate
        ? {
            label: gate.getAttribute("aria-label"),
            height: gateRect ? Math.round(gateRect.height) : null,
            visible: gateRect ? gateRect.top >= 0 && gateRect.bottom <= window.innerHeight : false,
          }
        : null,
      fadeVisible: fade ? Number(getComputedStyle(fade).opacity) > 0.5 : false,
      panel: rect(panel),
      panelBody: body ? { clientHeight: body.clientHeight, scrollHeight: body.scrollHeight } : null,
      tray: rect(document.querySelector(".room-tray")),
      participants: rect(document.querySelector('[aria-label="Participantes"]')),
    };
  });
}

// Deixa a sala com `rounds` rodadas fechadas e o painel revelado na última.
async function seed(page, rounds) {
  if (rounds > 0) {
    for (let r = 1; r <= rounds; r += 1) {
      await page.locator('button[data-value="5"]').click();
      await page.getByRole("button", { name: "Revelar cartas" }).click();
      if (r < rounds) await page.getByRole("button", { name: "Nova rodada" }).click();
    }
  } else {
    await page.getByRole("button", { name: "Revelar cartas" }).click();
  }
  await page.waitForTimeout(150);
}

// Aciona o atalho como o teclado faria e confere se o cabeçalho do histórico
// entrou na área visível do painel sem mexer na altura do deck.
async function useGate(page) {
  const gate = page.getByTestId("history-jump");
  if ((await gate.count()) === 0) return null;

  await gate.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);

  const reached = await page.evaluate(() => {
    const section = document.querySelector('[aria-label="médias das rodadas anteriores"]');
    const panel = section.parentElement.closest("section");
    const body = panel.querySelector(".overflow-y-auto");
    const view = body.getBoundingClientRect();
    const head = section.getBoundingClientRect();
    const lastCard = [...document.querySelectorAll("button[data-value]")].pop();
    return {
      headerInside: head.top >= view.top - 1 && head.top < view.bottom,
      headerOffset: Math.round(head.top - view.top),
      focused: document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName ?? null,
      gateLabel: document.querySelector('[data-testid="history-jump"]')?.getAttribute("aria-label") ?? null,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight,
      lastCardBottom: lastCard ? Math.round(lastCard.getBoundingClientRect().bottom) : null,
    };
  });

  return reached;
}

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const results = {};

  for (const rounds of [0, 5, 30]) {
    const page = await context.newPage();
    await page.goto(`${BASE}/r/bcdfgh?mock=1`, { waitUntil: "networkidle" });
    await page.waitForSelector('button[data-value="5"]');
    await seed(page, rounds);
    await page.evaluate(() => window.scrollTo(0, 0));
    results[`rounds${rounds}`] = await measure(page);
    await page.screenshot({ path: `${OUT}/${label}-${vp.name}-${rounds}.png` });

    const reached = await useGate(page);
    if (reached) {
      results[`rounds${rounds}`].afterGate = reached;
      await page.screenshot({ path: `${OUT}/${label}-${vp.name}-${rounds}-historico.png` });
    }
    await page.close();
  }

  console.log(vp.name, JSON.stringify(results, null, 2));
  await context.close();
}

await browser.close();
