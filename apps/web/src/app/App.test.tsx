import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderComMenuAberto as render } from "../test/menuLateral";

/**
 * T209 — Segurança, Sessões ativas e Sair moram no menu da conta da barra
 * superior (Radix: abre pelo teclado).
 */
async function itemDaConta(nome: string): Promise<HTMLElement> {
  const conta = screen.getByRole("button", { name: /^Conta: / });
  if (conta.getAttribute("aria-expanded") !== "true") {
    fireEvent.keyDown(conta, { key: "Enter" });
  }
  return screen.findByRole("menuitem", { name: nome });
}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { App } from "./App";
import {
  definirLarguraDaJanela,
  redefinirLarguraDaJanela,
} from "../test/viewport";
import {
  listarEmpresasDoContexto,
  trocarEmpresaDoContexto,
} from "../api/contextoEmpresarialClient";

// T189 — o seletor de empresa do menu lateral só existe na sessão autenticada
// (`onLogout`); os testes que montam o `App` sem ela não o veem nem o chamam.
vi.mock("../api/contextoEmpresarialClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/contextoEmpresarialClient")
  >("../api/contextoEmpresarialClient");
  return {
    ...actual,
    listarEmpresasDoContexto: vi.fn(),
    trocarEmpresaDoContexto: vi.fn(),
  };
});

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

  it("T210 — a assinatura horizontal oficial no topo da faixa, com o nome 'Evolli'", () => {
    render(<App papelDoAtor="rh" />);
    const topo = document.querySelector(".app-shell__cabecalho-lateral")!;
    const marca = within(topo as HTMLElement).getByRole("img", {
      name: "Evolli",
    });
    expect(marca.getAttribute("src")).toMatch(/evolli-horizontal\.svg$/);
    expect(document.body.textContent).not.toContain("Evolli RH");
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

  it("renderiza Estrutura > Jornadas de trabalho dentro do <main> (T182)", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(
      screen.getByRole("button", { name: /^Escala de trabalho/ }),
    );

    const main = screen.getByRole("main");
    expect(main).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Jornadas de trabalho" }),
    );
    expect(main).toContainElement(screen.getByText("Operação do RH"));
    expect(
      document.getElementById(main.getAttribute("aria-labelledby")!),
    ).toHaveTextContent("Jornadas de trabalho");
  });

  it("Estrutura não tem mais a aba Horários: ela virou Jornadas de trabalho (T182)", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: /^Organograma/ }));
    expect(screen.queryByRole("tab", { name: "Horários" })).toBeNull();
  });

  it("Cadastros > aba local 'Estrutura organizacional' continua acessível, sem regressão em Horários (T043/T073)", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: /^Organograma/ }));

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
    const { unmount } = render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Organograma/ }));
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
    unmount();

    // T211 — Demonstração saiu do menu: a tela abre pelo destino inicial.
    render(<App papelDoAtor="rh" destinoInicial="cadastros-demonstracao" />);
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

  it("Cadastros volta para 'Estrutura organizacional' ao sair e voltar ao destino (T073/T182)", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: /^Organograma/ }));

    fireEvent.click(screen.getByRole("tab", { name: "Funções e cargos" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Funções e cargos" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Colaboradores Consulta, ficha e vida funcional",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Organograma/ }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Estrutura organizacional",
      }),
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

  it("T211 — apresenta a navegação organizada, Pessoas ativo por padrão", () => {
    render(<App papelDoAtor="rh" />);

    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    for (const nome of [
      "Colaboradores Consulta, ficha e vida funcional",
      "Escala de trabalho Turnos da empresa",
      "Organograma Unidades, cargos e centros de custo",
      "Liderança Consulta do gestor",
    ]) {
      expect(
        within(nav).getByRole("button", { name: nome }),
      ).toBeInTheDocument();
    }
    // Fora do menu: Ponto, Contas de acesso (em Configurações) e Demonstração.
    for (const ausente of [
      /^Jornada Visão/,
      /^Contas de acesso/,
      /^Documentos/,
      /^Portal do Colaborador/,
      /^Central de solicitações/,
      /^Relatórios/,
    ]) {
      expect(within(nav).queryByRole("button", { name: ausente })).toBeNull();
    }

    // Pessoas é a aterrissagem funcional de `rh` desde a T159.
    const pessoas = screen.getByRole("button", {
      name: "Colaboradores Consulta, ficha e vida funcional",
    });
    expect(pessoas).toHaveAttribute("aria-current", "page");
  });

  it("troca o conteúdo do <main> ao selecionar outro destino, com h1 único", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(screen.getByRole("button", { name: /^Organograma/ }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Estrutura organizacional",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /^Organograma/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: /^Colaboradores Consulta/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("nenhum destino mostra mais 'Módulo em preparação' — todos têm tela própria (T048)", () => {
    // Todos os destinos do mapa — operacionais e de demonstração. T211 — os
    // que estão fora do menu abrem pelo destino inicial, como o shell aceita.
    for (const destino of [
      "pessoas",
      "nova-admissao",
      "cadastros",
      "jornadas-trabalho",
      "ponto",
      "equipe",
      "administracao-lideranca",
      "contas-acesso",
      "inicio",
      "pessoas-demonstracao",
      "cadastros-demonstracao",
      "ponto-demonstracao",
      "documentos",
      "solicitacoes-rh",
      "relatorios",
      "portal-colaborador",
    ]) {
      const { unmount } = render(
        <App papelDoAtor="rh" destinoInicial={destino} />,
      );
      expect(
        screen.queryByText("Módulo em preparação"),
        destino,
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("renderiza a tela Início > Visão geral com h1 único e atalhos que trocam o destino local", () => {
    // T211 — fora do menu: abre pelo destino inicial.
    render(<App papelDoAtor="rh" destinoInicial="inicio" />);

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
  });

  it("renderiza Jornada > Visão do período, com h1 único (T063)", () => {
    // T211 — fora do menu, com URL própria.
    render(<App papelDoAtor="rh" destinoInicial="ponto" />);
    expect(window.location.hash).toBe("#/jornada/ponto");

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
    const { unmount } = render(<App papelDoAtor="rh" destinoInicial="ponto" />);
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

    unmount();
    render(<App papelDoAtor="rh" destinoInicial="ponto-demonstracao" />);
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

  it("Jornada volta para 'Visão do período' ao sair e voltar pela URL (T063, T211)", () => {
    render(<App papelDoAtor="rh" destinoInicial="ponto" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão do período" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Colaboradores Consulta, ficha e vida funcional",
      }),
    );
    act(() => {
      window.history.pushState(null, "", "/#/jornada/ponto");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Visão do período" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renderiza a tela Pessoas > Colaboradores por padrão, com h1 único (T111)", () => {
    render(<App papelDoAtor="rh" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Colaboradores Consulta, ficha e vida funcional",
      }),
    );

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

    fireEvent.click(
      screen.getByRole("button", {
        name: "Colaboradores Consulta, ficha e vida funcional",
      }),
    );
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

    fireEvent.click(
      screen.getByRole("button", {
        name: "Colaboradores Consulta, ficha e vida funcional",
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Organograma/ }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Colaboradores Consulta, ficha e vida funcional",
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("renderiza a tela Documentos > Metadados com h1 único", () => {
    render(<App papelDoAtor="rh" destinoInicial="documentos" />);

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
    render(<App papelDoAtor="rh" destinoInicial="portal-colaborador" />);

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

  it("renderiza Solicitações > Central do RH com h1 único (T068)", () => {
    render(<App papelDoAtor="rh" destinoInicial="solicitacoes-rh" />);

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
    render(<App papelDoAtor="rh" destinoInicial="relatorios" />);

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
    // T215 — as Contas de acesso são Segurança › Permissões de acesso: o h1
    // é o do módulo, e a tela vira o painel com h2.
    render(<App papelDoAtor="rh" destinoInicial="contas-acesso" />);
    expect(window.location.hash).toBe("#/seguranca/permissoes-de-acesso");

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Segurança" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Permissões de acesso" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Módulo em preparação")).not.toBeInTheDocument();

    const main = screen.getByRole("main");
    const rotuloId = main.getAttribute("aria-labelledby");
    expect(document.getElementById(rotuloId!)).toHaveTextContent("Segurança");

    // Este arquivo testa só o shell, sem mockar rede: GET /v1/users/me real
    // falha (sem servidor), e a tela cai no próprio estado de erro — nunca
    // trava nem lança exceção não tratada. Cobertura detalhada por papel
    // (master_tecnico/rh/dp) vive em ContasAcessoScreen.test.tsx.
    await screen.findByText("Não foi possível identificar sua conta");
  });

  it("Relatórios > aba local 'Relatórios disponíveis' continua acessível, sem regressão em Exceções de Ponto (T075)", () => {
    render(<App papelDoAtor="rh" destinoInicial="relatorios" />);
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

  it("sem onLogout (uso direto, como em todo teste acima): não mostra nenhum botão 'Sair' (T116)", () => {
    render(<App papelDoAtor="rh" />);

    expect(
      screen.queryByRole("button", { name: "Sair" }),
    ).not.toBeInTheDocument();
  });

  it("com onLogout informado, 'Sair' fica no menu da conta da barra superior e o aciona (T116/T209)", async () => {
    const onLogout = vi.fn();
    render(<App papelDoAtor="rh" onLogout={onLogout} />);

    fireEvent.click(await itemDaConta("Sair"));
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

  it("com onLogout informado, 'Sessões ativas' no menu da conta leva a Segurança › Sessões ativas (T117/T209/T215)", async () => {
    render(<App papelDoAtor="rh" onLogout={vi.fn()} />);

    expect(
      screen.queryByRole("heading", { name: "Sessões ativas" }),
    ).not.toBeInTheDocument();

    fireEvent.click(await itemDaConta("Sessões ativas"));

    // T215 — é a página do módulo Segurança, não um painel com "Fechar".
    expect(window.location.hash).toBe("#/seguranca/sessoes-ativas");
    expect(
      within(screen.getByRole("main")).getByRole("heading", {
        level: 2,
        name: "Sessões ativas",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
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

  it("com onLogout e mfaDisponivel: abre e fecha o painel 'Segurança da conta' pelo menu da conta (T126/T131/T209)", async () => {
    render(<App papelDoAtor="rh" onLogout={vi.fn()} mfaDisponivel />);

    fireEvent.click(await itemDaConta("Segurança"));
    expect(
      screen.getByRole("heading", { name: "Segurança da conta" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByRole("heading", { name: "Segurança da conta" }),
    ).not.toBeInTheDocument();
  });

  it("'Sessões ativas' fecha o painel 'Segurança da conta' e leva à página (T126/T131/T215)", async () => {
    render(<App papelDoAtor="rh" onLogout={vi.fn()} mfaDisponivel />);

    fireEvent.click(await itemDaConta("Segurança"));
    expect(
      screen.getByRole("heading", { name: "Segurança da conta" }),
    ).toBeInTheDocument();

    // T215 — Sessões ativas virou página: abri-la fecha o painel do MFA.
    fireEvent.click(await itemDaConta("Sessões ativas"));
    expect(
      screen.queryByRole("heading", { name: "Segurança da conta" }),
    ).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#/seguranca/sessoes-ativas");
  });

  it("cada botão de navegação é um <button> nativo, operável por teclado", () => {
    render(<App papelDoAtor="rh" />);

    const nav = screen.getByRole("navigation", {
      name: "Navegação do painel",
    });
    const botoes = Array.from(nav.querySelectorAll("button"));
    // Dezesseis destinos (`rh` enxerga o mapa inteiro; Nova admissão, T176,
    // saiu da barra na T178 — é sub-página de Colaboradores; Jornadas de
    // trabalho entrou na T182; o Dashboard, na T205) mais os quatro
    // cabeçalhos de módulo expansível: Gestão de Pessoas
    // (`sempreComoModulo`), Estrutura (dois itens desde a T182), Liderança e
    // Demonstração. O Dashboard é item único: módulo e destino fundidos.
    // T208 — Configurações também é item único (a própria conta): 21.
    // T209 — menu completo: + 11 itens em desenvolvimento (8 de primeiro
    // nível e 3 subitens) e o cabeçalho expansível de Recrutamento: 33. O
    // cabeçalho de Gestão de Pessoas se chama "Colaboradores" na barra.
    // T211 — organização do menu: Colaboradores (cabeçalho + Colaboradores,
    // Escala de trabalho, Organograma e Desenvolvimento), Recrutamento
    // (cabeçalho + 2), Dashboard, Portal, Pesquisas, Calendário, Liderança,
    // Folha, Benefícios, Hub, Suporte, Roadmap e Configurações: 19. Sem
    // Operação, Estrutura, Jornada, Administração e Demonstração.
    // T215 — + Segurança (item único, no rodapé): 20.
    expect(botoes).toHaveLength(20);
    expect(
      botoes
        .filter((b) => b.hasAttribute("aria-expanded"))
        .map((b) => b.textContent),
    ).toEqual(["Colaboradores", "Recrutamento"]);
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
      expect(screen.queryByRole("button", { name: /^Liderança/ })).toBeNull();
    },
  );

  it.each(["gestor", "rh"])(
    "T153.A3 papel %s, concedido pelo contrato, vê o destino",
    (papel) => {
      render(<App papelDoAtor={papel} />);
      // T211 — no menu, Minha equipe é o item Liderança.
      expect(
        screen.getByRole("button", { name: /^Liderança/ }),
      ).toBeInTheDocument();
    },
  );

  it("T153.A4 selecionar o destino monta a tela do gestor", () => {
    render(<App papelDoAtor="gestor" />);
    fireEvent.click(screen.getByRole("button", { name: /^Liderança/ }));

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

describe("App — cabeçalho enxuto (T159 — evolução visual)", () => {
  /** T209 — o nome de cada controle da barra (o acessível, que vale). */
  function acoesDoCabecalho() {
    return within(screen.getByRole("banner"))
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim());
  }

  it("oferece exatamente as ações que existem — e nada mais (T209: a conta reúne Segurança, Sessões ativas e Sair)", async () => {
    render(<App papelDoAtor="rh" onLogout={() => {}} mfaDisponivel />);
    expect(acoesDoCabecalho()).toEqual(["Menu", "Conta: Minha conta"]);
    fireEvent.keyDown(screen.getByRole("button", { name: /^Conta: / }), {
      key: "Enter",
    });
    expect(
      within(await screen.findByRole("menu"))
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Meu perfil", "Segurança", "Sessões ativas", "Sair"]);
  });

  it("não inventa marketplace, busca global, notificação, favorito nem suporte", () => {
    render(<App papelDoAtor="rh" onLogout={() => {}} mfaDisponivel />);
    const cabecalho = screen.getByRole("banner").innerHTML.toLowerCase();
    for (const ficticia of [
      "marketplace",
      "favorito",
      "notifica",
      "suporte",
      "central de ajuda",
      "novidade",
      "pesquisar",
      'type="search"',
    ]) {
      expect(cabecalho).not.toContain(ficticia);
    }
  });

  it("sem sessão, o cabeçalho só tem o botão da gaveta (o recolher fica no topo da faixa)", () => {
    render(<App papelDoAtor="rh" />);
    expect(acoesDoCabecalho()).toEqual(["Menu"]);
  });

  it("T209 — não mostra o papel técnico no cabeçalho", () => {
    render(<App papelDoAtor="gestor" onLogout={() => {}} />);
    expect(within(screen.getByRole("banner")).queryByText("Gestor")).toBeNull();
  });

  it("sem papel confirmado, não inventa contexto nenhum", () => {
    render(<App />);
    const cabecalho = within(screen.getByRole("banner"));
    for (const rotulo of ["RH", "DP", "Gestor", "Master técnico"]) {
      expect(cabecalho.queryByText(rotulo)).toBeNull();
    }
  });

  it("T210 — as imagens do painel são só os SVGs locais da marca", () => {
    render(<App papelDoAtor="rh" />);
    expect(
      screen.getAllByRole("img", { name: "Evolli" }).length,
    ).toBeGreaterThanOrEqual(1);
    for (const img of document.querySelectorAll("img")) {
      expect(img.getAttribute("src")).toMatch(
        /assets\/brand\/evolli-[a-z-]+\.svg$/,
      );
    }
  });
});

describe("App — gaveta de navegação do mobile (T159 — evolução visual)", () => {
  // A gaveta só existe abaixo de 835px. Antes da correção da R1 o shell não
  // olhava a largura: abria em qualquer viewport e continuava aberta depois
  // de a janela crescer.
  beforeEach(() => {
    definirLarguraDaJanela(375);
  });

  afterEach(() => {
    redefinirLarguraDaJanela();
  });

  function gaveta() {
    return document.getElementById("navegacao-lateral")!;
  }

  function botaoMenu() {
    return document.querySelector<HTMLButtonElement>(".app-shell__menu")!;
  }

  function focaveisDaGaveta() {
    return [...gaveta().querySelectorAll<HTMLElement>("button")].filter(
      (b) => b.closest("[hidden]") === null,
    );
  }

  it("o botão declara o que controla e começa fechado", () => {
    render(<App papelDoAtor="rh" />);
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveAttribute("aria-controls", "navegacao-lateral");
    expect(gaveta()).toBeInTheDocument();
  });

  it("abrir leva o foco para dentro da gaveta", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(botaoMenu()).toHaveAttribute("aria-expanded", "true");
    expect(gaveta().contains(document.activeElement)).toBe(true);
  });

  it("Escape fecha e devolve o foco a quem abriu", () => {
    render(<App papelDoAtor="rh" />);
    const menu = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(menu);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(menu);
  });

  it("o Tab circula dentro da gaveta e não escapa para o cabeçalho", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    const focaveis = focaveisDaGaveta();
    expect(focaveis.length).toBeGreaterThan(1);
    const primeiro = focaveis[0]!;
    const ultimo = focaveis[focaveis.length - 1]!;

    ultimo.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(primeiro);

    primeiro.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(ultimo);
  });

  it("escolher um destino fecha a gaveta e troca o conteúdo", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: /^Organograma/ }));

    expect(botaoMenu()).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Estrutura organizacional",
      }),
    ).toBeInTheDocument();
  });

  it("o fundo fecha a gaveta, e só existe enquanto ela está aberta", () => {
    render(<App papelDoAtor="rh" />);
    expect(document.querySelector(".app-shell__fundo-gaveta")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));

    expect(botaoMenu()).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector(".app-shell__fundo-gaveta")).toBeNull();
  });

  it("a gaveta aberta não duplica o h1 do fundo", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });
});

describe("App — R3: modalidade real da gaveta", () => {
  function gaveta() {
    return document.getElementById("navegacao-lateral")!;
  }

  afterEach(() => {
    redefinirLarguraDaJanela();
  });

  it("aberta no mobile, a gaveta é um diálogo modal com nome acessível", () => {
    definirLarguraDaJanela(375);
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    const dialogo = screen.getByRole("dialog", { name: "Menu de navegação" });
    expect(dialogo).toBe(gaveta());
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    // A navegação continua sendo uma navegação DENTRO do diálogo.
    expect(
      within(dialogo).getByRole("navigation", {
        name: "Navegação do painel",
      }),
    ).toBeInTheDocument();
  });

  it("o fundo fica inacessível enquanto é modal e volta inteiro ao fechar", () => {
    definirLarguraDaJanela(375);
    render(<App papelDoAtor="rh" onLogout={() => {}} />);
    const cabecalho = document.querySelector("header")!;
    const principal = document.querySelector("main")!;
    const rodape = document.querySelector("footer")!;

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    for (const regiao of [cabecalho, principal, rodape]) {
      // `inert` corta foco e clique; `aria-hidden` é a rede para quem ainda
      // não implementa `inert`.
      expect(regiao).toHaveAttribute("inert");
      expect(regiao).toHaveAttribute("aria-hidden", "true");
    }
    // A árvore de acessibilidade perde mesmo o fundo...
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
    expect(screen.queryByRole("contentinfo")).toBeNull();
    // ...sem que o DOM seja mutilado: o h1 continua lá, único.
    expect(document.querySelectorAll("h1")).toHaveLength(1);

    fireEvent.keyDown(document, { key: "Escape" });

    for (const regiao of [cabecalho, principal, rodape]) {
      expect(regiao).not.toHaveAttribute("inert");
      expect(regiao).not.toHaveAttribute("aria-hidden");
    }
    expect(screen.getByRole("main")).toBe(principal);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("no desktop a barra permanente NÃO tem semântica de diálogo", () => {
    definirLarguraDaJanela(1280);
    render(<App papelDoAtor="rh" />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(gaveta()).not.toHaveAttribute("role");
    expect(gaveta()).not.toHaveAttribute("aria-modal");
    expect(screen.getByRole("main")).not.toHaveAttribute("inert");
    expect(screen.getByRole("main")).not.toHaveAttribute("aria-hidden");
  });

  it("no desktop o botão da gaveta não abre nada", () => {
    // O botão existe no DOM em qualquer largura (o CSS é que o esconde). Se
    // alguém o acionar fora do modo gaveta, nada de modal pode acontecer.
    definirLarguraDaJanela(1280);
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".app-shell__fundo-gaveta")).toBeNull();
    expect(screen.getByRole("main")).not.toHaveAttribute("inert");
  });
});

describe("App — R1: atravessar o breakpoint com a gaveta aberta", () => {
  function gaveta() {
    return document.getElementById("navegacao-lateral")!;
  }

  afterEach(() => {
    redefinirLarguraDaJanela();
  });

  it("mobile → desktop desfaz gaveta, scrim, diálogo e estado móvel", () => {
    // O caso real: girar um tablet de 768 para 1024 com a gaveta aberta.
    // Antes da correção sobrava um scrim de página inteira por cima de uma
    // barra lateral que já estava no fluxo normal.
    definirLarguraDaJanela(768);
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(
      screen.getByRole("dialog", { name: "Menu de navegação" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".app-shell__fundo-gaveta")).not.toBeNull();

    act(() => {
      definirLarguraDaJanela(1024);
    });

    expect(document.querySelector(".app-shell__fundo-gaveta")).toBeNull();
    expect(document.querySelector(".app-shell--gaveta-aberta")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(gaveta()).not.toHaveAttribute("role");
    expect(gaveta()).not.toHaveAttribute("aria-modal");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("o fundo volta a ser alcançável depois do redimensionamento", () => {
    definirLarguraDaJanela(375);
    render(<App papelDoAtor="rh" onLogout={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    act(() => {
      definirLarguraDaJanela(1366);
    });

    for (const seletor of ["header", "main", "footer"]) {
      const regiao = document.querySelector(seletor)!;
      expect(regiao).not.toHaveAttribute("inert");
      expect(regiao).not.toHaveAttribute("aria-hidden");
    }
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /^Conta: / }),
    ).toBeInTheDocument();
  });

  it("o foco deixa de ser preso: Tab a partir do conteúdo não volta à barra", () => {
    definirLarguraDaJanela(375);
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    act(() => {
      definirLarguraDaJanela(1366);
    });

    const principal = screen.getByRole("main");
    principal.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    // Com a armadilha ativa, o Tab a partir de fora da caixa puxaria o foco
    // para o primeiro botão dela. Sem ela, o foco fica onde estava.
    expect(gaveta().contains(document.activeElement)).toBe(false);
    expect(document.activeElement).toBe(principal);
  });

  it("não rouba o foco para um botão que o desktop esconde", () => {
    definirLarguraDaJanela(375);
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const dentro = document.activeElement;
    expect(gaveta().contains(dentro)).toBe(true);

    act(() => {
      definirLarguraDaJanela(1366);
    });

    // Fechar POR REDIMENSIONAMENTO não devolve o foco ao botão "Menu" — ele
    // acabou de virar `display: none`, e focá-lo jogaria o foco para o body.
    // O foco fica onde está, na barra que agora é permanente.
    expect(document.activeElement).not.toBe(
      document.querySelector(".app-shell__menu"),
    );
    expect(document.activeElement).toBe(dentro);
  });

  it("fecha mesmo quando só o `resize` chega, sem evento `change`", () => {
    // Medido no painel de prévia deste projeto: com viewport emulado,
    // `matchMedia().matches` muda e `change` nunca é disparado. Se o shell
    // dependesse só de `change`, a janela cresceria e ele continuaria em
    // modo gaveta — o defeito R1 por outro caminho.
    definirLarguraDaJanela(375);
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => {
      definirLarguraDaJanela(1366, { silencioso: true });
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".app-shell__fundo-gaveta")).toBeNull();
    expect(screen.getByRole("main")).not.toHaveAttribute("inert");
  });

  it("desktop → mobile não abre nada sozinho", () => {
    definirLarguraDaJanela(1280);
    render(<App papelDoAtor="rh" />);

    act(() => {
      definirLarguraDaJanela(375);
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("S2 — acionar no desktop e DEPOIS encolher não abre a gaveta", () => {
    // O botão existe no DOM em qualquer largura (quem o esconde é o CSS),
    // então um acionamento no desktop é possível por programa. Sem a guarda,
    // `gavetaAberta` ficava `true` de forma invisível e a gaveta abria
    // sozinha na primeira vez que a janela encolhesse.
    definirLarguraDaJanela(1280);
    render(<App papelDoAtor="rh" />);

    const menu = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(menu);
    fireEvent.click(menu);
    fireEvent.click(menu);
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      definirLarguraDaJanela(375);
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".app-shell__fundo-gaveta")).toBeNull();
    expect(document.querySelector(".app-shell--gaveta-aberta")).toBeNull();
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("main")).not.toHaveAttribute("inert");
  });

  it("S2 — depois disso a gaveta ainda abre normalmente no mobile", () => {
    // A guarda não pode custar a função: um clique inútil no desktop não
    // deixa o acionador travado depois.
    definirLarguraDaJanela(1280);
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    act(() => {
      definirLarguraDaJanela(375);
    });
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(
      screen.getByRole("dialog", { name: "Menu de navegação" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("App — contrato responsivo do shell (T159 — evolução visual)", () => {
  // O jsdom não aplica media query: o que se prende aqui é o CONTRATO escrito
  // no CSS. A conferência visual em 375px e no desktop é feita no navegador,
  // e está registrada na PR.
  const css = readFileSync("src/app/app-shell.css", "utf8");

  /**
   * Conteúdo EXATO de um bloco `@media`, delimitado por casamento de chaves.
   *
   * S3 — a versão anterior fatiava do início do bloco até o fim do arquivo,
   * então "está no mobile" também aceitava uma regra escrita no bloco de
   * 640px. O cabeçalho é casado por expressão regular tolerante a espaço,
   * para o teste não quebrar com uma reformatação do Prettier.
   */
  function blocoDeMedia(largura: number): string {
    const cabecalho = new RegExp(
      `@media\\s*\\(\\s*max-width:\\s*${largura}px\\s*\\)\\s*\\{`,
    );
    const encontrado = cabecalho.exec(css);
    if (!encontrado) throw new Error(`bloco @media ${largura}px não existe`);

    const abre = encontrado.index + encontrado[0].length - 1;
    let profundidade = 0;
    for (let i = abre; i < css.length; i += 1) {
      if (css[i] === "{") profundidade += 1;
      else if (css[i] === "}") {
        profundidade -= 1;
        if (profundidade === 0) return css.slice(abre + 1, i);
      }
    }
    throw new Error(`bloco @media ${largura}px não fecha`);
  }

  const mobile = blocoDeMedia(834);
  const estreito = blocoDeMedia(640);
  /** Tudo o que NÃO está dentro do bloco do modo gaveta. */
  const foraDoMobile = css.replace(mobile, "");

  it("o extrator de bloco realmente delimita — e não varre o arquivo inteiro", () => {
    // Sem esta verificação, um extrator quebrado faria as asserções abaixo
    // passarem por acidente.
    expect(mobile.length).toBeGreaterThan(0);
    expect(mobile.length).toBeLessThan(css.length);
    expect(mobile).not.toContain("@media");
    expect(mobile).not.toContain(".app-shell__footer-inner");
    expect(estreito).toContain(".app-shell__footer-inner");
    expect(mobile).not.toContain(estreito);
  });

  it("abaixo de 835px a barra sai do fluxo e só aparece aberta", () => {
    expect(mobile).toMatch(/\.app-shell__sidebar\s*\{[^}]*display:\s*none/);
    expect(mobile).toMatch(
      /\.app-shell--gaveta-aberta\s+\.app-shell__sidebar\s*\{[^}]*display:\s*flex/,
    );
  });

  it("o botão da gaveta só aparece no mobile", () => {
    expect(foraDoMobile).toMatch(/\.app-shell__menu\s*\{[^}]*display:\s*none/);
    expect(mobile).toMatch(
      /\.app-shell__menu[^{]*\{[^}]*display:\s*inline-flex/,
    );
  });

  it("nenhum deslocamento lateral por transform — origem clássica de rolagem horizontal", () => {
    expect(css).not.toMatch(/translateX/);
    expect(css).not.toMatch(/translate3d/);
  });

  it("a gaveta nunca passa da largura da tela", () => {
    expect(mobile).toMatch(/width:\s*min\(\s*300px\s*,\s*86vw\s*\)/);
  });

  it("R1 — o scrim existe SÓ dentro do bloco do modo gaveta", () => {
    // Segunda barreira, independente do JavaScript: mesmo que a classe de
    // estado móvel sobrevivesse por qualquer caminho, não haveria overlay de
    // página inteira no desktop.
    const regra = /\.app-shell__fundo-gaveta\s*\{/g;
    expect(css.match(regra) ?? []).toHaveLength(1);
    expect(mobile).toMatch(regra);
    // E em lugar nenhum fora dele — nem no bloco de 640px, nem no topo.
    expect(foraDoMobile).not.toMatch(/\.app-shell__fundo-gaveta/);
  });
});

/**
 * T162 — `destinoInicial` é a entrada vinda do Hub, e esta é a fronteira do
 * componente.
 *
 * O Hub só oferece o que o papel abre. Isto aqui prova que, mesmo se ele
 * oferecesse errado — por regressão, por estado antigo, por id inventado —, o
 * shell não montaria a tela que responderia 403: ele cai na aterrissagem do
 * papel, que a T153 já fixou. Fail-closed nos dois lados, não só na origem.
 */
describe("T162 — entrada vinda do Hub é validada no shell", () => {
  it("destino funcional permitido ao papel é respeitado", () => {
    render(<App papelDoAtor="rh" destinoInicial="cadastros" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Estrutura organizacional",
    );
  });

  it("T182 — dp entra em Jornadas de trabalho, só para consultar", () => {
    render(<App papelDoAtor="dp" destinoInicial="jornadas-trabalho" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Jornadas de trabalho",
    );
    expect(screen.getByText("Somente consulta")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nova jornada" }),
    ).not.toBeInTheDocument();
  });

  it("T182 — dp entra em Estrutura só para consultar: nenhum controle de escrita", () => {
    render(<App papelDoAtor="dp" destinoInicial="cadastros" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Estrutura organizacional",
    );
    expect(screen.getByText("Somente consulta")).toBeInTheDocument();
    const main = screen.getByRole("main");
    for (const aba of ["Funções e cargos", "Centros de custo"]) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
      expect(within(main).getByText("Somente consulta")).toBeInTheDocument();
    }
    expect(
      within(main)
        .queryAllByRole("button")
        .filter((b) =>
          /^(Nova|Novo|Editar|Inativar|Reativar)\b/.test(
            b.textContent?.trim() ?? "",
          ),
        ),
    ).toEqual([]);
  });

  it("T182 — rh segue com a criação em Estrutura", () => {
    render(<App papelDoAtor="rh" destinoInicial="cadastros" />);
    expect(
      screen.getByRole("button", { name: "Nova unidade" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Somente consulta")).toBeNull();
  });

  it("destino funcional NÃO concedido ao papel cai na aterrissagem do papel", () => {
    // `financeiro` não lê `tabela_horario` (T182: só RH, DP e
    // `master_tecnico`). Montar ali seria 403.
    render(<App papelDoAtor="financeiro" destinoInicial="jornadas-trabalho" />);
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(
      "Jornadas de trabalho",
    );
  });

  it("destino de liderança não cai no colo de quem não o tem", () => {
    render(<App papelDoAtor="dp" destinoInicial="administracao-lideranca" />);
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(
      "Administração da liderança",
    );
  });

  it("id inexistente cai na aterrissagem do papel, sem quebrar", () => {
    render(<App papelDoAtor="gestor" destinoInicial="nao-existe" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Minha equipe",
    );
  });

  it("destino demonstrativo é aceito de qualquer papel — não chama a API", () => {
    render(<App papelDoAtor="colaborador" destinoInicial="relatorios" />);
    // O h1 é o da aba padrão do destino, e o destino ativo é Relatórios.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Exceções de Ponto",
    );
    // T211 — fora do menu: nenhum item marcado.
    expect(screen.queryByRole("button", { name: /^Relatórios/ })).toBeNull();
  });

  it("sem `destinoInicial`, nada muda em relação à T153", () => {
    render(<App papelDoAtor="gestor" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Minha equipe",
    );
  });

  it("T209 — não há botão 'Hub', nem com quem monte o shell oferecendo a volta", () => {
    const voltar = vi.fn();
    render(<App papelDoAtor="rh" onVoltarAoHub={voltar} onLogout={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Hub" })).toBeNull();
    expect(voltar).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T189 — empresa ativa no topo do menu lateral.
// ---------------------------------------------------------------------------

describe("T189 — empresa ativa no topo do menu lateral", () => {
  const ALFA = {
    id: "empresa-sintetica-alfa",
    codigo: "ALFA",
    nome: "Empresa Alfa",
  };
  const BETA = {
    id: "empresa-sintetica-beta",
    codigo: "BETA",
    nome: "Empresa Beta",
  };

  beforeEach(() => {
    vi.mocked(listarEmpresasDoContexto).mockReset();
    vi.mocked(trocarEmpresaDoContexto).mockReset();
    vi.mocked(listarEmpresasDoContexto).mockResolvedValue([ALFA, BETA]);
    vi.mocked(trocarEmpresaDoContexto).mockResolvedValue(BETA);
  });

  afterEach(() => {
    redefinirLarguraDaJanela();
  });

  it("fica logo abaixo da marca Evolli, antes da navegação", async () => {
    render(
      <App
        papelDoAtor="rh"
        onLogout={() => undefined}
        empresaAtiva={ALFA}
        podeTrocarEmpresa
      />,
    );
    await screen.findByRole("button", { name: /Empresa ativa/ });
    const barra = document.getElementById("navegacao-lateral")!;
    const filhos = [...barra.children].map((f) => f.className);
    const seletor = filhos.findIndex((c) => c.includes("seletor-empresa"));
    const navegacao = [...barra.children].findIndex(
      (f) => f.querySelector("nav") !== null || f.tagName === "NAV",
    );
    // T206/T209 — a marca divide o topo da faixa com o botão de recolher.
    const marca = [...barra.children].findIndex(
      (f) => f.querySelector(".app-shell__marca") !== null,
    );
    expect(marca).toBe(0);
    expect(seletor).toBe(1);
    expect(navegacao).toBeGreaterThan(seletor);
  });

  it("sem sessão (sem onLogout) não há seletor nem leitura de empresas", () => {
    render(<App papelDoAtor="rh" empresaAtiva={ALFA} podeTrocarEmpresa />);
    expect(document.querySelector(".seletor-empresa")).toBeNull();
    expect(listarEmpresasDoContexto).not.toHaveBeenCalled();
  });

  it("perfil sem troca: só leitura no menu, sem pedir a lista", () => {
    render(
      <App papelDoAtor="dp" onLogout={() => undefined} empresaAtiva={ALFA} />,
    );
    const leitura = document.querySelector(
      "#navegacao-lateral .seletor-empresa__leitura",
    );
    expect(leitura).toHaveTextContent("Empresa Alfa");
    expect(leitura).toHaveTextContent("Código ALFA");
    expect(screen.queryByRole("button", { name: /Empresa ativa/ })).toBeNull();
    expect(listarEmpresasDoContexto).not.toHaveBeenCalled();
  });

  it("a troca confirmada sobe para quem monta o shell, com a empresa do servidor", async () => {
    const onEmpresaTrocada = vi.fn();
    render(
      <App
        papelDoAtor="rh"
        onLogout={() => undefined}
        empresaAtiva={ALFA}
        podeTrocarEmpresa
        onEmpresaTrocada={onEmpresaTrocada}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Empresa ativa/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /^Empresa Beta/ }),
    );
    await vi.waitFor(() => expect(onEmpresaTrocada).toHaveBeenCalledWith(BETA));
  });

  it("informa o destino exibido, na montagem e a cada navegação", () => {
    const onDestinoAlterado = vi.fn();
    render(
      <App
        papelDoAtor="rh"
        onLogout={() => undefined}
        destinoInicial="pessoas"
        onDestinoAlterado={onDestinoAlterado}
      />,
    );
    expect(onDestinoAlterado).toHaveBeenLastCalledWith("pessoas");
    fireEvent.click(screen.getByRole("button", { name: /^Organograma/ }));
    expect(onDestinoAlterado).toHaveBeenLastCalledWith("cadastros");
  });

  it("com o pedido de foco, o título da tela de destino recebe o foco ao montar", () => {
    render(
      <App
        papelDoAtor="rh"
        onLogout={() => undefined}
        destinoInicial="pessoas"
        focarTituloAoAbrir
      />,
    );
    expect(document.activeElement?.id).toBe("colaboradores-titulo");
  });

  it("sem o pedido de foco, a montagem não mexe no foco", () => {
    render(
      <App
        papelDoAtor="rh"
        onLogout={() => undefined}
        destinoInicial="pessoas"
      />,
    );
    expect(document.activeElement?.id).not.toBe("colaboradores-titulo");
  });

  it("375 px: o seletor está dentro da gaveta, a lista abre nela, e Esc fecha a lista sem fechar a gaveta", async () => {
    act(() => definirLarguraDaJanela(375));
    render(
      <App
        papelDoAtor="rh"
        onLogout={() => undefined}
        empresaAtiva={ALFA}
        podeTrocarEmpresa
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const gaveta = document.getElementById("navegacao-lateral")!;
    const botao = await within(gaveta).findByRole("button", {
      name: /Empresa ativa/,
    });
    fireEvent.click(botao);
    const lista = await within(gaveta).findByRole("list", {
      name: "Empresas da conta",
    });
    expect(gaveta.contains(lista)).toBe(true);
    expect(gaveta.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(botao);
    // A gaveta continua aberta: o Esc era do painel.
    expect(
      screen.getByRole("button", { name: "Menu", hidden: true }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
