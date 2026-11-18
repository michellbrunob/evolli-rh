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
import { fireEvent, screen, within } from "@testing-library/react";
import { renderComMenuAberto as render } from "../test/menuLateral";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PainelNavigation } from "./PainelNavigation";
import { MENU_LATERAL } from "./menuLateral";
import {
  DESTINOS,
  GRUPOS,
  PAPEIS_ADMINISTRACAO_LIDERANCA,
  PAPEIS_MINHA_EQUIPE,
  destinoInicialPara,
  destinoPorId,
  destinoVisivelPara,
  itemDaBarraPara,
  tituloDoGrupoDe,
} from "./mapaNavegacao";

function navegacao() {
  return screen.getByRole("navigation", { name: "Navegação do painel" });
}

/**
 * Botões que levam a um destino — exclui o cabeçalho do módulo expansível,
 * que abre e fecha o submenu em vez de navegar.
 */
function botoesDeDestino(): HTMLElement[] {
  // T209 — itens em desenvolvimento (`aria-disabled`) não são destinos.
  return [...navegacao().querySelectorAll<HTMLElement>("button")].filter(
    (botao) =>
      !botao.hasAttribute("aria-expanded") &&
      !botao.hasAttribute("aria-disabled"),
  );
}

describe("estrutura dos grupos", () => {
  // T205 — o Dashboard vem antes de todos (D-9).
  // T211 — Estrutura entrou em Gestão de Pessoas; Administração (Contas de
  // acesso) entrou em Configurações.
  it("o Dashboard e os módulos operacionais, depois Configurações (T208), vêm antes de Demonstração", () => {
    expect(GRUPOS.map((g) => g.titulo)).toEqual([
      "Dashboard",
      "Gestão de Pessoas",
      "Jornada",
      "Liderança",
      "Configurações",
      "Demonstração",
    ]);
  });

  it("T208 — só Configurações é grupo da conta; T209: Empresas e Nova empresa como sub-páginas", () => {
    const daConta = GRUPOS.filter((g) => g.daConta);
    expect(daConta.map((g) => g.titulo)).toEqual(["Configurações"]);
    expect(daConta[0]!.secundario).toBeFalsy();
    expect(
      daConta[0]!.destinos.map((d) => [
        d.id,
        d.label,
        d.estado,
        d.papeis,
        d.agrupadoEm,
      ]),
    ).toEqual([
      ["configuracoes", "Configurações", "funcional", undefined, undefined],
      [
        "configuracoes-aparencia",
        "Aparência",
        "funcional",
        undefined,
        "configuracoes",
      ],
      [
        "configuracoes-empresas",
        "Empresas",
        "funcional",
        ["rh", "dp", "master_tecnico"],
        "configuracoes",
      ],
      // T211 — Contas de acesso como Equipe e permissões.
      [
        "contas-acesso",
        "Equipe e permissões",
        "funcional",
        undefined,
        "configuracoes",
      ],
      [
        "nova-empresa",
        "Nova empresa",
        "funcional",
        ["rh", "master_tecnico"],
        "configuracoes-empresas",
      ],
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

  it("T211 — o grupo Demonstração fica fora do menu (as telas seguem no mapa)", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    expect(
      navegacao().querySelector('ul[aria-labelledby="nav-grupo-Demonstração"]'),
    ).toBeNull();
    expect(GRUPOS.some((g) => g.titulo === "Demonstração")).toBe(true);
  });
});

describe("o estado declarado bate com o código", () => {
  /**
   * Fonte da verdade: a tela importa um cliente de `src/api/`? Se importa,
   * fala com o servidor e é funcional. Se não, é maquete.
   */
  function usaApi(caminho: string): boolean {
    // T209 — telas em subpasta (`pessoas/importacao/`) sobem um nível a mais.
    return /from "(?:\.\.\/)+api\//.test(readFileSync(caminho, "utf8"));
  }

  /** Tela que cada destino abre por padrão. */
  const TELA_PADRAO: Readonly<Record<string, string>> = {
    // T205 — o Dashboard lê colaboradores e movimentações: funcional.
    dashboard: "src/screens/dashboard/DashboardScreen.tsx",
    // T208 — Meu perfil mostra o que `GET /v1/users/me` trouxe na sessão:
    // depende do contrato e dos rótulos de `usersClient`, sem requisição
    // própria. Funcional: dado real do servidor, não fixture.
    configuracoes: "src/screens/configuracoes/MeuPerfilScreen.tsx",
    // T210 — Configurações › Aparência.
    "configuracoes-aparencia": "src/screens/configuracoes/AparenciaScreen.tsx",
    // T209 — Configurações › Empresas e Nova empresa.
    "configuracoes-empresas": "src/screens/configuracoes/EmpresasScreen.tsx",
    "nova-empresa": "src/screens/configuracoes/NovaEmpresaScreen.tsx",
    pessoas: "src/screens/pessoas/ColaboradoresScreen.tsx",
    "nova-admissao": "src/screens/pessoas/NovaAdmissaoScreen.tsx",
    "importar-colaboradores":
      "src/screens/pessoas/importacao/ImportarColaboradoresScreen.tsx",
    cadastros: "src/screens/horarios/EstruturaOrganizacionalScreen.tsx",
    "jornadas-trabalho": "src/screens/horarios/JornadasTrabalhoScreen.tsx",
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

  it("gestor vê Minha equipe (o item Liderança, T211) e não vê a administração dela", () => {
    render(
      <PainelNavigation
        destinoAtivoId="equipe"
        onSelecionar={() => {}}
        papel="gestor"
      />,
    );
    expect(
      screen.getByRole("button", { name: /^Liderança/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Administração da liderança/ }),
    ).toBeNull();
  });

  it("T211 — rh vê Liderança (Minha equipe); a Administração da liderança fica fora do menu", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    expect(
      screen.getByRole("button", { name: /^Liderança/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Administração da liderança/ }),
    ).toBeNull();
    expect(destinoPorId("administracao-lideranca")?.foraDoMenu).toBe(true);
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
  // T211 — Ponto e Administração da liderança saem do menu (URL própria);
  // Contas de acesso vai para Configurações (Equipe e permissões).
  it("rh alcança pelo menu Colaboradores, Escala de trabalho, Organograma e Liderança", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    for (const rotulo of [
      "Colaboradores",
      "Escala de trabalho",
      "Organograma",
      "Liderança",
    ]) {
      expect(
        screen.getAllByRole("button", { name: new RegExp(rotulo) }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("T211 — os demonstrativos continuam no mapa, fora do menu", () => {
    const demo = GRUPOS.find((g) => g.titulo === "Demonstração")!;
    expect(demo.destinos).toHaveLength(8);
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    for (const d of demo.destinos) {
      expect(
        within(navegacao()).queryByRole("button", {
          name: new RegExp(`^${d.label}\b`),
        }),
        d.id,
      ).toBeNull();
    }
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
    // T178 — sub-página (`agrupadoEm`, Nova admissão) não é item da barra.
    // T211 — nem o que está fora do menu: `foraDoMenu`, os grupos Jornada
    // (Ponto) e Demonstração.
    const foraDoMenu = new Set(["Jornada", "Demonstração"]);
    expect(botoesDeDestino()).toHaveLength(
      GRUPOS.filter((g) => !foraDoMenu.has(g.titulo))
        .flatMap((g) => g.destinos)
        .filter((d) => !d.agrupadoEm && !d.foraDoMenu).length,
    );
  });
});

describe("semântica de item ativo, seleção e teclado", () => {
  it("marca somente o destino ativo com aria-current='page'", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    expect(
      screen.getByRole("button", { name: /^Colaboradores Consulta/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: /^Organograma/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("chama onSelecionar com o id do destino clicado", () => {
    const onSelecionar = vi.fn();
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={onSelecionar} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Organograma/ }));
    expect(onSelecionar).toHaveBeenCalledWith("cadastros");
  });

  it("os sub-rótulos situam o destino sem repetir o grupo", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    expect(
      screen.getByRole("button", {
        name: /Colaboradores.*Consulta, ficha e vida funcional/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Organograma.*Unidades, cargos e centros de custo/,
      }),
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
    // T211 — Liderança mostra só Minha equipe (a administração está fora do
    // menu): o item é o destino, com o nome do módulo.
    render(
      <PainelNavigation
        destinoAtivoId="equipe"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const lideranca = screen.getByRole("button", { name: /^Liderança/ });
    expect(lideranca).not.toHaveAttribute("aria-expanded");
    expect(lideranca).toHaveAttribute("aria-current", "page");
  });

  it.each(["rh", "dp", "master_tecnico"])(
    "T211 — %s vê Escala de trabalho e Organograma dentro de Colaboradores",
    (papel) => {
      render(
        <PainelNavigation
          destinoAtivoId="jornadas-trabalho"
          onSelecionar={() => {}}
          papel={papel}
        />,
      );
      const modulo = screen.getByRole("button", { name: "Colaboradores" });
      expect(modulo).toHaveAttribute("aria-expanded", "true");
      expect(
        screen.getByRole("button", { name: /^Organograma/ }),
      ).not.toHaveAttribute("aria-current");
      expect(
        screen.getByRole("button", { name: /^Escala de trabalho/ }),
      ).toHaveAttribute("aria-current", "page");
    },
  );

  it.each(["gestor", "financeiro", "colaborador", null])(
    "T182 — %s não vê Escala de trabalho",
    (papel) => {
      render(
        <PainelNavigation
          destinoAtivoId="inicio"
          onSelecionar={() => {}}
          papel={papel}
        />,
      );
      expect(
        screen.queryByRole("button", { name: /^Escala de trabalho/ }),
      ).toBeNull();
    },
  );

  it.each(["rh", "dp", "master_tecnico"])(
    "T178/T211 — %s vê o módulo Colaboradores com os destinos dele e sem item próprio de Nova admissão",
    (papel) => {
      render(
        <PainelNavigation
          destinoAtivoId="pessoas"
          onSelecionar={() => {}}
          papel={papel}
        />,
      );
      // Cabeçalho próprio (`sempreComoModulo`): o nome do módulo não some, e
      // é o mesmo da trilha de navegação.
      const modulo = screen.getByRole("button", { name: "Colaboradores" });
      expect(modulo).toHaveAttribute("aria-expanded", "true");
      const regiao = document.getElementById(
        modulo.getAttribute("aria-controls")!,
      )!;
      // `aria-labelledby` aponta para UM id: o título com espaços virou hífens.
      expect(regiao.querySelector("ul")!.getAttribute("aria-labelledby")).toBe(
        modulo.id,
      );
      expect(modulo.id).not.toMatch(/\s/);
      expect(
        within(regiao as HTMLElement)
          .getAllByRole("button")
          .map((b) => b.textContent),
      ).toEqual([
        "Colaboradores Consulta, ficha e vida funcional",
        "Escala de trabalho Turnos da empresa",
        "Organograma Unidades, cargos e centros de custo",
        // T209 — subitem em desenvolvimento, ao lado dos funcionais.
        "Desenvolvimento Em desenvolvimento",
      ]);
      // Nova admissão é sub-página de Colaboradores: abre pela listagem.
      expect(
        screen.queryByRole("button", { name: /Nova admissão/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("T178 — com a Nova admissão aberta, a barra marca 'Colaboradores' como atual", () => {
    render(
      <PainelNavigation
        destinoAtivoId="nova-admissao"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const colaboradores = screen.getByRole("button", {
      name: "Colaboradores Consulta, ficha e vida funcional",
    });
    expect(colaboradores).toHaveAttribute("aria-current", "page");
    expect(colaboradores).toHaveClass("painel-nav__destino--ativo");
    for (const outro of botoesDeDestino().filter((b) => b !== colaboradores)) {
      expect(outro).not.toHaveAttribute("aria-current");
    }
  });

  it("T178 — `nova-admissao` continua no mapa, como sub-página de `pessoas`", () => {
    const novaAdmissao = destinoPorId("nova-admissao")!;
    expect(novaAdmissao.agrupadoEm).toBe("pessoas");
    expect(novaAdmissao.papeis).toEqual(["rh", "dp"]);
    expect(itemDaBarraPara("nova-admissao")).toBe("pessoas");
    expect(itemDaBarraPara("cadastros")).toBe("cadastros");
    expect(tituloDoGrupoDe("nova-admissao")).toBe("Gestão de Pessoas");
    // T211 — Escala de trabalho e Organograma no mesmo grupo.
    expect(tituloDoGrupoDe("cadastros")).toBe("Gestão de Pessoas");
    expect(tituloDoGrupoDe("jornadas-trabalho")).toBe("Gestão de Pessoas");
  });

  it("módulo com mais de um destino é um disclosure que controla o seu submenu", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const colaboradores = screen.getByRole("button", { name: "Colaboradores" });
    expect(colaboradores).toHaveAttribute("aria-expanded", "true");

    // O cabeçalho controla a REGIÃO recolhível (aviso + lista), não só a
    // lista — ver R4.
    const regiao = document.getElementById(
      colaboradores.getAttribute("aria-controls")!,
    )!;
    const lista = regiao.querySelector("ul")!;
    expect(lista.getAttribute("aria-labelledby")).toBe(colaboradores.id);
  });

  it("fechar o módulo tira os destinos da árvore de acessibilidade e da tabulação", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const colaboradores = screen.getByRole("button", { name: "Colaboradores" });
    fireEvent.click(colaboradores);

    expect(colaboradores).toHaveAttribute("aria-expanded", "false");
    // `hidden` no <ul> é o que remove de uma vez a árvore e a ordem de
    // tabulação — esconder só por CSS deixaria os botões alcançáveis.
    expect(
      screen.queryByRole("button", { name: /^Escala de trabalho/ }),
    ).toBeNull();
    expect(
      document.getElementById(colaboradores.getAttribute("aria-controls")!),
    ).toHaveAttribute("hidden");
  });

  it("módulo fechado que contém o ativo mantém a seleção visível no cabeçalho", () => {
    // Senão a seleção some da tela e quem navega perde a referência.
    render(
      <PainelNavigation
        destinoAtivoId="cadastros"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const colaboradores = screen.getByRole("button", { name: "Colaboradores" });
    fireEvent.click(colaboradores);
    expect(colaboradores).toHaveClass("painel-nav__cabecalho--contem-ativo");
  });

  it("o destino ativo não depende só de cor: semântica, peso e forma juntos", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const pessoas = screen.getByRole("button", {
      name: "Colaboradores Consulta, ficha e vida funcional",
    });
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
    // T209 — um por módulo do menu e um por item em desenvolvimento de
    // primeiro nível (Portal, Recrutamento, Pesquisas, Calendário, Folha,
    // Benefícios, Hub de Benefícios, Suporte e Roadmap). T211 — módulos no
    // menu: Dashboard, Colaboradores, Liderança e Configurações.
    const modulosNoMenu = MENU_LATERAL.flatMap((secao) =>
      secao.entradas.filter((e) => e.tipo === "modulo"),
    ).length;
    expect(modulosNoMenu).toBe(4);
    expect(icones.length).toBe(modulosNoMenu + 9);
    for (const icone of icones) {
      expect(icone).toHaveAttribute("aria-hidden", "true");
      expect(icone).toHaveAttribute("focusable", "false");
    }
  });
});

describe("T211 — sem Demonstração e sem Operação no menu", () => {
  function listasDeModulo() {
    return [
      ...navegacao().querySelectorAll<HTMLElement>("ul.painel-nav__modulos"),
    ];
  }

  it("listas: início, Pessoas, Remuneração e o rodapé com a própria conta", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    const listas = listasDeModulo();
    expect(listas).toHaveLength(4);
    const daConta = listas[3]!;
    expect(daConta).toHaveClass("painel-nav__modulos--conta");
    expect(daConta).toHaveClass("painel-nav__modulos--rodape");
    expect(
      within(daConta).getByRole("button", { name: /^Configurações/ }),
    ).toBeInTheDocument();
    expect(
      navegacao().querySelector(".painel-nav__modulos--secundario"),
    ).toBeNull();
  });

  it("nenhum destino demonstrativo aparece no menu, nem o aviso de Demonstração", () => {
    render(
      <PainelNavigation
        destinoAtivoId="pessoas"
        onSelecionar={() => {}}
        papel="rh"
      />,
    );
    for (const destino of DESTINOS.filter(
      (d) => d.estado === "demonstrativo",
    )) {
      expect(
        within(navegacao()).queryByRole("button", {
          name: new RegExp(`^${destino.label}\\b`),
        }),
        destino.id,
      ).toBeNull();
    }
    expect(navegacao().textContent).not.toMatch(/Nada aqui grava/);
  });
});
