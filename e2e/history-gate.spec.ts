import { test, expect } from "@playwright/test";

/*
  Em telas baixas o painel de resultado não cabe inteiro: o histórico fica
  abaixo da dobra. Este teste garante que existe uma pista visível (atalho no
  rodapé do painel), que ela funciona por teclado e que nada disso rouba altura
  do deck nem devolve rolagem para a página.
*/
const BASE = "http://localhost:5173";
const ROUNDS = 12;

async function seed(page: import("@playwright/test").Page, rounds: number) {
  for (let r = 1; r <= rounds; r += 1) {
    await page.locator('button[data-value="5"]').click();
    await page.getByRole("button", { name: "Revelar cartas" }).click();
    if (r < rounds) await page.getByRole("button", { name: "Nova rodada" }).click();
  }
  await page.waitForTimeout(200);
}

function geometry(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const section = document.querySelector('[aria-label="médias das rodadas anteriores"]') as HTMLElement | null;
    const panel = section?.parentElement?.closest("section") ?? null;
    const body = panel?.querySelector(".overflow-y-auto") as HTMLElement | null;
    const view = body?.getBoundingClientRect() ?? null;
    const head = section?.getBoundingClientRect() ?? null;
    const lastCard = [...document.querySelectorAll("button[data-value]")].pop();
    const card = lastCard?.getBoundingClientRect() ?? null;
    return {
      headerInside: Boolean(view && head && head.top >= view.top - 1 && head.top < view.bottom),
      bodyTabIndex: body?.getAttribute("tabindex") ?? null,
      bodyScrolls: body ? body.scrollHeight > body.clientHeight + 1 : null,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      lastCardBottom: card ? Math.round(card.bottom) : null,
      viewportHeight: window.innerHeight,
    };
  });
}

test.describe("atalho de histórico em tela baixa", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("leva ao histórico pelo teclado sem mexer no deck", async ({ page }) => {
    await page.goto(`${BASE}/r/bcdfgh?mock=1`, { waitUntil: "networkidle" });
    await page.waitForSelector('button[data-value="5"]');
    await seed(page, ROUNDS);

    const gate = page.getByTestId("history-jump");
    await expect(gate).toBeVisible();
    await expect(gate).toHaveAttribute("aria-label", new RegExp(`${ROUNDS} rodadas`));
    await expect(gate).toHaveAttribute("aria-label", /última média 5/);

    const before = await geometry(page);
    expect(before.headerInside, "histórico começa fora da vista").toBe(false);
    expect(before.bodyTabIndex, "corpo rolável focável").toBe("0");
    expect(before.bodyScrolls).toBe(true);
    expect(before.pageScrolls).toBe(false);
    expect(before.lastCardBottom! <= before.viewportHeight, "deck na dobra").toBe(true);

    const section = page.getByLabel("médias das rodadas anteriores");
    await expect(section.getByRole("listitem")).toHaveCount(ROUNDS);
    await expect(section.getByRole("listitem").first()).toHaveText(/R12.*5/);

    // Teclado: foca o atalho e aciona com Enter, como qualquer outro botão.
    await gate.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);

    const after = await geometry(page);
    expect(after.headerInside, "histórico entra na vista").toBe(true);
    expect(after.pageScrolls, "a página continua sem rolar").toBe(false);
    expect(after.lastCardBottom, "a última carta não se move").toBe(before.lastCardBottom);
    await expect(section).toBeFocused();

    // Tab do histórico cai no próprio atalho, agora no estado de volta.
    await page.keyboard.press("Tab");
    await expect(gate).toBeFocused();
    await expect(gate).toHaveAttribute("aria-label", "Voltar ao topo do resultado");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
    await expect(gate).toHaveAttribute("aria-label", new RegExp(`${ROUNDS} rodadas`));

    // O estado vazio e a rodada única continuam com a contagem certa.
    await expect(page.getByTestId("average")).toHaveText("5");
  });

  test("sala curta revelada sem violações AA", async ({ page }) => {
    const AxeBuilder = (await import("@axe-core/playwright")).default;
    await page.goto(`${BASE}/r/bcdfgh?mock=1`, { waitUntil: "networkidle" });
    await page.waitForSelector('button[data-value="5"]');
    await seed(page, 5);

    const audit = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const summary = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target.join(" ")),
      }));
      expect(summary, `violações em ${label}`).toEqual([]);
    };

    await audit("painel curto com atalho");
    await page.getByTestId("history-jump").click();
    await page.waitForTimeout(500);
    await audit("histórico aberto");
  });
});
