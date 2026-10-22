import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { Participant, RoundStats } from "../../types/room";
import { MockRoomProvider } from "../../data/mock/mock-provider";
import { Room } from "../../routes/Room";
import { VoteDeck } from "./VoteDeck";
import { RevealResult } from "./RevealResult";
import { HostControls } from "./HostControls";
import { RoundHistory } from "./RoundHistory";

afterEach(cleanup);

const NOW = 1_700_000_100_000;

function participant(overrides: Partial<Participant>): Participant {
  return {
    uid: "u1",
    name: "Ana",
    color: "#D9A05B",
    online: true,
    lastSeen: NOW - 1_000,
    joinedAt: 1,
    hasVoted: false,
    vote: null,
    ...overrides,
  };
}

function stats(overrides: Partial<RoundStats>): RoundStats {
  return { average: null, median: null, consensus: false, counts: {}, ...overrides };
}

function renderResult(overrides?: Partial<ComponentProps<typeof RevealResult>>) {
  return render(
    <RevealResult
      stats={null}
      revealed={false}
      participants={[participant({})]}
      now={NOW}
      autoReveal={false}
      {...overrides}
    />,
  );
}

describe("deck de votação", () => {
  it("chama onVote com o valor da carta", async () => {
    const onVote = vi.fn();
    render(<VoteDeck myVote={null} revealed={false} onVote={onVote} />);

    await userEvent.click(screen.getByRole("button", { name: "carta 8" }));
    expect(onVote).toHaveBeenCalledWith("8");
  });

  it("marca a carta escolhida com aria-pressed", () => {
    render(<VoteDeck myVote="13" revealed={false} onVote={vi.fn()} />);

    expect(screen.getByRole("button", { name: "carta 13" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "carta 5" })).toHaveAttribute("aria-pressed", "false");
  });

  it("trava todas as cartas depois do reveal", () => {
    render(<VoteDeck myVote="8" revealed onVote={vi.fn()} />);

    const cards = screen.getAllByRole("button");
    expect(cards).toHaveLength(10);
    for (const card of cards) expect(card).toBeDisabled();
  });
});

describe("resultado da rodada", () => {
  it("mostra média e mediana em pt-BR", () => {
    renderResult({
      revealed: true,
      participants: [participant({ vote: "1", hasVoted: true }), participant({ uid: "u2", vote: "2", hasVoted: true })],
      stats: stats({ average: 1.67, median: 1.5, counts: { "1": 1, "2": 1 } }),
    });

    expect(screen.getByTestId("average")).toHaveTextContent("1,67");
    expect(screen.getByText("1,5")).toBeInTheDocument();
  });

  it("avisa consenso quando todos votaram igual", () => {
    renderResult({
      revealed: true,
      participants: [participant({ vote: "5", hasVoted: true })],
      stats: stats({ average: 5, median: 5, consensus: true, counts: { "5": 1 } }),
    });

    expect(screen.getByText("consenso")).toBeInTheDocument();
  });

  it("sem votos mostra texto e nunca NaN", () => {
    renderResult({ revealed: true, participants: [participant({})], stats: stats({}) });

    expect(screen.getByText("Nenhum voto nesta rodada.")).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.queryByTestId("average")).toBeNull();
  });

  it("só símbolos mostra 'sem votos numéricos' e conta a distribuição", () => {
    renderResult({
      revealed: true,
      participants: [
        participant({ vote: "?", hasVoted: true }),
        participant({ uid: "u2", vote: "☕", hasVoted: true }),
      ],
      stats: stats({ counts: { "?": 1, "☕": 1 } }),
    });

    expect(screen.getByText("Sem votos numéricos.")).toBeInTheDocument();
    expect(screen.getByLabelText("Distribuição dos votos")).toBeInTheDocument();
  });

  it("maioria '?' mostra a média com o número real de cartas que contam", () => {
    renderResult({
      revealed: true,
      participants: [
        participant({ uid: "u1", vote: "?", hasVoted: true }),
        participant({ uid: "u2", vote: "?", hasVoted: true }),
        participant({ uid: "u3", vote: "?", hasVoted: true }),
        participant({ uid: "u4", vote: "5", hasVoted: true }),
      ],
      stats: stats({ average: 5, median: 5, counts: { "?": 3, "5": 1 } }),
    });

    expect(screen.getByText("1 de 4 cartas contam na média")).toBeInTheDocument();
    expect(screen.getByText("? e ☕ ficam fora da média e da mediana.")).toBeInTheDocument();
    expect(screen.queryByText("consenso")).toBeNull();
  });

  it("todos votaram '?' não inventa consenso numérico", () => {
    renderResult({
      revealed: true,
      participants: [
        participant({ uid: "u1", vote: "?", hasVoted: true }),
        participant({ uid: "u2", vote: "?", hasVoted: true }),
      ],
      stats: stats({ consensus: true, counts: { "?": 2 } }),
    });

    expect(screen.getByText("Sem votos numéricos.")).toBeInTheDocument();
    expect(screen.queryByText("consenso")).toBeNull();
    expect(screen.queryByTestId("average")).toBeNull();
  });

  it("enquanto os votos chegam, não anuncia 'nenhum voto'", () => {
    renderResult({ revealed: true, stats: null });

    expect(screen.getByText("Somando os votos da rodada.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum voto nesta rodada.")).toBeNull();
  });

  it("antes do reveal mostra progresso e quem falta", () => {
    renderResult({
      participants: [participant({ name: "Ana", hasVoted: true }), participant({ uid: "u2", name: "Bruno" })],
    });

    expect(screen.getByText("1 aguardando")).toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(screen.queryByTestId("average")).toBeNull();
  });
});

describe("controles do host", () => {
  it("não aparece para quem não é host", () => {
    render(
      <HostControls
        isHost={false}
        revealed={false}
        autoReveal={false}
        hostName="Ana"
        onReveal={vi.fn()}
        onNewRound={vi.fn()}
        onToggleAutoReveal={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Revelar cartas" })).toBeNull();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("revela e inicia nova rodada", async () => {
    const onReveal = vi.fn();
    const onNewRound = vi.fn();
    const { rerender } = render(
      <HostControls
        isHost
        revealed={false}
        autoReveal={false}
        hostName="Ana"
        onReveal={onReveal}
        onNewRound={onNewRound}
        onToggleAutoReveal={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Revelar cartas" }));
    expect(onReveal).toHaveBeenCalledTimes(1);

    rerender(
      <HostControls
        isHost
        revealed
        autoReveal={false}
        hostName="Ana"
        onReveal={onReveal}
        onNewRound={onNewRound}
        onToggleAutoReveal={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Nova rodada" }));
    expect(onNewRound).toHaveBeenCalledTimes(1);
  });

  it("esconde o switch de auto-reveal depois do reveal", () => {
    render(
      <HostControls
        isHost
        revealed
        autoReveal={false}
        hostName="Ana"
        onReveal={vi.fn()}
        onNewRound={vi.fn()}
        onToggleAutoReveal={vi.fn()}
      />,
    );

    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByRole("button", { name: "Nova rodada" })).toBeInTheDocument();
  });

  it("alterna o auto-reveal pelo switch", async () => {
    const onToggleAutoReveal = vi.fn();
    render(
      <HostControls
        isHost
        revealed={false}
        autoReveal={false}
        hostName="Ana"
        onReveal={vi.fn()}
        onNewRound={vi.fn()}
        onToggleAutoReveal={onToggleAutoReveal}
      />,
    );

    await userEvent.click(screen.getByRole("switch", { name: "Revelar quando todos votarem" }));
    expect(onToggleAutoReveal).toHaveBeenCalledWith(true);
  });
});

describe("histórico de rodadas", () => {
  it("lista as médias com a rodada, da mais recente para a mais antiga", () => {
    render(
      <RoundHistory
        history={[
          { round: 11, average: 3 },
          { round: 12, average: 5.5 },
        ]}
      />,
    );

    const strip = screen.getByLabelText("médias das rodadas anteriores");
    expect(within(strip).getByText("5,5")).toBeInTheDocument();
    expect(within(strip).getByText("3")).toBeInTheDocument();

    const items = within(strip).getAllByRole("listitem");
    // Formato: "R12" + "5,5" + sr-only "Rodada 12: 5,5"
    expect(items[0]).toHaveTextContent("R12");
    expect(items[0]).toHaveTextContent("5,5");
    expect(items[1]).toHaveTextContent("R11");
    expect(items[1]).toHaveTextContent("3");
    expect(within(strip).getByText("2 rodadas")).toBeInTheDocument();
  });

  it("sem rodada anterior mostra estado vazio, não um traço solto", () => {
    render(<RoundHistory history={[]} />);
    const strip = screen.getByLabelText("médias das rodadas anteriores");
    expect(within(strip).getByText(/depois do primeiro reveal/i)).toBeInTheDocument();
    expect(strip).not.toHaveTextContent("—");
  });
});

describe("fluxo da sala", () => {
  it("vota, revela e trava o deck", async () => {
    render(
      <MemoryRouter>
        <MockRoomProvider>
          <Room roomId="abc234" />
        </MockRoomProvider>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "carta 8" }));
    expect(screen.getByRole("button", { name: "carta 8" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Revelar cartas" }));

    const average = screen.getByTestId("average");
    expect(average).toHaveTextContent("8");
    for (const card of screen.getAllByRole("button", { name: /^carta / })) expect(card).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Nova rodada" }));
    expect(screen.getByRole("button", { name: "carta 8" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "carta 8" })).toHaveAttribute("aria-pressed", "false");
  });
});
