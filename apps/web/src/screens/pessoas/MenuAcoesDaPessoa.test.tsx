/**
 * T209 — posição do menu "Ações" da linha (C-4). A tabela rola dentro do
 * próprio quadro e recortaria um menu absoluto: ele é posicionado em relação
 * à janela, abaixo do botão (ou acima, quando não cabe), e acompanha a
 * rolagem de qualquer ancestral e a mudança de tamanho da janela.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuAcoesDaPessoa } from "./MenuAcoesDaPessoa";

interface Caixa {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

let caixaDoBotao: Caixa;
const ALTURA_DO_MENU = 300;

beforeEach(() => {
  caixaDoBotao = { top: 100, bottom: 144, left: 200, right: 300 };
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(375);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.getAttribute("role") === "menu") {
        return {
          top: 0,
          bottom: ALTURA_DO_MENU,
          height: ALTURA_DO_MENU,
        } as DOMRect;
      }
      if (this.getAttribute("aria-haspopup") === "menu") {
        return {
          ...caixaDoBotao,
          height: caixaDoBotao.bottom - caixaDoBotao.top,
        } as DOMRect;
      }
      return { top: 0, bottom: 0, left: 0, right: 0, height: 0 } as DOMRect;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function montar() {
  render(
    <div data-testid="quadro" style={{ overflowX: "auto" }}>
      <MenuAcoesDaPessoa
        nome="Pessoa sintética"
        atalhos={[
          { id: "dados", rotulo: "Dados do colaborador", aoEscolher: vi.fn() },
          { id: "ponto", rotulo: "Registros de ponto", aoEscolher: vi.fn() },
        ]}
      />
    </div>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Ações: Pessoa sintética" }),
  );
  return screen.getByRole("menu");
}

describe("T209 — posição do menu 'Ações' da linha", () => {
  it("abre abaixo do botão, alinhado à direita dele", () => {
    const menu = montar();
    expect(menu.style.top).toBe("148px");
    expect(menu.style.right).toBe("75px");
  });

  it("sem espaço embaixo, abre acima do botão", () => {
    caixaDoBotao = { top: 600, bottom: 644, left: 200, right: 300 };
    const menu = montar();
    expect(menu.style.top).toBe(`${600 - 4 - ALTURA_DO_MENU}px`);
  });

  it("sem espaço nem embaixo nem em cima, fica embaixo (a página rola)", () => {
    caixaDoBotao = { top: 200, bottom: 244, left: 200, right: 300 };
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(400);
    const menu = montar();
    expect(menu.style.top).toBe("248px");
  });

  it("nunca encosta na borda direita da janela", () => {
    caixaDoBotao = { top: 100, bottom: 144, left: 300, right: 375 };
    const menu = montar();
    expect(menu.style.right).toBe("8px");
  });

  it("acompanha a rolagem do quadro da tabela e a mudança de tamanho da janela", () => {
    const menu = montar();
    caixaDoBotao = { top: 100, bottom: 144, left: 140, right: 240 };
    act(() => {
      fireEvent.scroll(screen.getByTestId("quadro"));
    });
    expect(menu.style.right).toBe("135px");

    caixaDoBotao = { top: 50, bottom: 94, left: 140, right: 240 };
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(menu.style.top).toBe("98px");
  });

  it("fechado, para de ouvir rolagem e tamanho", () => {
    const remover = vi.spyOn(window, "removeEventListener");
    const menu = montar();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(remover).toHaveBeenCalledWith("scroll", expect.any(Function), true);
    expect(remover).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
