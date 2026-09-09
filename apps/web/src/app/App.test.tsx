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

  it("Cadastros > aba local 'Estrutura organizacional' continua acessível, sem regressão em Horários (T043/T073)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Estrutura organizacional",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Itens da estrutura organizacional",
      }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Estrutura organizacional",
    );
  });

  it("Cadastros > aba local 'Calendário de feriados' continua acessível, sem regressão em Horários/Estrutura organizacional (T076)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de feriados" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Calendário de feriados",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Calendário de feriados (exemplo)" }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Calendário de feriados",
    );
  });

  it("Cadastros > aba local 'Políticas de Banco de Horas' continua acessível, sem regressão em Horários/Estrutura organizacional/Calendário de feriados (T078)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Políticas de Banco de Horas" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Políticas de Banco de Horas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Políticas de Banco de Horas (exemplo)",
      }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Políticas de Banco de Horas",
    );
  });

  it("Cadastros > aba local 'Funções e cargos' continua acessível, sem regressão em Horários/Estrutura organizacional/Calendário de feriados/Políticas de Banco de Horas (T080)", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("tab", { name: "Funções e cargos" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Funções e cargos",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Funções e cargos (exemplo)",
      }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Funções e cargos",
    );
  });

  it("Cadastros volta para 'Horários' ao sair e voltar ao destino (T073)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Estrutura organizacional",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Pessoas/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Cadastros/ }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Horários" }),
    ).toBeInTheDocument();
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

  it("apresenta a navegação com os oito destinos, Cadastros ativo por padrão", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    expect(nav).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Início.*Visão geral/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Pessoas.*Colaboradores/ }),
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
    expect(
      screen.getByRole("button", {
        name: /Solicitações.*Central do RH/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Relatórios.*Exceções de Ponto/,
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
      /^Pessoas.*Colaboradores/,
      /^Ponto.*Visão do período/,
      /^Documentos.*Metadados/,
      /^Portal do Colaborador.*Visão geral — demonstração/,
      /^Solicitações.*Central do RH/,
      /^Relatórios.*Exceções de Ponto/,
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

  it("Ponto > aba local 'Ajustes manuais' continua acessível, sem regressão em Visão do período/Verificar folhas/Banco de Horas (T077)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Ponto.*Visão do período/ }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Ajustes manuais" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Ajustes manuais" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Ajustes manuais de marcação (exemplo)",
      }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Ajustes manuais",
    );
  });

  it("Ponto > aba local 'Fechamento e Espelho' continua acessível, sem regressão em Visão do período/Verificar folhas/Banco de Horas/Ajustes manuais (T079)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Ponto.*Visão do período/ }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Fechamento e Espelho" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Fechamento e Espelho" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Fechamento e Espelho — períodos (exemplo)",
      }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Fechamento e Espelho",
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

  it("renderiza a tela Pessoas > Colaboradores por padrão, com h1 único (T072)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Pessoas.*Colaboradores/ }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Colaboradores desta empresa" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Colaboradores",
    );
  });

  it("Pessoas > aba local 'Horário de trabalho' continua acessível, sem regressão (T046/T072)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Pessoas.*Colaboradores/ }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Colaboradores com tabela de horário atribuída",
      }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Horário de trabalho",
    );
  });

  it("Pessoas volta para 'Colaboradores' ao sair e voltar ao destino (T072)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Pessoas.*Colaboradores/ }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Cadastros/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Pessoas.*Colaboradores/ }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
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

  it("renderiza Solicitações > Central do RH com h1 único (T068)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Solicitações.*Central do RH/ }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Central do RH" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Solicitações para revisão do RH" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Central do RH",
    );
  });

  it("renderiza Relatórios > Exceções de Ponto por padrão, com h1 único (T075)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Relatórios.*Exceções de Ponto/ }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Exceções de Ponto para priorização e revisão do RH",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Exceções de Ponto",
    );
  });

  it("Relatórios > aba local 'Relatórios disponíveis' continua acessível, sem regressão em Exceções de Ponto (T075)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Relatórios.*Exceções de Ponto/ }),
    );
    fireEvent.click(
      screen.getByRole("tab", { name: "Relatórios disponíveis" }),
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Relatórios disponíveis",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Relatórios futuros do módulo de Ponto",
      }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Relatórios disponíveis",
    );
  });

  it("Relatórios volta para 'Exceções de Ponto' ao sair e voltar ao destino (T075)", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Relatórios.*Exceções de Ponto/ }),
    );
    fireEvent.click(
      screen.getByRole("tab", { name: "Relatórios disponíveis" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Relatórios disponíveis",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Cadastros/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Relatórios.*Exceções de Ponto/ }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
  });

  it("cada botão de navegação é um <button> nativo, operável por teclado", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    const botoes = Array.from(nav.querySelectorAll("button"));
    expect(botoes).toHaveLength(8);
    for (const botao of botoes) {
      expect(botao.tagName).toBe("BUTTON");
      expect(botao).toHaveAttribute("type", "button");
    }
  });
});
