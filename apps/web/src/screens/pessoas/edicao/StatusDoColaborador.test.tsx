/**
 * T215 — o Status do cabeçalho de "Editar colaborador": botão com a bolinha
 * da cor do status, o nome e a seta; a lista com as cinco opções, cada uma
 * com a sua bolinha, o visto na atual e "Desligado" em vermelho.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusDoColaborador } from "./StatusDoColaborador";

function abrir() {
  const botao = screen.getByRole("button", { name: /^Status:/ });
  fireEvent.keyDown(botao, { key: "Enter" });
  return screen.findByRole("menu");
}

describe("T215 — Status do colaborador", () => {
  it("o botão diz o status atual, com a bolinha da cor dele", () => {
    render(<StatusDoColaborador valor="ativo" onEscolher={vi.fn()} />);
    const botao = screen.getByRole("button", { name: "Status: Ativo" });
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(
      botao.querySelector(".status-colaborador__ponto--ativo"),
    ).not.toBeNull();
  });

  it("a lista: cinco opções na ordem, bolinhas, visto só na atual, Desligado em vermelho", async () => {
    render(<StatusDoColaborador valor="ativo" onEscolher={vi.fn()} />);
    const menu = await abrir();
    const opcoes = within(menu).getAllByRole("menuitemradio");
    expect(opcoes.map((o) => o.textContent)).toEqual([
      "Ativo",
      "Férias",
      "Afastado",
      "Inativo",
      "Desligado",
    ]);
    expect(opcoes.map((o) => o.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
      "false",
      "false",
    ]);
    for (const [i, s] of [
      "ativo",
      "ferias",
      "afastado",
      "inativo",
      "desligado",
    ].entries()) {
      expect(
        opcoes[i]!.querySelector(`.status-colaborador__ponto--${s}`),
      ).not.toBeNull();
    }
    expect(
      opcoes[0]!.querySelector(".status-colaborador__visto"),
    ).not.toBeNull();
    expect(opcoes[4]).toHaveClass("status-colaborador__opcao--perigo");
  });

  it("escolher outra opção avisa quem usa; a mesma não", async () => {
    const onEscolher = vi.fn();
    render(<StatusDoColaborador valor="ativo" onEscolher={onEscolher} />);
    let menu = await abrir();
    fireEvent.click(
      within(menu).getByRole("menuitemradio", { name: "Inativo" }),
    );
    expect(onEscolher).toHaveBeenCalledWith("inativo");
    menu = await abrir();
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Ativo" }));
    expect(onEscolher).toHaveBeenCalledTimes(1);
  });

  it("desabilitado: o botão não abre", () => {
    render(
      <StatusDoColaborador valor="ativo" onEscolher={vi.fn()} desabilitado />,
    );
    expect(
      screen.getByRole("button", { name: "Status: Ativo" }),
    ).toBeDisabled();
  });
});
