/**
 * Navegação do painel (T044, reorganizada na T159).
 *
 * O que estes testes prendem:
 *
 *  - **menu não promete capacidade que não existe**: todo destino do grupo
 *    Demonstração é declarado `demonstrativo`, e o grupo se identifica como
 *    tal para quem usa leitor de tela;
 *  - **o estado declarado bate com o código**: uma tela demonstrativa que
 *    passasse a falar com a API — ou o contrário — quebra o teste antes de o
 *    menu mentir. É a asserção mais importante do arquivo, porque é a única
 *    que impede o mapa de envelhecer em silêncio;
 *  - **visibilidade por capacidade**: destino com `papeis` só aparece para
 *    quem o servidor atende; sem papel conhecido, não aparece;
 *  - semântica de item ativo, grupos, teclado e `onSelecionar`.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PainelNavigation } from "./PainelNavigation";
import {
  DESTINOS,
  GRUPOS,
  PAPEIS_ADMINISTRACAO_LIDERANCA,
  PAPEIS_MINHA_EQUIPE,
  destinoInicialPara,
  destinoPorId,
  destinoVisivelPara,
} from "./mapaNavegacao";

function navegacao() {
  return screen.getByRole("navigation", { name: "Navegação do painel" });
}

/**
 * Botões que levam a um destino — exclui o cabeçalho do módulo expansível,
 * que abre e fecha o submenu em vez de navegar.
 */
function botoesDeDestino(): HTMLElement[] {
  return [...navegacao().querySelectorAll<HTMLElement>("button")].filter(
    (botao) => !botao.hasAttribute("aria-expanded"),
  );
}

describe("estrutura dos grupos", () => {
  it("os cinco módulos operacionais vêm antes de Demonstração", () => {
    expect(GRUPOS.map((g) => g.titulo)).toEqual([
      "Pessoas",
      "Estrutura",
      "Jornada",
      "Liderança",
      "Administração",
      "Demonstração",
    ]);
  });

  it("só Demonstração tem descrição, e ela diz que nada ali grava", () => {
    const comDescricao = GRUPOS.filter((g) => g.descricao);
    expect(comDescricao).toHaveLength(1);
    expect(comDescricao[0]!.titulo).toBe("Demonstração");
    expect(comDescricao[0]!.descricao).toMatch(/Nada aqui grava/);
  });

  it("nenhum destino funcional está em Demonstração, e vice-versa", () => {
    const demo = GRUPOS.find((g) => g.titulo === "Demonstração")!;
    expect(demo.destinos.every((d) => d.estado === "demonstrativo")).toBe(true);
    for (const grupo of GRUPOS.filter((g) => g.titulo !== "Demonstração")) {
      expect(grupo.destinos.every((d) => d.estado === "funcional")).toBe(true);
    }
  });

  it("o grupo Demonstração é descrito para leitor de tela", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    const lista = navegacao().querySelector(
      'ul[aria-labelledby="nav-grupo-Demonstração"]',
    )!;
    const descricaoId = lista.getAttribute("aria-describedby")!;
    expect(document.getElementById(descricaoId)!.textContent).toMatch(
      /Nada aqui grava/,
    );
  });
});

describe("o estado declarado bate com o código", () => {
  /**
   * Fonte da verdade: a tela importa um cliente de `src/api/`? Se importa,
   * fala com o servidor e é funcional. Se não, é maquete.
   */
  function usaApi(caminho: string): boolean {
    return /from "\.\.\/\.\.\/api\//.test(readFileSync(caminho, "utf8"));
  }

  /** Tela que cada destino abre por padrão. */
  const TELA_PADRAO: Readonly<Record<string, string>> = {
    pessoas: "src/screens/pessoas/ColaboradoresScreen.tsx",
    cadastros: "src/screens/horarios/CadastroHorariosScreen.tsx",
    ponto: "src/screens/ponto/VisaoPeriodoScreen.tsx",
    equipe: "src/screens/equipe/EquipeScreen.tsx",
    "administracao-lideranca":
      "src/screens/administracao/AdministracaoLiderancaScreen.tsx",
    "contas-acesso": "src/screens/administracao/ContasAcessoScreen.tsx",
    inicio: "src/screens/inicio/InicioVisaoGeralScreen.tsx",
    "pessoas-demonstracao": "src/screens/pessoas/BeneficiosScreen.tsx",
    "cadastros-demonstracao":
      "src/screens/horarios/CalendarioFeriadosScreen.tsx",
    "ponto-demonstracao": "src/screens/ponto/VerificarFolhasScreen.tsx",
    documentos: "src/screens/documentos/DocumentosMetadadosScreen.tsx",
    "solicitacoes-rh":
      "src/screens/solicitacoes-rh/CentralSolicitacoesRHScreen.tsx",
    relatorios: "src/screens/relatorios/ExcecoesPontoScreen.tsx",
    "portal-colaborador":
      "src/screens/portal-colaborador/VisaoGeralPortalScreen.tsx",
  };

  it("cobre todos os destinos do mapa", () => {
    expect(Object.keys(TELA_PADRAO).sort()).toEqual(
      DESTINOS.map((d) => d.id).sort(),
    );
  });

  for (const destino of DESTINOS) {
    it(`${destino.id}: declarado ${destino.estado} e a tela confirma`, () => {
      expect(usaApi(TELA_PADRAO[destino.id]!)).toBe(
        destino.estado === "funcional",
      );
    });
  }

  it("`inicio` não chama nada — por isso serve de aterrissagem segura", () => {
    expect(usaApi("src/screens/inicio/InicioVisaoGeralScreen.tsx")).toBe(false);
    expect(destinoInicialPara("colaborador")).toBe("inicio");
  });
});

describe("visibilidade por capacidade", () => {
  it("sem papel conhecido, os condicionados não aparecem", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: /Minha equipe/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Administração da liderança/ }),
    ).toBeNull();
    // Grupo que ficou vazio não vira cabeçalho órfão.
    expect(screen.queryByText("Liderança")).toBeNull();
  });

  it("gestor vê Minha equipe e não vê a administração dela", () => {
    render(
      <PainelNavigation
        destinoAtivoId="equipe"
        onSelecionar={() => {}}
        papel="gestor"
      />,
    );
    expect(
      screen.getByRole("button", { name: /Minha equipe/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Administração da liderança/ }),
    ).toBeNull();
  });

  it("rh vê os dois destinos de Liderança", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    expect(
      screen.getByRole("button", { name: /Minha equipe/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Administração da liderança/ }),
    ).toBeInTheDocument();
  });

  it("dp não vê nenhum destino de Liderança", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="dp"
      />,
    );
    expect(screen.queryByText("Liderança")).toBeNull();
  });

  it("as listas de papéis espelham o que o servidor concede", () => {
    expect(PAPEIS_MINHA_EQUIPE).toEqual(["gestor", "rh"]);
    expect(PAPEIS_ADMINISTRACAO_LIDERANCA).toEqual(["rh"]);
    expect(destinoVisivelPara(destinoPorId("equipe")!, "dp")).toBe(false);
    expect(destinoVisivelPara(destinoPorId("pessoas")!, null)).toBe(true);
  });
});

describe("destinos preservados", () => {
  it("rh continua alcançando todos os destinos funcionais", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    for (const rotulo of [
      "Pessoas",
      "Estrutura",
      "Jornada",
      "Minha equipe",
      "Administração da liderança",
      "Contas de acesso",
    ]) {
      expect(
        screen.getAllByRole("button", { name: new RegExp(rotulo) }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("os demonstrativos continuam alcançáveis, agrupados e nomeados", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    const lista = navegacao().querySelector(
      'ul[aria-labelledby="nav-grupo-Demonstração"]',
    )! as HTMLElement;
    expect(within(lista).getAllByRole("button")).toHaveLength(8);
  });

  it("com papel que permite tudo, nenhum destino do mapa some", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    // Conta DESTINOS, não `<li>`: desde a evolução visual da T159 o módulo
    // com submenu tem um `<li>` próprio além do de cada destino, e contar
    // marcação faria o teste falhar por motivo errado.
    expect(botoesDeDestino()).toHaveLength(DESTINOS.length);
  });
});

describe("semântica de item ativo, seleção e teclado", () => {
  it("marca somente o destino ativo com aria-current='page'", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /^Pessoas/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: /^Relatórios/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("chama onSelecionar com o id do destino clicado", () => {
    const onSelecionar = vi.fn();
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={onSelecionar} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Jornada/ }));
    expect(onSelecionar).toHaveBeenCalledWith("ponto");
  });

  it("os sub-rótulos situam o destino sem repetir o grupo", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    expect(
      screen.getByRole("button", { name: /Pessoas.*Colaboradores/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Jornada.*Visão do período/ }),
    ).toBeInTheDocument();
  });

  it("todo botão é alcançável por teclado e tem nome", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    for (const botao of screen.getAllByRole("button")) {
      expect(botao.getAttribute("tabindex")).not.toBe("-1");
      expect(botao.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("aterrissagem por papel", () => {
  it("gestor entra direto em Minha equipe", () => {
    expect(destinoInicialPara("gestor")).toBe("equipe");
  });

  it("quem opera pessoas entra em Pessoas", () => {
    expect(destinoInicialPara("rh")).toBe("pessoas");
    expect(destinoInicialPara("dp")).toBe("pessoas");
    expect(destinoInicialPara("master_tecnico")).toBe("pessoas");
  });

  it("quem não tem capacidade funcional entra onde nada é chamado", () => {
    // `financeiro` lê centro de custo, que é aba de Estrutura — mas não a aba
    // padrão. Mandá-lo para lá produziria 403 antes de trocar de aba.
    for (const papel of [
      "financeiro",
      "colaborador",
      "auditor",
      "dpo",
      "admin_tecnico",
      null,
    ]) {
      expect(destinoInicialPara(papel)).toBe("inicio");
    }
  });

  it("nenhum papel aterrissa num destino fora do mapa", () => {
    for (const papel of [
      "rh",
      "dp",
      "gestor",
      "financeiro",
      "colaborador",
      "master_tecnico",
      "auditor",
      "dpo",
      "admin_tecnico",
      null,
    ]) {
      expect(destinoPorId(destinoInicialPara(papel))).toBeDefined();
    }
  });
});

describe("módulo, submenu e destino ativo (T159 — evolução visual)", () => {
  it("módulo de um destino só É o destino: nenhum clique sem informação", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const pessoas = screen.getByRole("button", { name: /^Pessoas/ });
    expect(pessoas).not.toHaveAttribute("aria-expanded");
    expect(pessoas).toHaveAttribute("aria-current", "page");
  });

  it("módulo com mais de um destino é um disclosure que controla o seu submenu", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const lideranca = screen.getByRole("button", { name: "Liderança" });
    expect(lideranca).toHaveAttribute("aria-expanded", "true");

    const lista = document.getElementById(
      lideranca.getAttribute("aria-controls")!,
    )!;
    expect(lista.getAttribute("aria-labelledby")).toBe(lideranca.id);
    expect(
      within(lista as HTMLElement)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      "Minha equipe Consulta do gestor",
      "Administração da liderança Vínculos e equipes",
    ]);
  });

  it("fechar o módulo tira os destinos da árvore de acessibilidade e da tabulação", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const lideranca = screen.getByRole("button", { name: "Liderança" });
    fireEvent.click(lideranca);

    expect(lideranca).toHaveAttribute("aria-expanded", "false");
    // `hidden` no <ul> é o que remove de uma vez a árvore e a ordem de
    // tabulação — esconder só por CSS deixaria os botões alcançáveis.
    expect(screen.queryByRole("button", { name: /Minha equipe/ })).toBeNull();
    expect(
      document.getElementById(lideranca.getAttribute("aria-controls")!),
    ).toHaveAttribute("hidden");
  });

  it("módulo fechado que contém o ativo mantém a seleção visível no cabeçalho", () => {
    // Senão a seleção some da tela e quem navega perde a referência.
    render(
      <PainelNavigation
        destinoAtivoId="equipe"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const lideranca = screen.getByRole("button", { name: "Liderança" });
    fireEvent.click(lideranca);
    expect(lideranca).toHaveClass("painel-nav__cabecalho--contem-ativo");
  });

  it("o destino ativo não depende só de cor: semântica, peso e forma juntos", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const pessoas = screen.getByRole("button", { name: /^Pessoas/ });
    // `aria-current` (semântica) + a classe que soma superfície, peso de
    // fonte e barra indicadora (ver PainelNavigation.css).
    expect(pessoas).toHaveAttribute("aria-current", "page");
    expect(pessoas).toHaveClass("painel-nav__destino--ativo");
    for (const outro of botoesDeDestino().filter((b) => b !== pessoas)) {
      expect(outro).not.toHaveClass("painel-nav__destino--ativo");
      expect(outro).not.toHaveAttribute("aria-current");
    }
  });

  it("cada módulo tem ícone próprio, e o ícone nunca é o nome acessível", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const icones = navegacao().querySelectorAll("svg.painel-nav__icone");
    expect(icones.length).toBe(GRUPOS.length);
    for (const icone of icones) {
      expect(icone).toHaveAttribute("aria-hidden", "true");
      expect(icone).toHaveAttribute("focusable", "false");
    }
  });
});

describe("Demonstração é separada e secundária (T159 — evolução visual)", () => {
  function listasDeModulo() {
    return [
      ...navegacao().querySelectorAll<HTMLElement>("ul.painel-nav__modulos"),
    ];
  }

  it("fica numa lista própria, depois de todos os módulos operacionais", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const listas = listasDeModulo();
    expect(listas).toHaveLength(2);

    const operacionais = listas[0]!;
    const secundaria = listas[1]!;
    expect(secundaria).toHaveClass("painel-nav__modulos--secundario");
    // Ordem no documento: a lista secundária vem depois.
    expect(
      operacionais.compareDocumentPosition(secundaria) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(
      within(secundaria).getByRole("button", { name: "Demonstração" }),
    ).toBeInTheDocument();
  });

  it("nenhum destino demonstrativo aparece entre os módulos operacionais", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const operacionais = listasDeModulo()[0]!;
    for (const destino of DESTINOS.filter(
      (d) => d.estado === "demonstrativo",
    )) {
      expect(
        within(operacionais).queryByRole("button", {
          name: new RegExp(`^${destino.label}`),
        }),
      ).toBeNull();
    }
  });

  it("o aviso é texto, fica antes da lista e é lido junto com ela", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    const cabecalho = screen.getByRole("button", { name: "Demonstração" });
    const lista = document.getElementById(
      cabecalho.getAttribute("aria-controls")!,
    )!;
    const aviso = document.getElementById(
      lista.getAttribute("aria-describedby")!,
    )!;
    expect(aviso.textContent).toMatch(
      /Nada aqui grava, consulta o servidor ou representa capacidade disponível/,
    );
    expect(
      aviso.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
