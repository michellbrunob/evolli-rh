/**
 * T209 — o menu "Ações" da linha sobre o `DropdownMenu` da camada `src/ui`
 * (Radix). Os contratos de teclado e foco do menu ficam em `src/ui`; aqui, o
 * que é próprio da linha: o nome, os atalhos na ordem, o portal fora do
 * quadro que rola e o foco no botão quando o atalho executa.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MenuAcoesDaPessoa } from "./MenuAcoesDaPessoa";

function montar(aoEscolher = vi.fn()) {
  render(
    <div data-testid="quadro" style={{ overflowX: "auto" }}>
      <MenuAcoesDaPessoa
        nome="Pessoa sintética"
        atalhos={[
          { id: "dados", rotulo: "Dados do colaborador", aoEscolher },
          { id: "ponto", rotulo: "Registros de ponto", aoEscolher },
        ]}
      />
    </div>,
  );
  return screen.getByRole("button", { name: "Ações: Pessoa sintética" });
}

describe("T209 — menu 'Ações' da linha (Radix)", () => {
  it("botão de menu nomeado pela pessoa, com o ícone decorativo", () => {
    const botao = montar();
    expect(botao).toHaveAttribute("aria-haspopup", "menu");
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(botao).toHaveClass("colaboradores-screen__botao-acoes");
  });

  it("abre num portal, fora do quadro que rola, com os atalhos na ordem", async () => {
    const botao = montar();
    fireEvent.keyDown(botao, { key: "Enter" });
    const menu = await screen.findByRole("menu", {
      name: "Ações: Pessoa sintética",
    });
    expect(screen.getByTestId("quadro").contains(menu)).toBe(false);
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Dados do colaborador", "Registros de ponto"]);
    expect(botao).toHaveAttribute("aria-expanded", "true");
  });

  it("o atalho executa com o foco já de volta no botão", async () => {
    let focoNaAcao: Element | null = null;
    const botao = montar(
      vi.fn(() => {
        focoNaAcao = document.activeElement;
      }),
    );
    fireEvent.keyDown(botao, { key: "Enter" });
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Registros de ponto" }),
    );
    expect(focoNaAcao).toBe(botao);
  });
});
