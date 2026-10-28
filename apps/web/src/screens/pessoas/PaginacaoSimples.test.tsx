import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaginacaoSimples } from "./PaginacaoSimples";

/**
 * T192 — o modo `focoEstavel` (Horário de trabalho) troca `disabled` por
 * `aria-disabled`, para o foco ficar no botão acionado; sem ele, o
 * componente segue como na T188 (seletor de colaborador, Histórico
 * funcional).
 */
describe("PaginacaoSimples", () => {
  it("padrão (T188): pontas e carga com `disabled` nativo e posição como região viva", () => {
    render(
      <PaginacaoSimples
        rotulo="Páginas de teste"
        pagina={1}
        totalPaginas={3}
        carregando={false}
        onIrPara={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeEnabled();
    expect(screen.getByText("Página 1 de 3")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("padrão (T188): durante a carga os dois botões ficam `disabled`", () => {
    render(
      <PaginacaoSimples
        rotulo="Páginas de teste"
        pagina={2}
        totalPaginas={3}
        carregando
        onIrPara={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("foco estável: indisponível por `aria-disabled`, focável, e o clique não pede página", () => {
    const onIrPara = vi.fn();
    render(
      <PaginacaoSimples
        rotulo="Páginas de teste"
        pagina={3}
        totalPaginas={3}
        focoEstavel
        onIrPara={onIrPara}
      />,
    );
    const proxima = screen.getByRole("button", { name: "Próxima" });
    expect(proxima).not.toBeDisabled();
    expect(proxima).toHaveAttribute("aria-disabled", "true");
    proxima.focus();
    expect(document.activeElement).toBe(proxima);
    fireEvent.click(proxima);
    expect(onIrPara).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(onIrPara).toHaveBeenCalledWith(2);
    expect(screen.getByText("Página 3 de 3")).not.toHaveAttribute("aria-live");
  });

  it("foco estável: durante a carga, nenhum botão pede página", () => {
    const onIrPara = vi.fn();
    render(
      <PaginacaoSimples
        rotulo="Páginas de teste"
        pagina={2}
        totalPaginas={3}
        carregando
        focoEstavel
        onIrPara={onIrPara}
      />,
    );
    for (const nome of ["Anterior", "Próxima"]) {
      const botao = screen.getByRole("button", { name: nome });
      expect(botao).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(botao);
    }
    expect(onIrPara).not.toHaveBeenCalled();
  });
});
