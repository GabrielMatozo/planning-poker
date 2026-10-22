import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, afterEach } from "vitest";
import type { Participant } from "../../types/room";
import { ParticipantsSidebar } from "./ParticipantsSidebar";
import { ConnectionBanner } from "./ConnectionBanner";

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

function renderSidebar(overrides?: Partial<ComponentProps<typeof ParticipantsSidebar>>) {
  return render(
    <ParticipantsSidebar
      participants={[participant({})]}
      revealed={false}
      meUid="u1"
      hostId="u1"
      now={NOW}
      {...overrides}
    />,
  );
}

describe("lista de participantes", () => {
  it("mostra 'votou' sem revelar o valor antes do reveal", () => {
    renderSidebar({
      participants: [participant({ name: "Ana", vote: "5", hasVoted: true })],
      revealed: false,
    });

    const row = screen.getByTestId("participant-u1");
    expect(within(row).getByText("votou")).toBeInTheDocument();
    expect(within(row).queryByText("5")).toBeNull();
  });

  it("mostra 'aguardando' para quem ainda não votou", () => {
    renderSidebar({ participants: [participant({ name: "Ana" })] });
    expect(within(screen.getByTestId("participant-u1")).getByText("aguardando")).toBeInTheDocument();
  });

  it("ordena por valor depois do reveal", () => {
    renderSidebar({
      revealed: true,
      participants: [
        participant({ uid: "u13", name: "Carla", vote: "13", hasVoted: true }),
        participant({ uid: "u1", name: "Ana", vote: "1", hasVoted: true }),
        participant({ uid: "u5", name: "Bruno", vote: "5", hasVoted: true }),
      ],
    });

    const rows = screen.getAllByTestId(/^participant-/);
    expect(within(rows[0] as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("5")).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText("13")).toBeInTheDocument();
  });

  it("renderiza nome com HTML como texto puro", () => {
    renderSidebar({ participants: [participant({ name: "<b>x</b>" })] });

    const row = screen.getByTestId("participant-u1");
    expect(row.textContent).toContain("<b>x</b>");
    expect(row.querySelector("b")).toBeNull();
  });

  it("marca offline com aria-label no dot e nome em tom secundário", () => {
    renderSidebar({
      participants: [participant({ name: "Bruno", uid: "u2", lastSeen: NOW - 120_000, online: false })],
      meUid: "u1",
    });

    expect(screen.getByRole("img", { name: "Bruno: offline" })).toBeInTheDocument();
    expect(screen.getByTitle("Bruno")).toHaveClass("text-muted");
  });

  it("trunca nome de 40 caracteres sem quebrar a linha", () => {
    const longName = "Nome muito comprido que bate no limite de q";
    renderSidebar({ participants: [participant({ name: longName })] });

    const label = screen.getByTitle(longName);
    expect(label).toHaveClass("truncate");
  });

  it("marca você e host sem esconder nenhum dos dois no mobile", () => {
    renderSidebar();

    const me = screen.getByText("você");
    const host = screen.getByText("host");
    expect(me).toBeVisible();
    expect(host).toBeVisible();
    expect(me).not.toHaveClass("hidden");
    expect(host).not.toHaveClass("hidden");
  });

  it("numera nomes iguais para não confundir quem é quem", () => {
    renderSidebar({
      participants: [
        participant({ uid: "u1", name: "Ana", joinedAt: 1 }),
        participant({ uid: "u2", name: "Ana", joinedAt: 2 }),
        participant({ uid: "u3", name: "Bruno", joinedAt: 3 }),
      ],
      hostId: "u1",
    });

    expect(within(screen.getByTestId("participant-u1")).getByText("#1")).toBeInTheDocument();
    expect(within(screen.getByTestId("participant-u2")).getByText("#2")).toBeInTheDocument();
    expect(within(screen.getByTestId("participant-u3")).queryByText(/^#/)).toBeNull();
  });

  it("limpa invisíveis que vieram do servidor", () => {
    renderSidebar({ participants: [participant({ name: "\u200BAna\u0000" })] });

    const row = screen.getByTestId("participant-u1");
    expect(row.textContent).toContain("Ana");
    expect(row.textContent).not.toContain("\u200B");
    expect(row.textContent).not.toContain("\u0000");
  });

  it("isola nome em RTL", () => {
    const rtl = "مرحبا بالعالم";
    renderSidebar({ participants: [participant({ name: rtl })] });

    expect(screen.getByTitle(rtl)).toHaveAttribute("dir", "auto");
    expect(screen.getByText(rtl)).toBeInTheDocument();
  });
});

describe("banner de conexão", () => {
  it("aparece conectando e some quando pronto", () => {
    const { rerender } = render(<ConnectionBanner status="connecting" />);
    expect(screen.getByText("Conectando à sala")).toBeInTheDocument();

    rerender(<ConnectionBanner status="ready" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("anuncia offline e transferência de host", () => {
    const { rerender } = render(<ConnectionBanner status="offline" />);
    expect(screen.getByRole("status")).toHaveTextContent("Sem conexão");

    rerender(<ConnectionBanner status="ready" notice="Você assumiu a sala: o host anterior saiu." />);
    expect(screen.getByRole("status")).toHaveTextContent("Você assumiu a sala");
  });
});
