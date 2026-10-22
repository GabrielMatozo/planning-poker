import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { Home } from "../../routes/Home";

afterEach(cleanup);

function setup() {
  const onCreate = vi.fn();
  const onJoin = vi.fn();
  render(<Home onCreate={onCreate} onJoin={onJoin} />);
  return { onCreate, onJoin };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("tela inicial", () => {
  it("valida nome vazio sem abrir diálogo do navegador", async () => {
    const { onCreate } = setup();

    await userEvent.type(screen.getByLabelText("Nome da sala"), "Sprint 42");
    await userEvent.click(screen.getByRole("button", { name: "Criar sala" }));

    expect(await screen.findByText("Informe seu nome para continuar.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("faz trim e corta nome e sala em 40 antes de enviar", async () => {
    const { onCreate } = setup();

    await userEvent.type(screen.getByLabelText("Seu nome"), "  Ana  ");
    await userEvent.type(screen.getByLabelText("Nome da sala"), `${"P".repeat(50)}`);
    await userEvent.click(screen.getByRole("button", { name: "Criar sala" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const [roomName, userName] = onCreate.mock.calls[0] as [string, string];
    expect(userName).toBe("Ana");
    expect(roomName).toHaveLength(40);
  });

  it("rejeita código com menos de seis caracteres", async () => {
    const { onJoin } = setup();

    await userEvent.type(screen.getByLabelText("Seu nome"), "Ana");
    await userEvent.type(screen.getByLabelText("Código da sala"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Entrar na sala" }));

    expect(await screen.findByText("O código tem 6 caracteres.")).toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("normaliza o código para minúsculas e descarta caracteres fora do alfabeto", async () => {
    const { onJoin } = setup();

    await userEvent.type(screen.getByLabelText("Seu nome"), "Ana");
    const code = screen.getByLabelText("Código da sala");
    await userEvent.type(code, "ABC0D1EF");

    expect(code).toHaveValue("abcdef");

    await userEvent.click(screen.getByRole("button", { name: "Entrar na sala" }));
    expect(onJoin).toHaveBeenCalledWith("abcdef", "Ana");
  });

  it("pré-preenche o nome salvo no navegador", () => {
    window.localStorage.setItem("pp:name", "Bruno");
    setup();

    expect(screen.getByLabelText("Seu nome")).toHaveValue("Bruno");
  });

  it("limpa o nome salvo antes de mostrar", () => {
    window.localStorage.setItem("pp:name", `\u200B Ana\u0000 ${"P".repeat(60)}`);
    setup();

    const input = screen.getByLabelText("Seu nome") as HTMLInputElement;
    expect(input.value.startsWith("Ana ")).toBe(true);
    expect(input.value).not.toContain("\u200B");
    expect(input.value.length).toBe(40);
  });

  it("descarta controle e zero-width colados no nome", () => {
    setup();
    const input = screen.getByLabelText("Seu nome");

    fireEvent.change(input, { target: { value: "A\u200Bn\u0000a\u202E" } });

    expect(input).toHaveValue("Ana");
  });

  it("mantém nome em RTL e acentos", () => {
    setup();
    const input = screen.getByLabelText("Seu nome");
    const rtl = "مرحبا João";

    fireEvent.change(input, { target: { value: rtl } });

    expect(input).toHaveValue(rtl);
  });

  it("corta emoji no limite sem deixar metade de um par", () => {
    setup();
    const input = screen.getByLabelText("Seu nome") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "😀".repeat(25) } });

    expect(input.value).toHaveLength(40);
    expect(/[\uD800-\uDBFF]$/.test(input.value)).toBe(false);
    expect(Array.from(input.value)).toHaveLength(20);
  });

  it("limpa o nome da sala também", () => {
    setup();
    const room = screen.getByLabelText("Nome da sala");

    fireEvent.change(room, { target: { value: " Sprint\u200B 42\u0000 " } });

    expect(room).toHaveValue("Sprint 42 ");
  });

  it("salva o nome no navegador ao entrar", async () => {
    setup();

    await userEvent.type(screen.getByLabelText("Seu nome"), "Carla");
    await userEvent.type(screen.getByLabelText("Código da sala"), "abc234");
    await userEvent.click(screen.getByRole("button", { name: "Entrar na sala" }));

    expect(window.localStorage.getItem("pp:name")).toBe("Carla");
  });

  it("mostra erro de servidor sem recarregar a tela", () => {
    render(<Home onCreate={vi.fn()} onJoin={vi.fn()} joinError="Essa sala não existe." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Essa sala não existe.");
  });
});
