import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

/**
 * Cobertura do comportamento de janela (UI-F04, T142). A aparência é julgada
 * no navegador; aqui ficam as garantias que dá para provar: nome acessível,
 * foco inicial, foco preso, devolução do foco, Escape, fundo sem rolagem,
 * bloqueio durante envio e confirmação de descarte.
 */
function Palco({
  alterado = false,
  bloqueado = false,
}: {
  alterado?: boolean;
  bloqueado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <Button
        onClick={(e) => {
          e.currentTarget.focus();
          setAberto(true);
        }}
      >
        Abrir
      </Button>
      <Modal
        aberto={aberto}
        titulo="Nova admissão"
        descricao="Texto de apoio."
        onFechar={() => setAberto(false)}
        alterado={alterado}
        bloqueado={bloqueado}
        rodape={<Button type="button">Salvar</Button>}
      >
        <input aria-label="Campo A" />
        <input aria-label="Campo B" />
      </Modal>
    </div>
  );
}

describe("Modal (UI-F04)", () => {
  it("não renderiza nada enquanto está fechado", () => {
    render(<Palco />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("é um diálogo modal nomeado e descrito pelo próprio conteúdo", () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));

    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAccessibleName("Nova admissão");
    expect(dialogo).toHaveAccessibleDescription("Texto de apoio.");
  });

  it("leva o foco para o título ao abrir e o devolve ao acionador ao fechar", async () => {
    render(<Palco />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    fireEvent.click(abrir);

    const titulo = screen.getByRole("heading", { name: "Nova admissão" });
    await waitFor(() => expect(document.activeElement).toBe(titulo));

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(document.activeElement).toBe(abrir));
  });

  it("Escape fecha quando não há nada a perder", async () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("com alterações não salvas, fechar pede confirmação antes de descartar", async () => {
    render(<Palco alterado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    // Não fechou: apareceu a confirmação, dentro da própria janela.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/alterações não salvas/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.queryByText(/alterações não salvas/i)).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar alterações" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("durante o envio, não fecha por Escape nem pelo botão", async () => {
    render(<Palco bloqueado />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeDisabled();
  });

  it("prende o foco: Tab no último volta ao primeiro", async () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    const fechar = screen.getByRole("button", { name: "Fechar" });
    const salvar = screen.getByRole("button", { name: "Salvar" });

    salvar.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    await waitFor(() => expect(document.activeElement).toBe(fechar));

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    await waitFor(() => expect(document.activeElement).toBe(salvar));
  });

  it("trava a rolagem do fundo enquanto está aberto e devolve ao fechar", async () => {
    render(<Palco />);
    const antes = document.body.style.overflow;
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(document.body.style.overflow).toBe(antes));
  });

  it("clicar no fundo não fecha: descartar é sempre explícito", async () => {
    const { container } = render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");

    const fundo = container.querySelector(".evolli-modal__fundo")!;
    fireEvent.click(fundo);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("não empilha: uma janela por vez", async () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("o onFechar só é chamado uma vez por fechamento", async () => {
    const aoFechar = vi.fn();
    render(
      <Modal aberto titulo="Janela" onFechar={aoFechar}>
        <p>conteúdo</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
