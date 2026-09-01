import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App — shell administrativo + navegação visual (T044)", () => {
  it("usa marcos semânticos e um único banner (a barra do shell)", () => {
    render(<App />);

    // Exatamente um banner: a barra superior do shell. A tela de domínio não
    // introduz landmark próprio, então não há segundo banner competindo.
    const banner = screen.getByRole("banner");
    expect(banner).toHaveClass("app-shell__topbar");

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("exibe a marca textual 'Evolli RH' e o rótulo do painel", () => {
    render(<App />);

    expect(screen.getAllByText("Evolli RH").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Painel Administrativo")).toBeInTheDocument();
  });

  it("tem exatamente um título de nível 1: o da tela Horários", () => {
    render(<App />);

    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent("Horários");
  });

  it("oferece um link 'pular para o conteúdo' que aponta para o <main>", () => {
    render(<App />);

    const skip = screen.getByRole("link", { name: /pular para o conteúdo/i });
    expect(skip.getAttribute("href")).toBe("#conteudo-principal");

    const alvo = document.getElementById("conteudo-principal");
    expect(alvo).not.toBeNull();
    expect(alvo).toBe(screen.getByRole("main"));
  });

  it("o <main> é rotulado pelo título da tela (aria-labelledby)", () => {
    render(<App />);

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(rotuloId).toBeTruthy();
    const rotulo = document.getElementById(rotuloId!);
    expect(rotulo?.tagName).toBe("H1");
    expect(rotulo).toHaveTextContent("Horários");
  });

  it("renderiza a tela Cadastros > Horários dentro do <main>", () => {
    render(<App />);

    const main = screen.getByRole("main");
    expect(
      screen.getByRole("table", { name: "Tabelas de horário cadastradas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(main).toContainElement(screen.getByText("Somente RH"));
  });

  it("não referencia autenticação, sessão real ou dado sensível no shell", () => {
    render(<App />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "login",
      "senha",
      "sessão",
      "mfa",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("apresenta a navegação com os seis destinos, Cadastros ativo por padrão", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    expect(nav).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Início.*Visão geral/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Pessoas.*Horário de trabalho/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ponto.*Visão do período/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Documentos.*Metadados/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Portal do Colaborador.*Visão geral — demonstração/,
      }),
    ).toBeInTheDocument();

    const cadastros = screen.getByRole("button", { name: /Cadastros/ });
    expect(cadastros).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: /Início.*Visão geral/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("troca o conteúdo do <main> ao selecionar outro destino, com h1 único", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Início.*Visão geral/ }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Tabelas de horário cadastradas" }),
    ).not.toBeInTheDocument();

    const inicioBtn = screen.getByRole("button", {
      name: /Início.*Visão geral/,
    });
    expect(inicioBtn).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: /^Cadastros/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("nenhum destino mostra mais 'Módulo em preparação' — todos têm tela própria (T048)", () => {
    render(<App />);

    for (const rotulo of [
      /^Início.*Visão geral/,
      /^Cadastros/,
      /^Pessoas.*Horário de trabalho/,
      /^Ponto.*Visão do período/,
      /^Documentos.*Metadados/,
      /^Portal do Colaborador.*Visão geral — demonstração/,
    ]) {
      fireEvent.click(screen.getByRole("button", { name: rotulo }));
      expect(
        screen.queryByText("Módulo em preparação"),
      ).not.toBeInTheDocument();
    }
  });

  it("renderiza a tela Início > Visão geral com h1 único e atalhos que trocam o destino local", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Início.*Visão geral/ }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent("Visão geral");

    // O atalho do card "Documentos" troca o destino local — sem rota real.
    fireEvent.click(screen.getByRole("button", { name: "Ir para Documentos" }));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Metadados de documentos",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Documentos.*Metadados/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("renderiza a tela Ponto > Visão do período por padrão, com h1 único (T063)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Ponto.*Visão do período/ }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão do período" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Visão do período",
    );
  });

  it("Ponto > aba local 'Verificar folhas' continua acessível, sem regressão (T063)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Ponto.*Visão do período/ }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Verificar folhas" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Verificar folhas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Pendências da fila de verificação",
      }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Verificar folhas",
    );
  });

  it("Ponto volta para 'Visão do período' ao sair e voltar ao destino (T063)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Ponto.*Visão do período/ }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Verificar folhas" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Verificar folhas" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Cadastros/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Ponto.*Visão do período/ }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Visão do período" }),
    ).toBeInTheDocument();
  });

  it("renderiza a tela Pessoas > Horário de trabalho com h1 único", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Pessoas.*Horário de trabalho/ }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Colaboradores com tabela de horário atribuída",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Horário de trabalho",
    );
  });

  it("renderiza a tela Documentos > Metadados com h1 único", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Documentos.*Metadados/ }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Metadados de documentos",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Catálogo de tipos documentais" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Metadados de documentos",
    );
  });

  it("renderiza o Portal do Colaborador > Visão geral por padrão, com h1 único (T067)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Portal do Colaborador.*Visão geral — demonstração/,
      }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Portal do Colaborador — demonstração"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent("Visão geral");
  });

  it("Portal do Colaborador > troca de aba local não é regressão e reseta ao sair/voltar (T067)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Portal do Colaborador.*Visão geral — demonstração/,
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Meus documentos" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Meus documentos" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Cadastros/ }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Portal do Colaborador.*Visão geral — demonstração/,
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeInTheDocument();
  });

  it("cada botão de navegação é um <button> nativo, operável por teclado", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    const botoes = Array.from(nav.querySelectorAll("button"));
    expect(botoes).toHaveLength(6);
    for (const botao of botoes) {
      expect(botao.tagName).toBe("BUTTON");
      expect(botao).toHaveAttribute("type", "button");
    }
  });
});
