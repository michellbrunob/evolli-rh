import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App — shell administrativo + navegação visual (T044)", () => {
  it("usa marcos semânticos e um único banner (a barra do shell)", () => {
    render(<App papelDoAtor="rh" />);

    // Exatamente um banner: a barra superior do shell. A tela de domínio não
    // introduz landmark próprio, então não há segundo banner competindo.
    const banner = screen.getByRole("banner");
    expect(banner).toHaveClass("app-shell__topbar");

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("exibe a marca textual 'Evolli RH' e o rótulo do painel", () => {
    render(<App papelDoAtor="rh" />);

    expect(screen.getAllByText("Evolli RH").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Painel Administrativo")).toBeInTheDocument();
  });

  it("tem exatamente um título de nível 1: o da tela de aterrissagem", () => {
    render(<App papelDoAtor="rh" />);

    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent("Colaboradores");
  });

  it("oferece um link 'pular para o conteúdo' que aponta para o <main>", () => {
    render(<App papelDoAtor="rh" />);

    const skip = screen.getByRole("link", { name: /pular para o conteúdo/i });
    expect(skip.getAttribute("href")).toBe("#conteudo-principal");

    const alvo = document.getElementById("conteudo-principal");
    expect(alvo).not.toBeNull();
    expect(alvo).toBe(screen.getByRole("main"));
  });

  it("o <main> é rotulado pelo título da tela (aria-labelledby)", () => {
    render(<App papelDoAtor="rh" />);

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(rotuloId).toBeTruthy();
    const rotulo = document.getElementById(rotuloId!);
    expect(rotulo?.tagName).toBe("H1");
    expect(rotulo).toHaveTextContent("Colaboradores");
  });

  it("renderiza Estrutura > Horários dentro do <main>", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: /^Estrutura/ }));

    const main = screen.getByRole("main");
    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(main).toContainElement(screen.getByText("Somente RH"));
  });

  it("Cadastros > aba local 'Estrutura organizacional' continua acessível, sem regressão em Horários (T043/T073)", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: /^Estrutura/ }));

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
    expect(screen.getByText("Somente RH")).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Estrutura organizacional",
    );
  });

  it("os catálogos de apoio NÃO estão em Estrutura — estão em Demonstração", () => {
    // Substitui as três cadeias de "sem regressão" que guardavam a
    // coexistência das onze abas. A coexistência acabou de propósito, e o
    // percurso completo de cada modo é coberto em `CadastrosScreen.test.tsx`.
    // O que se prova aqui é o roteamento: cada conjunto no seu destino.
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Estrutura/ }));
    for (const demonstrativa of [
      "Calendário de feriados",
      "Políticas de Banco de Horas",
      "Motivos de ausência e justificativas",
      "Tipos de documento",
      "Motivos de desligamento",
      "Escolaridade",
      "Cidades e localidades",
    ]) {
      expect(screen.queryByRole("tab", { name: demonstrativa })).toBeNull();
    }

    fireEvent.click(
      screen.getByRole("button", { name: /^Catálogos de apoio/ }),
    );
    for (const demonstrativa of [
      "Calendário de feriados",
      "Políticas de Banco de Horas",
      "Motivos de ausência e justificativas",
    ]) {
      expect(
        screen.getByRole("tab", { name: demonstrativa }),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("Cadastros volta para 'Horários' ao sair e voltar ao destino (T073)", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: /^Estrutura/ }));

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
    fireEvent.click(screen.getByRole("button", { name: /^Estrutura/ }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Horários" }),
    ).toBeInTheDocument();
  });

  it("não referencia autenticação, sessão real ou dado sensível no shell", () => {
    render(<App papelDoAtor="rh" />);

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

  it("apresenta a navegação com todos os destinos do mapa, Pessoas ativo por padrão", () => {
    render(<App papelDoAtor="rh" />);

    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    expect(nav).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /^Visão geral/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Pessoas/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Jornada/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Documentos/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /^Portal do Colaborador/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /^Central de solicitações/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /^Relatórios/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Contas de acesso" }),
    ).toBeInTheDocument();

    // Pessoas é a aterrissagem funcional de `rh` desde a T159.
    const pessoas = screen.getByRole("button", { name: /^Pessoas/ });
    expect(pessoas).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: /^Visão geral/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("troca o conteúdo do <main> ao selecionar outro destino, com h1 único", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Visão geral/ }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const inicioBtn = screen.getByRole("button", {
      name: /^Visão geral/,
    });
    expect(inicioBtn).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: /^Estrutura/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("nenhum destino mostra mais 'Módulo em preparação' — todos têm tela própria (T048)", () => {
    render(<App papelDoAtor="rh" />);

    // Todos os catorze destinos do mapa da T159 — operacionais e de
    // demonstração. Nenhum pode cair no placeholder.
    for (const rotulo of [
      /^Pessoas/,
      /^Estrutura/,
      /^Jornada/,
      /^Minha equipe/,
      /^Administração da liderança/,
      /^Contas de acesso/,
      /^Visão geral/,
      /^Benefícios e dependentes/,
      /^Catálogos de apoio/,
      /^Apuração e banco de horas/,
      /^Documentos/,
      /^Central de solicitações/,
      /^Relatórios/,
      /^Portal do Colaborador/,
    ]) {
      fireEvent.click(screen.getByRole("button", { name: rotulo }));
      expect(
        screen.queryByText("Módulo em preparação"),
      ).not.toBeInTheDocument();
    }
  });

  it("renderiza a tela Início > Visão geral com h1 único e atalhos que trocam o destino local", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Visão geral/ }));

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
    expect(screen.getByRole("button", { name: /^Documentos/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renderiza Jornada > Visão do período, com h1 único (T063)", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: /^Jornada/ }));

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

  it("a apuração e o banco de horas NÃO estão em Jornada — estão em Demonstração", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Jornada/ }));
    for (const demonstrativa of [
      "Verificar folhas",
      "Banco de Horas",
      "Ajustes manuais",
      "Fechamento e Espelho",
      "Escalas e jornadas",
      "Inconsistências",
      "Justificativas",
    ]) {
      expect(screen.queryByRole("tab", { name: demonstrativa })).toBeNull();
    }

    fireEvent.click(
      screen.getByRole("button", { name: /^Apuração e banco de horas/ }),
    );
    for (const demonstrativa of [
      "Verificar folhas",
      "Ajustes manuais",
      "Fechamento e Espelho",
    ]) {
      expect(
        screen.getByRole("tab", { name: demonstrativa }),
      ).toBeInTheDocument();
    }
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("Jornada volta para 'Visão do período' ao sair e voltar ao destino (T063)", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Jornada/ }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão do período" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Pessoas/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Jornada/ }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Visão do período" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renderiza a tela Pessoas > Colaboradores por padrão, com h1 único (T111)", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Pessoas/ }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(screen.getByText("RH e DP")).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Colaboradores",
    );
  });

  it("Pessoas > aba local 'Horário de trabalho' continua acessível, sem regressão (T112)", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Pessoas/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Somente RH")).toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Horário de trabalho",
    );
  });

  it("Pessoas volta para 'Colaboradores' ao sair e voltar ao destino (T072)", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Pessoas/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Estrutura/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Pessoas/ }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("renderiza a tela Documentos > Metadados com h1 único", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Documentos/ }));

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
    render(<App papelDoAtor="rh" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /^Portal do Colaborador/,
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
    render(<App papelDoAtor="rh" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /^Portal do Colaborador/,
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Meus documentos" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Meus documentos" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Estrutura/ }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /^Portal do Colaborador/,
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeInTheDocument();
  });

  it("renderiza Solicitações > Central do RH com h1 único (T068)", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(
      screen.getByRole("button", { name: /^Central de solicitações/ }),
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
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Relatórios/ }));

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

  it("renderiza Contas de acesso com h1 próprio (T121) — sem 'Módulo em preparação'", async () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: "Contas de acesso" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Contas de acesso" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent(
      "Contas de acesso",
    );

    // Este arquivo testa só o shell, sem mockar rede: GET /v1/users/me real
    // falha (sem servidor), e a tela cai no próprio estado de erro — nunca
    // trava nem lança exceção não tratada. Cobertura detalhada por papel
    // (master_tecnico/rh/dp) vive em ContasAcessoScreen.test.tsx.
    await screen.findByText("Não foi possível identificar sua conta");
  });

  it("Relatórios > aba local 'Relatórios disponíveis' continua acessível, sem regressão em Exceções de Ponto (T075)", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Relatórios/ }));
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
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Relatórios/ }));
    fireEvent.click(
      screen.getByRole("tab", { name: "Relatórios disponíveis" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Relatórios disponíveis",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Estrutura/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Relatórios/ }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Exceções de Ponto" }),
    ).toBeInTheDocument();
  });

  it("sem onLogout (uso direto, como em todo teste acima): não mostra nenhum botão 'Sair' (T116)", () => {
    render(<App papelDoAtor="rh" />);

    expect(
      screen.queryByRole("button", { name: "Sair" }),
    ).not.toBeInTheDocument();
  });

  it("com onLogout informado, mostra o botão 'Sair' na barra superior e o aciona ao clicar (T116)", () => {
    const onLogout = vi.fn();
    render(<App papelDoAtor="rh" onLogout={onLogout} />);

    const botaoSair = screen.getByRole("button", { name: "Sair" });
    expect(botaoSair).toBeInTheDocument();

    fireEvent.click(botaoSair);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("sem onLogout: não mostra o botão 'Sessões ativas' nem o painel (T117)", () => {
    render(<App papelDoAtor="rh" />);

    expect(
      screen.queryByRole("button", { name: "Sessões ativas" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sessões ativas" }),
    ).not.toBeInTheDocument();
  });

  it("com onLogout informado, mostra e abre o painel 'Sessões ativas' ao clicar, e fecha ao clicar em Fechar (T117)", () => {
    render(<App papelDoAtor="rh" onLogout={vi.fn()} />);

    const botaoAbrir = screen.getByRole("button", { name: "Sessões ativas" });
    expect(botaoAbrir).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("heading", { name: "Sessões ativas" }),
    ).not.toBeInTheDocument();

    fireEvent.click(botaoAbrir);

    expect(botaoAbrir).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("heading", { name: "Sessões ativas" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(
      screen.queryByRole("heading", { name: "Sessões ativas" }),
    ).not.toBeInTheDocument();
  });

  it("sem onLogout: não mostra o botão 'Segurança' (T126)", () => {
    render(<App papelDoAtor="rh" />);
    expect(
      screen.queryByRole("button", { name: "Segurança" }),
    ).not.toBeInTheDocument();
  });

  it("com onLogout mas MFA indisponível (padrão): não mostra 'Segurança' (T131)", () => {
    // `mfaDisponivel` ausente = false: com o MFA desativado no servidor, o botão
    // e o painel de Segurança não aparecem, mesmo com sessão ativa.
    render(<App papelDoAtor="rh" onLogout={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "Segurança" }),
    ).not.toBeInTheDocument();
  });

  it("com onLogout e mfaDisponivel: abre e fecha o painel 'Segurança da conta' (T126/T131)", () => {
    render(<App papelDoAtor="rh" onLogout={vi.fn()} mfaDisponivel />);

    const botao = screen.getByRole("button", { name: "Segurança" });
    expect(botao).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("heading", { name: "Segurança da conta" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByRole("heading", { name: "Segurança da conta" }),
    ).not.toBeInTheDocument();
  });

  it("abrir 'Segurança' fecha 'Sessões ativas' e vice-versa (painéis exclusivos, T126/T131)", () => {
    render(<App papelDoAtor="rh" onLogout={vi.fn()} mfaDisponivel />);

    fireEvent.click(screen.getByRole("button", { name: "Sessões ativas" }));
    expect(
      screen.getByRole("heading", { name: "Sessões ativas" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Segurança" }));
    expect(
      screen.getByRole("heading", { name: "Segurança da conta" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sessões ativas" }),
    ).not.toBeInTheDocument();
  });

  it("cada botão de navegação é um <button> nativo, operável por teclado", () => {
    render(<App papelDoAtor="rh" />);

    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    const botoes = Array.from(nav.querySelectorAll("button"));
    // Catorze destinos: `rh` enxerga o mapa inteiro.
    expect(botoes).toHaveLength(14);
    for (const botao of botoes) {
      expect(botao.tagName).toBe("BUTTON");
      expect(botao).toHaveAttribute("type", "button");
    }
  });
});

describe("App — capacidade condicional do gestor (T153)", () => {
  // O destino "Minha equipe" é a primeira capacidade do shell decidida pelo
  // SERVIDOR, no mesmo molde de `mfaDisponivel` (T131): sem confirmação, não
  // aparece. Isto NÃO é autorização — a `EquipeScreen` reverifica e o RBAC
  // continua sendo a fronteira real —, é não oferecer uma porta que levaria a
  // "Sem permissão".
  it("T153.A1 sem papel confirmado pelo servidor, o destino não aparece", () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: /Minha equipe/ })).toBeNull();
  });

  it.each(["dp", "colaborador", "master_tecnico", "financeiro"])(
    "T153.A2 papel %s sem a capacidade não vê o destino",
    (papel) => {
      render(<App papelDoAtor={papel} />);
      expect(screen.queryByRole("button", { name: /Minha equipe/ })).toBeNull();
    },
  );

  it.each(["gestor", "rh"])(
    "T153.A3 papel %s, concedido pelo contrato, vê o destino",
    (papel) => {
      render(<App papelDoAtor={papel} />);
      expect(
        screen.getByRole("button", { name: /Minha equipe/ }),
      ).toBeInTheDocument();
    },
  );

  it("T153.A4 selecionar o destino monta a tela do gestor", () => {
    render(<App papelDoAtor="gestor" />);
    fireEvent.click(screen.getByRole("button", { name: /Minha equipe/ }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Minha equipe" }),
    ).toBeInTheDocument();
    // O <main> é rotulado pelo h1 da tela, como os demais destinos.
    expect(screen.getByRole("main")).toHaveAttribute(
      "aria-labelledby",
      "equipe-titulo",
    );
  });
});
