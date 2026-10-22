import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Button } from "./Button";
import { Input } from "./Input";
import { Card } from "./Card";
import { Avatar, initialOf } from "./Avatar";
import { Badge } from "./Badge";
import { Dot } from "./Dot";
import { Panel } from "./Panel";
import { Spinner } from "./Spinner";

afterEach(cleanup);

describe("Button", () => {
  it("desabilita e mostra status enquanto carrega", () => {
    render(<Button loading>Criar sala</Button>);

    expect(screen.getByRole("button", { name: /criar sala/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /criar sala/i })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("dispara a ação quando está livre", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Revelar</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Revelar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Input", () => {
  it("associa label, dica e erro pelos ids", () => {
    render(<Input label="Seu nome" hint="Fica salvo neste navegador." error="Informe seu nome." />);

    const input = screen.getByLabelText("Seu nome");
    const error = screen.getByRole("alert");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", expect.stringContaining(error.id));
    expect(error).toHaveTextContent("Informe seu nome.");
  });

  it("usa o hint quando não há erro", () => {
    render(<Input label="Código" hint="Seis caracteres." />);

    expect(screen.getByLabelText("Código")).toHaveAttribute("aria-describedby");
    expect(screen.getByText("Seis caracteres.")).toBeInTheDocument();
  });
});

describe("Card", () => {
  it("expõe aria-pressed quando selecionado", () => {
    render(<Card value="8" selected />);
    expect(screen.getByRole("button", { name: "carta 8" })).toHaveAttribute("aria-pressed", "true");
  });

  it("chama onSelect com o valor da carta", async () => {
    const onSelect = vi.fn();
    render(<Card value="13" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "carta 13" }));
    expect(onSelect).toHaveBeenCalledWith("13");
  });

  it("não aceita clique depois do reveal", async () => {
    const onSelect = vi.fn();
    render(<Card value="5" disabled onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: "carta 5" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "carta 5" }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("dá nome falado para os símbolos", () => {
    render(
      <>
        <Card value="?" />
        <Card value="☕" />
      </>,
    );

    expect(screen.getByRole("button", { name: "carta interrogação" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "carta café" })).toBeInTheDocument();
  });
});

describe("Avatar", () => {
  it("mostra a inicial em maiúscula e expõe a cor vinda do uid", () => {
    render(<Avatar name="ana" color="#D9A05B" />);

    const avatar = screen.getByText("A");
    expect(avatar).toHaveAttribute("data-color", "#D9A05B");
    expect(avatar.style.getPropertyValue("--avatar-color")).toBe("#D9A05B");
  });

  it("não quebra com nome que parece marcação", () => {
    expect(initialOf("<b>ana</b>")).toBe("B");
    expect(initialOf("  ")).toBe("?");
  });
});

describe("Badge, Dot, Panel e Spinner", () => {
  it("Badge mostra o texto com o tom pedido", () => {
    render(<Badge tone="ok">consenso</Badge>);
    expect(screen.getByText("consenso")).toBeInTheDocument();
  });

  it("Dot anuncia offline com aria-label", () => {
    render(<Dot state="offline" />);
    expect(screen.getByRole("img", { name: "offline" })).toBeInTheDocument();
  });

  it("Panel renderiza o título como heading", () => {
    render(
      <Panel title="Participantes">
        <p>Ana</p>
      </Panel>,
    );

    expect(screen.getByRole("heading", { name: "Participantes" })).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("Panel mantém o footer fora do corpo rolável", () => {
    render(
      <Panel title="Resultado" footer={<span>médias</span>}>
        <p>3,2</p>
      </Panel>,
    );

    const footer = screen.getByText("médias");
    expect(footer.closest("div")).toHaveClass("border-t");
    expect(screen.getByText("3,2").parentElement).not.toContainElement(footer);
  });

  it("Spinner tem role status", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
