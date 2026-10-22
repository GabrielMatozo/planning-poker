import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

export const BASE_URL = "http://localhost:5173";
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const ROOM_URL = new RegExp(`/r/[${CODE_ALPHABET}]{6}$`);

export type Peer = { context: BrowserContext; page: Page };
export type RoomPeer = Peer & { code: string };

export function roomHeading(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}

export function participants(page: Page): Locator {
  return page.getByRole("complementary", { name: "Participantes" });
}

export function participant(page: Page, name: string): Locator {
  return participants(page)
    .locator("li")
    .filter({ has: page.getByText(name, { exact: true }) });
}

export function roomCodeFrom(page: Page): string {
  return page.url().split("/").pop() ?? "";
}

export async function newContext(browser: Browser): Promise<Peer> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  return { context, page };
}

export async function createRoomAs(browser: Browser, roomName: string, userName: string): Promise<RoomPeer> {
  const peer = await newContext(browser);
  await peer.page.goto("/");
  await peer.page.getByLabel("Seu nome").fill(userName);
  await peer.page.getByLabel("Nome da sala").fill(roomName);
  await peer.page.getByRole("button", { name: "Criar sala" }).click();

  await expect(peer.page).toHaveURL(ROOM_URL);
  await expect(roomHeading(peer.page)).toHaveText(roomName);

  return { ...peer, code: roomCodeFrom(peer.page) };
}

export async function joinRoomAs(browser: Browser, code: string, userName: string): Promise<Peer> {
  const peer = await newContext(browser);
  await peer.page.goto("/");
  await peer.page.getByLabel("Seu nome").fill(userName);
  await peer.page.getByLabel("Código da sala").fill(code);
  await peer.page.getByRole("button", { name: "Entrar na sala" }).click();

  await expect(peer.page).toHaveURL(new RegExp(`/r/${code}$`));
  await expect(participant(peer.page, userName)).toBeVisible();

  return peer;
}

export async function vote(page: Page, card: string): Promise<void> {
  await page.getByRole("button", { name: `carta ${card}` }).click();
}

export async function closePeers(...peers: Peer[]): Promise<void> {
  await Promise.all(peers.map((peer) => peer.context.close()));
}
