import { expect, test } from "@playwright/test";
import { closePeers, createRoomAs, newContext, participant, participants, vote } from "./support";

test.describe("entrada pelo link sem nome salvo", () => {
  test("pede o nome, entra na lista do host e consegue votar", async ({ browser }) => {
    const host = await createRoomAs(browser, "Sprint 42", "Ana");

    const guest = await newContext(browser);
    await guest.context.addInitScript(() => localStorage.removeItem("pp:name"));

    await guest.page.goto(`/r/${host.code}`);

    await expect(guest.page.getByLabel("Seu nome")).toBeVisible();
    await expect(guest.page.getByRole("button", { name: "Entrar na sala" })).toBeVisible();
    await expect(guest.page.getByRole("button", { name: "carta 3" })).toHaveCount(0);
    await expect(participants(host.page).locator("li")).toHaveCount(1);

    await guest.page.getByLabel("Seu nome").fill("Bruno");
    await guest.page.getByRole("button", { name: "Entrar na sala" }).click();

    await expect(participants(host.page).locator("li")).toHaveCount(2);
    await expect(participant(host.page, "Bruno")).toBeVisible();
    await expect(guest.page.getByRole("button", { name: "Entrar na sala" })).toHaveCount(0);

    await vote(guest.page, "5");
    await expect(participant(host.page, "Bruno")).toContainText("votou");

    await host.page.getByRole("button", { name: "Revelar cartas" }).click();
    await expect(participant(host.page, "Bruno")).toContainText("5");

    await closePeers(host, guest);
  });
});
