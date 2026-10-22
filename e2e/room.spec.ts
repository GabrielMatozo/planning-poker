import { expect, test } from "@playwright/test";
import {
  BASE_URL,
  closePeers,
  createRoomAs,
  joinRoomAs,
  participant,
  participants,
  roomHeading,
  vote,
} from "./support";

test.describe("sala em tempo real", () => {
  test("dois usuários votam e o reveal mostra a média", async ({ browser }) => {
    const host = await createRoomAs(browser, "Sprint 42", "Ana");
    const guest = await joinRoomAs(browser, host.code, "Bruno");

    await expect(participants(host.page).locator("li")).toHaveCount(2);

    await vote(host.page, "3");
    await expect(participant(guest.page, "Ana")).toContainText("votou");

    await vote(guest.page, "5");
    await expect(participant(host.page, "Bruno")).toContainText("votou");

    await host.page.getByRole("button", { name: "Revelar cartas" }).click();

    await expect(host.page.getByTestId("average")).toHaveText("4");
    await expect(guest.page.getByTestId("average")).toHaveText("4");
    await expect(participant(guest.page, "Ana")).toContainText("3");
    await expect(participant(guest.page, "Bruno")).toContainText("5");

    await closePeers(host, guest);
  });

  test("F5 mantém o nome na lista do outro usuário", async ({ browser }) => {
    const host = await createRoomAs(browser, "Sprint 42", "Ana");
    const guest = await joinRoomAs(browser, host.code, "Bruno");

    await vote(host.page, "5");
    await expect(participant(guest.page, "Ana")).toContainText("votou");

    await host.page.reload();

    await expect(roomHeading(host.page)).toHaveText("Sprint 42");
    await expect(host.page.getByRole("button", { name: "Revelar cartas" })).toBeVisible();
    await expect(host.page.getByRole("button", { name: "carta 5" })).toHaveAttribute("aria-pressed", "true");

    await expect(participants(guest.page).locator("li")).toHaveCount(2);
    await expect(participant(guest.page, "Ana")).toHaveCount(1);
    await expect(guest.page.getByRole("button", { name: "Revelar cartas" })).toHaveCount(0);

    await closePeers(host, guest);
  });

  test("F5 no instante do reveal mantém média, host e nenhum voto fantasma", async ({ browser }) => {
    const host = await createRoomAs(browser, "Sprint 42", "Ana");
    const guest = await joinRoomAs(browser, host.code, "Bruno");

    await vote(host.page, "3");
    await vote(guest.page, "5");
    await host.page.getByRole("button", { name: "Revelar cartas" }).click();
    await expect(guest.page.getByTestId("average")).toHaveText("4");

    await host.page.reload();

    await expect(host.page.getByTestId("average")).toHaveText("4");
    await expect(host.page.getByRole("button", { name: "Nova rodada" })).toBeVisible();
    await expect(guest.page.getByRole("button", { name: "Revelar cartas" })).toHaveCount(0);
    await expect(participants(guest.page).locator("li")).toHaveCount(2);
    await expect(participant(guest.page, "Ana")).toContainText("3");
    await expect(participant(guest.page, "Bruno")).toContainText("5");

    await closePeers(host, guest);
  });

  test("fechar a aba do host transfere o host", async ({ browser }) => {
    test.setTimeout(150_000);

    const host = await createRoomAs(browser, "Sprint 42", "Ana");
    const guest = await joinRoomAs(browser, host.code, "Bruno");
    await expect(guest.page.getByRole("button", { name: "Revelar cartas" })).toHaveCount(0);

    await host.context.close();

    await expect(guest.page.getByRole("button", { name: "Revelar cartas" })).toBeVisible({ timeout: 100_000 });
    await guest.page.getByRole("button", { name: "Revelar cartas" }).click();
    await expect(guest.page.getByText("Nenhum voto nesta rodada.")).toBeVisible();

    await closePeers(guest);
  });

  test("nova rodada limpa votos e mantém participantes", async ({ browser }) => {
    const host = await createRoomAs(browser, "Sprint 42", "Ana");
    const guest = await joinRoomAs(browser, host.code, "Bruno");

    await vote(host.page, "3");
    await vote(guest.page, "5");
    await expect(participant(guest.page, "Ana")).toContainText("votou");
    await expect(participant(host.page, "Bruno")).toContainText("votou");

    await host.page.getByRole("button", { name: "Revelar cartas" }).click();
    await expect(host.page.getByTestId("average")).toHaveText("4");

    await host.page.getByRole("button", { name: "Nova rodada" }).click();

    await expect(host.page.getByText("rodada 2")).toBeVisible();
    await expect(host.page.getByTestId("average")).toHaveCount(0);
    await expect(participants(host.page).locator("li")).toHaveCount(2);
    await expect(participant(host.page, "Ana")).toContainText("aguardando");
    await expect(participant(guest.page, "Bruno")).toContainText("aguardando");
    await expect(participant(guest.page, "Ana")).toContainText("aguardando");

    await vote(guest.page, "8");
    await expect(participant(host.page, "Bruno")).toContainText("votou");

    await closePeers(host, guest);
  });

  test("sala inexistente mostra estado de erro sem quebrar", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();

    await page.goto("/r/ZZZZZZ");

    await expect(page.getByRole("heading", { name: "Sala não encontrada" })).toBeVisible();
    await expect(page.getByText("zzzzzz", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Revelar cartas" })).toHaveCount(0);

    await page.getByRole("button", { name: "Voltar ao início" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Estimem sem se influenciar");

    await context.close();
  });
});
