import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Room } from "./Room";
import { RoomContext } from "../app/room-context";
import type { Participant, RoomActions, RoomState } from "../types/room";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const HOST: Participant = {
  uid: "host-1",
  name: "Ana",
  color: "#D9A05B",
  online: true,
  lastSeen: Date.now(),
  joinedAt: 1,
  hasVoted: false,
  vote: null,
};

function stateWith(overrides: Partial<RoomState> = {}): RoomState {
  return {
    status: "ready",
    me: { uid: "u-2", name: "" },
    meta: {
      id: "abc234",
      name: "Sprint 42",
      hostId: HOST.uid,
      revealed: false,
      round: 1,
      autoReveal: false,
    },
    participants: [HOST],
    myVote: null,
    stats: null,
    history: [],
    ...overrides,
  };
}

function renderWithActions(state: RoomState, actions: RoomActions, roomId = "abc234") {
  render(
    <MemoryRouter>
      <RoomContext.Provider value={{ state, actions }}>
        <Room roomId={roomId} />
      </RoomContext.Provider>
    </MemoryRouter>,
  );
}

function actionsWith(overrides: Partial<RoomActions> = {}): RoomActions {
  return {
    join: vi.fn(async () => {}),
    vote: vi.fn(async () => {}),
    reveal: vi.fn(async () => {}),
    newRound: vi.fn(async () => {}),
    setAutoReveal: vi.fn(async () => {}),
    kick: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderRoom(state: RoomState) {
  const join = vi.fn(async (_name: string) => {});
  renderWithActions(state, actionsWith({ join }));
  return { join };
}

describe("entrada pelo link sem nome salvo", () => {
  it("mostra o gate e não renderiza o palco de votação", async () => {
    renderRoom(stateWith());
    await new Promise(r => setTimeout(r, 500));

    await waitFor(() => {
      expect(screen.getByLabelText("Seu nome")).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByRole("button", { name: "Entrar na sala" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "carta 3" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Revelar cartas" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Participantes" })).toBeNull();
  });

  it("nome vazio mostra erro inline sem chamar join", async () => {
    const { join } = renderRoom(stateWith());
    await new Promise(r => setTimeout(r, 500));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Entrar na sala" })).toBeInTheDocument();
    }, { timeout: 3000 });
    await userEvent.click(screen.getByRole("button", { name: "Entrar na sala" }));

    expect(await screen.findByText("Informe seu nome para continuar.")).toBeInTheDocument();
    expect(join).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "carta 3" })).toBeNull();
  });

  it("nome válido entra com o valor normalizado", async () => {
    const { join } = renderRoom(stateWith());
    await new Promise(r => setTimeout(r, 500));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Entrar na sala" })).toBeInTheDocument();
    }, { timeout: 3000 });
    const input = screen.getByLabelText("Seu nome");
    const button = screen.getByRole("button", { name: "Entrar na sala" });
    await userEvent.type(input, "  Bruno  ");
    await userEvent.click(button);

    expect(join).toHaveBeenCalledTimes(1);
    expect(join).toHaveBeenCalledWith("Bruno");
  });

  it("com nome já definido mostra o palco direto", () => {
    renderRoom(stateWith({ me: { uid: "u-2", name: "Bruno" } }));

    expect(screen.queryByLabelText("Seu nome")).toBeNull();
    expect(screen.getByRole("button", { name: "carta 3" })).toBeInTheDocument();
  });

  it("mostra o nome da sala para quem chega pelo link", async () => {
    const base = stateWith();
    renderRoom({ ...base, meta: base.meta ? { ...base.meta, name: "Refino do onboarding" } : null });
    await new Promise(r => setTimeout(r, 500));

    await waitFor(() => {
      expect(screen.getByLabelText("Seu nome")).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(screen.getByText("Refino do onboarding")).toBeInTheDocument();
  });

  it("limita o nome a 40 caracteres e descarta invisíveis", async () => {
    const { join } = renderRoom(stateWith());
    await new Promise(r => setTimeout(r, 600));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Entrar na sala" })).toBeInTheDocument();
    }, { timeout: 5000 });
    const input = screen.getByLabelText("Seu nome");
    const button = screen.getByRole("button", { name: "Entrar na sala" });
    await userEvent.type(input, `A\u200Bna${"x".repeat(60)}`);
    await userEvent.click(button);

    expect(join).toHaveBeenCalledTimes(1);
    const sent = join.mock.calls[0]?.[0] as string;
    expect(sent).toHaveLength(40);
    expect(sent).not.toContain("\u200B");
  });

  it("não vaza erro técnico quando o join falha", async () => {
    const join = vi.fn(async (_name: string) => {
      throw new Error("Firebase: Error (auth/network-request-failed).");
    });
    renderWithActions(stateWith(), actionsWith({ join }));
    await new Promise(r => setTimeout(r, 500));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Entrar na sala" })).toBeInTheDocument();
    }, { timeout: 3000 });
    const input = screen.getByLabelText("Seu nome");
    const button = screen.getByRole("button", { name: "Entrar na sala" });
    await userEvent.type(input, "Bruno");
    await userEvent.click(button);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível entrar na sala. Tente de novo.");
    expect(alert.textContent).not.toMatch(/firebase|auth\//i);
    expect(screen.queryByRole("button", { name: "carta 3" })).toBeNull();
  });
});

describe("código inválido na URL", () => {
  it("mostra o código cortado, sem estourar a tela", () => {
    renderWithActions(stateWith({ status: "not-found" }), actionsWith(), "x".repeat(300));

    expect(screen.getByText("Sala não encontrada")).toBeInTheDocument();
    expect(screen.getByText("xxxxxxxxxxxx…")).toBeInTheDocument();
    expect(screen.queryByText("x".repeat(300))).toBeNull();
    expect(screen.getByRole("button", { name: "Voltar ao início" })).toBeInTheDocument();
  });
});

describe("erro ao executar ação", () => {
  it("mostra o erro em português e deixa tentar de novo ou fechar", async () => {
    const vote = vi.fn(async (_value: string) => {
      throw Object.assign(new Error("PERMISSION_DENIED: Permission denied"), { code: "PERMISSION_DENIED" });
    });
    renderWithActions(stateWith({ me: { uid: "u-2", name: "Bruno" } }), actionsWith({ vote }));

    await userEvent.click(screen.getByRole("button", { name: "carta 3" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/sem permissão/i);
    expect(alert.textContent).not.toMatch(/permission|firebase|sdk/i);

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(vote).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
