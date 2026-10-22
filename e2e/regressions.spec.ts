import { expect, test } from "@playwright/test";
import {
  BASE_URL,
  closePeers,
  createRoomAs,
  joinRoomAs,
  newContext,
  participant,
  participants,
  roomCodeFrom,
  roomHeading,
  vote,
} from "./support";

test.describe("casos de borda de review", () => {
  test("nome com HTML não injeta DOM", async ({ browser }) => {
    const host = await createRoomAs(browser, "Sprint 42", "<img src=x onerror=1>");
    const guest = await joinRoomAs(browser, host.code, "Bruno");

    const entry = participant(guest.page, "<img src=x onerror=1>");
    await expect(entry).toBeVisible();
    await expect(entry.locator("img")).toHaveCount(0);
    await expect(guest.page.locator("img[src='x']")).toHaveCount(0);
    await expect(guest.page.locator("aside").getByText("<img src=x onerror=1>", { exact: true })).toBeVisible();

    await closePeers(host, guest);
  });

  test("nome de 41+ caracteres é cortado em 40 sem quebrar a sidebar", async ({ browser }) => {
    const host = await createRoomAs(browser, "Sprint 42", "Ana");
    const longName = "Ana Beatriz de Souza Carvalho Albuquerque Lima Junior";
    const expected = Array.from(longName).slice(0, 40).join("");
    expect(expected).toHaveLength(40);

    const peer = await newContext(browser);
    await peer.context.addInitScript((name: string) => localStorage.setItem("pp:name", name), longName);
    await peer.page.goto(`/r/${host.code}`);

    const entry = participant(host.page, expected);
    await expect(entry).toBeVisible();
    await expect(participants(host.page).getByText(expected, { exact: true })).toHaveText(expected);

    const overflow = await participants(host.page).evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const listOverflow = await participants(host.page)
      .locator("ul")
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(listOverflow).toBeLessThanOrEqual(0);

    await closePeers(host, { context: peer.context, page: peer.page });
  });

  test("reveal sem nenhum voto não mostra NaN", async ({ browser }) => {
    const host = await createRoomAs(browser, "Sprint 42", "Ana");
    const guest = await joinRoomAs(browser, host.code, "Bruno");

    await host.page.getByRole("button", { name: "Revelar cartas" }).click();

    await expect(host.page.getByText("Nenhum voto nesta rodada.")).toBeVisible();
    await expect(guest.page.getByText("Nenhum voto nesta rodada.")).toBeVisible();
    await expect(host.page.locator("body")).not.toContainText("NaN");
    await expect(guest.page.locator("body")).not.toContainText("NaN");
    await expect(host.page.getByTestId("average")).toHaveCount(0);

    await closePeers(host, guest);
  });

  test("duas abas do mesmo usuário não duplicam a presença", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const first = await context.newPage();

    await first.goto("/");
    await first.getByLabel("Seu nome").fill("Ana");
    await first.getByLabel("Nome da sala").fill("Sprint 42");
    await first.getByRole("button", { name: "Criar sala" }).click();
    await expect(roomHeading(first)).toHaveText("Sprint 42");

    const second = await context.newPage();
    await second.goto(`/r/${roomCodeFrom(first)}`);
    await expect(roomHeading(second)).toHaveText("Sprint 42");
    await expect(participants(second).locator("li")).toHaveCount(1);

    await vote(first, "3");
    await expect(participant(second, "Ana")).toContainText("votou");

    await vote(second, "5");
    await expect(participant(first, "Ana")).toContainText("votou");
    await expect(first.getByRole("button", { name: "carta 5" })).toHaveAttribute("aria-pressed", "true");
    await expect(participants(second).locator("li")).toHaveCount(1);

    await context.close();
  });

  test("perder conexão mostra banner e reconectar volta a votar sem F5", async ({ browser }) => {
    const host = await createRoomAs(browser, "Sprint 42", "Ana");
    const guest = await joinRoomAs(browser, host.code, "Bruno");

    await host.context.setOffline(true);
    await expect(host.page.getByText("Sem conexão. Tentando reconectar.")).toBeVisible();

    await host.context.setOffline(false);
    await expect(host.page.getByText("Sem conexão. Tentando reconectar.")).toHaveCount(0);

    await vote(host.page, "8");
    await expect(participant(guest.page, "Ana")).toContainText("votou", { timeout: 20_000 });

    await closePeers(host, guest);
  });
});
