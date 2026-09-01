import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DESTINOS_PAINEL, PainelNavigation } from "./PainelNavigation";

describe("PainelNavigation (T044)", () => {
  it("lista os cinco destinos dentro de um <nav> rotulado", () => {
    render(
      <PainelNavigation destinoAtivoId="cadastros" onSelecionar={() => {}} />,
    );

    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    const itens = nav.querySelectorAll("li");
    expect(itens).toHaveLength(DESTINOS_PAINEL.length);
    expect(DESTINOS_PAINEL).toHaveLength(5);
  });

  it("marca somente o destino ativo com aria-current='page'", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );

    expect(screen.getByRole("button", { name: /^Pessoas/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /^Início/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("chama onSelecionar com o id do destino clicado", () => {
    const onSelecionar = vi.fn();
    render(
      <PainelNavigation
        destinoAtivoId="cadastros"
        onSelecionar={onSelecionar}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Ponto/ }));
    expect(onSelecionar).toHaveBeenCalledWith("ponto");
  });

  it("apresenta 'Cadastros' com o sub-rótulo 'Horários' quando ativo", () => {
    render(
      <PainelNavigation destinoAtivoId="cadastros" onSelecionar={() => {}} />,
    );

    const botao = screen.getByRole("button", { name: /Cadastros.*Horários/ });
    expect(botao).toBeInTheDocument();
  });

  it("apresenta 'Ponto' com o sub-rótulo 'Visão do período' (T063)", () => {
    render(<PainelNavigation destinoAtivoId="ponto" onSelecionar={() => {}} />);

    const botao = screen.getByRole("button", {
      name: /Ponto.*Visão do período/,
    });
    expect(botao).toBeInTheDocument();
    expect(botao).toHaveAttribute("aria-current", "page");
  });

  it("apresenta 'Pessoas' com o sub-rótulo 'Horário de trabalho'", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );

    const botao = screen.getByRole("button", {
      name: /Pessoas.*Horário de trabalho/,
    });
    expect(botao).toBeInTheDocument();
    expect(botao).toHaveAttribute("aria-current", "page");
  });

  it("apresenta 'Documentos' com o sub-rótulo 'Metadados'", () => {
    render(
      <PainelNavigation destinoAtivoId="documentos" onSelecionar={() => {}} />,
    );

    const botao = screen.getByRole("button", {
      name: /Documentos.*Metadados/,
    });
    expect(botao).toBeInTheDocument();
    expect(botao).toHaveAttribute("aria-current", "page");
  });

  it("apresenta 'Início' com o sub-rótulo 'Visão geral'", () => {
    render(
      <PainelNavigation destinoAtivoId="inicio" onSelecionar={() => {}} />,
    );

    const botao = screen.getByRole("button", {
      name: /Início.*Visão geral/,
    });
    expect(botao).toBeInTheDocument();
    expect(botao).toHaveAttribute("aria-current", "page");
  });
});
