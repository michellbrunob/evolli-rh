import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DESTINOS_PAINEL, PainelNavigation } from "./PainelNavigation";

describe("PainelNavigation (T044)", () => {
  it("lista os dez destinos dentro de um <nav> rotulado", () => {
    // Dez desde a T153: os nove incondicionais mais "Minha equipe", que é
    // CONDICIONAL. Sem `destinosCondicionais`, nada é ocultado — a omissão
    // significa "incondicional", e quem monta o shell é que decide.
    render(
      <PainelNavigation destinoAtivoId="cadastros" onSelecionar={() => {}} />,
    );

    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    const itens = nav.querySelectorAll("li");
    expect(itens).toHaveLength(DESTINOS_PAINEL.length);
    expect(DESTINOS_PAINEL).toHaveLength(10);
  });

  it("T153 oculta um destino condicional que o servidor não concedeu", () => {
    render(
      <PainelNavigation
        destinoAtivoId="cadastros"
        onSelecionar={() => {}}
        destinosCondicionais={{ equipe: false }}
      />,
    );

    // Nem botão, nem item de lista, nem posição na ordem de tabulação.
    expect(screen.queryByRole("button", { name: /Minha equipe/ })).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Navegação do painel" });
    expect(nav.querySelectorAll("li")).toHaveLength(DESTINOS_PAINEL.length - 1);
    // Os demais continuam todos lá: ocultar um condicional não mexe no resto.
    expect(
      screen.getByRole("button", { name: /^Pessoas/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Relatórios/ }),
    ).toBeInTheDocument();
  });

  it("T153 mostra o destino condicional quando o servidor concedeu", () => {
    render(
      <PainelNavigation
        destinoAtivoId="cadastros"
        onSelecionar={() => {}}
        destinosCondicionais={{ equipe: true }}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Minha equipe/ }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("navigation", { name: "Navegação do painel" })
        .querySelectorAll("li"),
    ).toHaveLength(DESTINOS_PAINEL.length);
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

  it("apresenta 'Pessoas' com o sub-rótulo 'Colaboradores' (T072)", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );

    const botao = screen.getByRole("button", {
      name: /Pessoas.*Colaboradores/,
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

  it("apresenta 'Portal do Colaborador' com o sub-rótulo 'Visão geral — demonstração' (T067)", () => {
    render(
      <PainelNavigation
        destinoAtivoId="portal-colaborador"
        onSelecionar={() => {}}
      />,
    );

    const botao = screen.getByRole("button", {
      name: /Portal do Colaborador.*Visão geral — demonstração/,
    });
    expect(botao).toBeInTheDocument();
    expect(botao).toHaveAttribute("aria-current", "page");
  });

  it("apresenta 'Solicitações' com o sub-rótulo 'Central do RH' (T068)", () => {
    render(
      <PainelNavigation
        destinoAtivoId="solicitacoes-rh"
        onSelecionar={() => {}}
      />,
    );

    const botao = screen.getByRole("button", {
      name: /Solicitações.*Central do RH/,
    });
    expect(botao).toBeInTheDocument();
    expect(botao).toHaveAttribute("aria-current", "page");
  });

  it("apresenta 'Relatórios' com o sub-rótulo 'Exceções de Ponto' (T075)", () => {
    render(
      <PainelNavigation destinoAtivoId="relatorios" onSelecionar={() => {}} />,
    );

    const botao = screen.getByRole("button", {
      name: /Relatórios.*Exceções de Ponto/,
    });
    expect(botao).toBeInTheDocument();
    expect(botao).toHaveAttribute("aria-current", "page");
  });

  it("apresenta 'Contas de acesso' (T121), sem sub-rótulo", () => {
    render(
      <PainelNavigation
        destinoAtivoId="contas-acesso"
        onSelecionar={() => {}}
      />,
    );

    const botao = screen.getByRole("button", { name: "Contas de acesso" });
    expect(botao).toBeInTheDocument();
    expect(botao).toHaveAttribute("aria-current", "page");
  });
});
