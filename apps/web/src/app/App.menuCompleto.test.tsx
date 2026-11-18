/**
 * T209 — menu lateral completo: seções, ícones, selos, item ativo, rodapé e
 * os recursos ainda inexistentes, que aparecem desabilitados e explicam que
 * estão em desenvolvimento — sem rota, sem link falso, sem trocar de tela.
 *
 * O jsdom não calcula layout nem ativa botão pelo teclado: a ativação por
 * Enter/Espaço de um `<button>` é o mesmo `click` (com `detail: 0`), e é ele
 * que se dispara aqui. Medidas reais ficam para a validação no navegador.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { DESTINOS, GRUPOS } from "./mapaNavegacao";
import {
  MENSAGEM_EM_DESENVOLVIMENTO,
  MENU_LATERAL,
  entradasEmDesenvolvimento,
} from "./menuLateral";
import { rotaDoDestino } from "./rotasDoShell";
import {
  definirLarguraDaJanela,
  redefinirLarguraDaJanela,
} from "../test/viewport";
import { listarEmpresasDoContexto } from "../api/contextoEmpresarialClient";

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

const MENSAGEM =
  "Em desenvolvimento. Esta funcionalidade ainda não está disponível.";

/** Itens indisponíveis de primeiro nível, na ordem do menu. */
const ITENS_EM_DESENVOLVIMENTO = [
  "Portal",
  "Pesquisas",
  "Calendário",
  "Folha de Pagamento",
  "Benefícios",
  "Hub de Benefícios",
  "Suporte",
  "Roadmap",
];

/** Subitens indisponíveis: [cabeçalho que os revela, subitem]. */
const SUBITENS_EM_DESENVOLVIMENTO: ReadonlyArray<readonly [string, string]> = [
  ["Colaboradores", "Desenvolvimento"],
  ["Recrutamento", "Vagas"],
  ["Recrutamento", "Banco de talentos"],
];

const navegacao = () =>
  screen.getByRole("navigation", { name: "Navegação do painel" });

function escapar(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * O botão de um item. Itens em desenvolvimento têm o nome exato "Rótulo
 * [Selo] Em desenvolvimento" (há "Portal do Colaborador" e "Benefícios e
 * dependentes" na Demonstração); os demais, o rótulo seguido do sub-rótulo.
 */
function item(rotulo: string): HTMLElement {
  const emDesenvolvimento = within(navegacao()).queryByRole("button", {
    name: new RegExp(`^${escapar(rotulo)}( (Beta|Novo))? Em desenvolvimento$`),
  });
  if (emDesenvolvimento) return emDesenvolvimento;
  const candidatos = within(navegacao())
    .getAllByRole("button", {
      name: new RegExp(`^${escapar(rotulo)}(\\s|$)`),
    })
    // O cabeçalho de módulo (expansível) não é o destino.
    .filter((b) => !b.hasAttribute("aria-expanded"));
  expect(candidatos).toHaveLength(1);
  return candidatos[0]!;
}

function cabecalho(rotulo: string): HTMLElement {
  return within(navegacao()).getByRole("button", {
    name: rotulo,
    expanded: true,
  });
}

function abrirCabecalho(rotulo: string) {
  const botao = within(navegacao()).getByRole("button", { name: rotulo });
  if (botao.getAttribute("aria-expanded") !== "true") fireEvent.click(botao);
}

const aviso = () =>
  screen.queryByRole("dialog", { name: "Em desenvolvimento" });

function tituloDaTela(): string {
  const id = screen.getByRole("main").getAttribute("aria-labelledby")!;
  return document.getElementById(id)?.textContent ?? "";
}

beforeEach(() => {
  vi.mocked(listarEmpresasDoContexto).mockReset();
  vi.mocked(listarEmpresasDoContexto).mockResolvedValue([]);
  window.history.replaceState(null, "", window.location.pathname);
});

afterEach(() => {
  redefinirLarguraDaJanela();
  window.history.replaceState(null, "", window.location.pathname);
});

describe("T209 — menu completo no desktop (expandido)", () => {
  it("seções nomeadas na ordem pedida e o rodapé com as utilidades", () => {
    render(<App papelDoAtor="rh" />);
    const titulos = [
      ...navegacao().querySelectorAll(".painel-nav__secao-titulo"),
    ].map((t) => t.textContent);
    // T211 — sem a seção Operação.
    expect(titulos).toEqual(["Pessoas", "Remuneração"]);

    // Cada seção é uma lista nomeada pelo próprio título.
    for (const titulo of ["Pessoas", "Remuneração"]) {
      expect(
        within(navegacao()).getByRole("list", { name: titulo }),
      ).toBeInTheDocument();
    }

    const rodape = navegacao().querySelector<HTMLElement>(
      ".painel-nav__modulos--rodape",
    )!;
    expect(
      [...rodape.querySelectorAll(".painel-nav__rotulo")].map(
        (r) => r.firstChild?.textContent,
      ),
    ).toEqual(["Suporte", "Roadmap", "Configurações"]);
    // O rodapé é a última lista da navegação.
    expect(navegacao().lastElementChild).toBe(rodape);
  });

  it("a ordem dos itens de primeiro nível segue a estrutura pedida", () => {
    render(<App papelDoAtor="rh" />);
    const rotulos = [
      ...navegacao().querySelectorAll(
        ".painel-nav__modulo > button .painel-nav__rotulo",
      ),
    ].map((r) => r.firstChild?.textContent);
    const esperado = [
      "Dashboard",
      "Portal",
      "Colaboradores",
      "Recrutamento",
      "Pesquisas",
      "Calendário",
      // T211 — Liderança como item direto de Pessoas.
      "Liderança",
      "Folha de Pagamento",
      "Benefícios",
      "Hub de Benefícios",
    ];
    expect(rotulos.slice(0, esperado.length)).toEqual(esperado);
    expect(rotulos.slice(-3)).toEqual(["Suporte", "Roadmap", "Configurações"]);
  });

  it("T211 — nenhum destino funcional fica sem caminho: menu, Configurações ou URL própria", () => {
    render(<App papelDoAtor="rh" />);
    for (const rotulo of ["Escala de trabalho", "Organograma", "Liderança"]) {
      expect(item(rotulo)).not.toHaveAttribute("aria-disabled");
    }
    // Fora do menu lateral, com URL própria.
    for (const destino of [
      "ponto",
      "administracao-lideranca",
      "contas-acesso",
    ]) {
      expect(rotaDoDestino(destino), destino).not.toBeNull();
    }
  });

  it("selos: Portal com 'Beta' e Hub de Benefícios com 'Novo'", () => {
    render(<App papelDoAtor="rh" />);
    expect(item("Portal").querySelector(".painel-nav__selo")).toHaveTextContent(
      "Beta",
    );
    expect(
      item("Hub de Benefícios").querySelector(".painel-nav__selo"),
    ).toHaveTextContent("Novo");
  });

  it.each(ITENS_EM_DESENVOLVIMENTO)(
    "%s: desabilitado e legível, com o estado em texto e a explicação como descrição",
    (rotulo) => {
      render(<App papelDoAtor="rh" />);
      const botao = item(rotulo);
      expect(botao.tagName).toBe("BUTTON");
      expect(botao).toHaveAttribute("type", "button");
      expect(botao).toHaveAttribute("aria-disabled", "true");
      expect(botao).not.toBeDisabled(); // continua focável e acionável
      expect(botao).toHaveTextContent("Em desenvolvimento");
      expect(botao).toHaveAccessibleDescription(MENSAGEM);
      expect(botao.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    },
  );

  it("ponteiro e foco mostram a dica com a explicação", () => {
    render(<App papelDoAtor="rh" />);
    act(() => item("Folha de Pagamento").focus());
    expect(document.querySelector(".dica-trilho")).toHaveTextContent(MENSAGEM);
    act(() => item("Suporte").blur());
    fireEvent.pointerOver(item("Calendário"));
    expect(document.querySelector(".dica-trilho")).toHaveTextContent(MENSAGEM);
  });

  it.each(ITENS_EM_DESENVOLVIMENTO)(
    "%s pelo mouse: abre o aviso sem mudar a URL nem a tela; Escape fecha e devolve o foco",
    async (rotulo) => {
      render(<App papelDoAtor="rh" destinoInicial="pessoas" />);
      const hash = window.location.hash;
      const titulo = tituloDaTela();
      const botao = item(rotulo);
      act(() => botao.focus());
      fireEvent.click(botao);

      const caixa = aviso()!;
      expect(caixa).toBeInTheDocument();
      expect(caixa).toHaveTextContent(MENSAGEM);
      expect(caixa).toHaveTextContent(rotulo);
      expect(window.location.hash).toBe(hash);
      expect(tituloDaTela()).toBe(titulo);
      await waitFor(() =>
        expect(caixa.contains(document.activeElement)).toBe(true),
      );

      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(aviso()).toBeNull();
      expect(botao).toHaveFocus();
      expect(window.location.hash).toBe(hash);
    },
  );

  it.each(SUBITENS_EM_DESENVOLVIMENTO)(
    "subitem %s › %s pelo teclado (Enter/Espaço = click): aviso, Escape e foco devolvido",
    async (pai, rotulo) => {
      render(<App papelDoAtor="rh" destinoInicial="dashboard" />);
      abrirCabecalho(pai);
      const hash = window.location.hash;
      const titulo = tituloDaTela();
      const botao = item(rotulo);
      expect(botao).toHaveAttribute("aria-disabled", "true");
      expect(botao).toHaveAccessibleDescription(MENSAGEM);
      act(() => botao.focus());
      fireEvent.click(botao, { detail: 0 });

      expect(aviso()).toHaveTextContent(MENSAGEM);
      expect(window.location.hash).toBe(hash);
      expect(tituloDaTela()).toBe(titulo);
      await waitFor(() =>
        expect(aviso()!.contains(document.activeElement)).toBe(true),
      );
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(aviso()).toBeNull();
      expect(botao).toHaveFocus();
    },
  );

  it("o foco só entra no aviso já posicionado e visível (o navegador ignora foco em elemento oculto)", async () => {
    const original = HTMLElement.prototype.focus;
    const visibilidadeNoFoco: string[] = [];
    const espiao = vi
      .spyOn(HTMLElement.prototype, "focus")
      .mockImplementation(function (this: HTMLElement, opcoes) {
        if (this.hasAttribute("data-aviso-em-desenvolvimento")) {
          visibilidadeNoFoco.push(this.style.visibility);
        }
        return original.call(this, opcoes);
      });
    try {
      render(<App papelDoAtor="rh" />);
      fireEvent.click(item("Pesquisas"));
      await waitFor(() => expect(visibilidadeNoFoco.length).toBeGreaterThan(0));
      expect(visibilidadeNoFoco).not.toContain("hidden");
    } finally {
      espiao.mockRestore();
    }
  });

  it("o botão 'Fechar' do aviso também devolve o foco ao item", () => {
    render(<App papelDoAtor="rh" />);
    const botao = item("Benefícios");
    fireEvent.click(botao);
    fireEvent.click(
      within(aviso()!).getByRole("button", { name: "Fechar aviso" }),
    );
    expect(aviso()).toBeNull();
    expect(botao).toHaveFocus();
  });

  it("um aviso por vez: acionar outro item troca o aviso", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(item("Pesquisas"));
    fireEvent.click(item("Roadmap"));
    expect(
      screen.getAllByRole("dialog", { name: "Em desenvolvimento" }),
    ).toHaveLength(1);
    expect(aviso()).toHaveTextContent("Roadmap");
  });

  it("Colaboradores ativo: cabeçalho expandido, subitem Colaboradores atual e Desenvolvimento ao lado", () => {
    render(<App papelDoAtor="rh" destinoInicial="pessoas" />);
    const modulo = cabecalho("Colaboradores");
    const regiao = document.getElementById(
      modulo.getAttribute("aria-controls")!,
    )!;
    const sub = within(regiao).getByRole("button", {
      name: /^Colaboradores\s/,
    });
    expect(sub).toHaveAttribute("aria-current", "page");
    expect(
      within(regiao).getByRole("button", { name: /^Desenvolvimento/ }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("Recrutamento começa fechado (expansão futura) e, aberto, mostra Vagas e Banco de talentos; fecha de novo", () => {
    render(<App papelDoAtor="rh" />);
    const botao = within(navegacao()).getByRole("button", {
      name: "Recrutamento",
    });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(
      document.getElementById(botao.getAttribute("aria-controls")!),
    ).not.toBeVisible();
    expect(botao).not.toHaveAttribute("aria-disabled");
    expect(botao).toHaveAccessibleDescription(MENSAGEM);
    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    const regiao = document.getElementById(
      botao.getAttribute("aria-controls")!,
    )!;
    expect(
      within(regiao)
        .getAllByRole("button")
        .map(
          (b) =>
            b.querySelector(".painel-nav__rotulo")?.firstChild?.textContent,
        ),
    ).toEqual(["Vagas", "Banco de talentos"]);
    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(regiao).not.toBeVisible();
  });

  it("Dashboard, Colaboradores e Configurações continuam navegando", () => {
    render(<App papelDoAtor="rh" destinoInicial="dashboard" />);
    fireEvent.click(item("Colaboradores"));
    expect(tituloDaTela()).toMatch(/^Colaboradores/);
    expect(window.location.hash).toBe("#/pessoas/colaboradores");
    fireEvent.click(item("Configurações"));
    expect(window.location.hash).toBe("#/configuracoes/meu-perfil");
    fireEvent.click(item("Dashboard"));
    expect(tituloDaTela()).toBe("Dashboard");
  });

  // T211 — o gestor vê só Liderança entre os destinos; dos itens em
  // desenvolvimento, só os de uso geral (Portal, Suporte e Roadmap).
  it("gestor: sem Dashboard (permissão existente); em desenvolvimento, só Portal, Suporte e Roadmap", () => {
    render(<App papelDoAtor="gestor" />);
    expect(
      within(navegacao()).queryByRole("button", { name: /^Dashboard/ }),
    ).toBeNull();
    for (const rotulo of ITENS_EM_DESENVOLVIMENTO) {
      const geral = ["Portal", "Suporte", "Roadmap"].includes(rotulo);
      const botao = within(navegacao()).queryByRole("button", {
        name: new RegExp(
          `^${escapar(rotulo)}( (Beta|Novo))? Em desenvolvimento$`,
        ),
      });
      if (geral) expect(botao).toHaveAttribute("aria-disabled", "true");
      else expect(botao, rotulo).toBeNull();
    }
  });
});

describe("T209 — menu completo no trilho recolhido", () => {
  function recolher() {
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
  }

  it("itens em desenvolvimento seguem identificáveis: a dica diz o nome e o estado", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    for (const rotulo of ITENS_EM_DESENVOLVIMENTO) {
      expect(item(rotulo)).toHaveAttribute(
        "data-dica",
        `${rotulo} — ${MENSAGEM}`,
      );
    }
    act(() => item("Portal").focus());
    expect(document.querySelector(".dica-trilho")).toHaveTextContent(
      `Portal — ${MENSAGEM}`,
    );
    // Cabeçalhos e seções viram ícones com nome na dica.
    expect(
      within(navegacao()).getByRole("button", { name: "Colaboradores" }),
    ).toHaveAttribute("data-dica", "Colaboradores");
  });

  it("acionar no trilho abre o aviso e mantém o menu recolhido; Escape devolve o foco", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    const botao = item("Hub de Benefícios");
    act(() => botao.focus());
    fireEvent.click(botao);
    expect(aviso()).toHaveTextContent(MENSAGEM);
    expect(
      screen.getByRole("button", { name: "Expandir menu" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(aviso()).toBeNull();
    expect(botao).toHaveFocus();
  });
});

describe("T209 — menu completo na gaveta do celular (375 px)", () => {
  it("aviso dentro da gaveta: Escape fecha só o aviso e devolve o foco ao item", async () => {
    act(() => definirLarguraDaJanela(375));
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const gaveta = screen.getByRole("dialog", { name: "Menu de navegação" });
    const botao = within(gaveta).getByRole("button", { name: /^Calendário/ });
    act(() => botao.focus());
    fireEvent.click(botao);
    const caixa = aviso()!;
    expect(gaveta.contains(caixa)).toBe(true); // a armadilha de foco o alcança
    await waitFor(() =>
      expect(caixa.contains(document.activeElement)).toBe(true),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(aviso()).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Menu de navegação" }),
    ).toBeInTheDocument();
    expect(botao).toHaveFocus();
    // Um segundo Escape é o da gaveta, como antes.
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Menu de navegação" }),
    ).toBeNull();
  });
});

describe("T209 — menu compacto: uma linha por item", () => {
  it("o sub-rótulo e o estado continuam no nome acessível, mas fora de vista", () => {
    render(<App papelDoAtor="rh" />);
    const subs = navegacao().querySelectorAll(".painel-nav__sub");
    expect(subs.length).toBeGreaterThan(0);
    for (const sub of subs) expect(sub).toHaveClass("painel-nav__oculto");
    const estados = navegacao().querySelectorAll(".painel-nav__estado");
    expect(estados.length).toBeGreaterThan(0);
    for (const estado of estados)
      expect(estado).toHaveClass("painel-nav__oculto");
    expect(item("Colaboradores")).toHaveAccessibleName(
      "Colaboradores Consulta, ficha e vida funcional",
    );
    expect(item("Portal")).toHaveAccessibleName(
      "Portal Beta Em desenvolvimento",
    );
  });

  it.each([...ITENS_EM_DESENVOLVIMENTO, "Recrutamento"])(
    "%s: marca compacta de 'em desenvolvimento' na mesma linha, oculta do leitor de tela",
    (rotulo) => {
      render(<App papelDoAtor="rh" />);
      const botao =
        rotulo === "Recrutamento"
          ? within(navegacao()).getByRole("button", { name: "Recrutamento" })
          : item(rotulo);
      const marca = botao.querySelector(
        ".painel-nav__marca-em-desenvolvimento",
      );
      expect(marca).not.toBeNull();
      expect(marca).toHaveAttribute("aria-hidden", "true");
      // A explicação segue acessível: descrição do botão.
      expect(botao).toHaveAccessibleDescription(MENSAGEM);
    },
  );

  it("o sub-rótulo de um item funcional vira a dica dele no menu expandido", () => {
    render(<App papelDoAtor="rh" />);
    expect(item("Dashboard")).toHaveAttribute(
      "data-dica",
      "Visão geral do ano",
    );
    expect(item("Colaboradores")).toHaveAttribute(
      "data-dica",
      "Consulta, ficha e vida funcional",
    );
    expect(item("Configurações")).toHaveAttribute("data-dica", "Meu perfil");
    act(() => item("Dashboard").focus());
    expect(document.querySelector(".dica-trilho")).toHaveTextContent(
      "Visão geral do ano",
    );
  });

  it("começa fechado Recrutamento; Colaboradores, aberto (T211: sem Operação nem Demonstração)", () => {
    render(<App papelDoAtor="rh" destinoInicial="dashboard" />);
    expect(
      within(navegacao()).getByRole("button", { name: "Recrutamento" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      within(navegacao()).getByRole("button", { name: "Colaboradores" }),
    ).toHaveAttribute("aria-expanded", "true");
    for (const ausente of ["Operação", "Demonstração"]) {
      expect(
        within(navegacao()).queryByRole("button", { name: ausente }),
      ).toBeNull();
    }
  });

  it("T211 — a tela aberta nunca fica escondida: Organograma abre Colaboradores já aberto e marcado", () => {
    render(<App papelDoAtor="rh" destinoInicial="cadastros" />);
    expect(
      within(navegacao()).getByRole("button", { name: "Colaboradores" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(item("Organograma")).toHaveAttribute("aria-current", "page");
  });

  it("T211 — tela de demonstração aberta (fora do menu): nenhum item marcado", () => {
    render(<App papelDoAtor="rh" destinoInicial="inicio" />);
    expect(tituloDaTela()).toBe("Visão geral");
    expect(navegacao().querySelectorAll('[aria-current="page"]')).toHaveLength(
      0,
    );
  });

  it("T211 — no trilho, Colaboradores e Liderança seguem como ícones", () => {
    render(<App papelDoAtor="rh" destinoInicial="dashboard" />);
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(
      within(navegacao()).getByRole("button", { name: "Colaboradores" }),
    ).toHaveAttribute("data-dica", "Colaboradores");
    expect(item("Liderança")).toBeVisible();
  });

  it("na gaveta do celular: Recrutamento fechado; Organograma à vista em Colaboradores", () => {
    act(() => definirLarguraDaJanela(375));
    render(<App papelDoAtor="rh" destinoInicial="dashboard" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const gaveta = screen.getByRole("dialog", { name: "Menu de navegação" });
    expect(
      within(gaveta).getByRole("button", { name: "Recrutamento" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      within(gaveta).getByRole("button", { name: /^Organograma/ }),
    ).toBeVisible();
    expect(
      within(gaveta).getByRole("button", { name: /^Liderança/ }),
    ).toBeVisible();
  });
});

describe("T209 — contrato do menu completo", () => {
  it("nenhum link na navegação, muito menos href='#'", () => {
    render(<App papelDoAtor="rh" />);
    expect(navegacao().querySelectorAll("a")).toHaveLength(0);
    expect(document.querySelectorAll('[href="#"]')).toHaveLength(0);
  });

  it("itens em desenvolvimento não têm destino, rota nem cartão: só o aviso", () => {
    const ids = new Set(DESTINOS.map((d) => d.id));
    const entradas = entradasEmDesenvolvimento();
    expect(entradas.length).toBe(ITENS_EM_DESENVOLVIMENTO.length + 4);
    for (const entrada of entradas) {
      expect(ids.has(entrada.id)).toBe(false);
      expect(rotaDoDestino(entrada.id)).toBeNull();
      expect(entrada.rotulo.trim()).not.toBe("");
    }
    expect(MENSAGEM_EM_DESENVOLVIMENTO).toBe(MENSAGEM);
  });

  it("T211 — todo grupo do mapa aparece no máximo uma vez no menu; fora dele, só Jornada (Ponto) e Demonstração", () => {
    const usados = MENU_LATERAL.flatMap((secao) =>
      secao.entradas.flatMap((e) => (e.tipo === "modulo" ? [e.grupo] : [])),
    );
    expect(new Set(usados).size).toBe(usados.length);
    expect(
      GRUPOS.map((g) => g.titulo).filter((t) => !usados.includes(t)),
    ).toEqual(["Jornada", "Demonstração"]);
  });

  it("todo item em desenvolvimento renderizado tem nome, descrição e nenhum handler de rota", () => {
    render(<App papelDoAtor="rh" />);
    abrirCabecalho("Recrutamento");
    const indisponiveis = navegacao().querySelectorAll<HTMLElement>(
      '[aria-disabled="true"]',
    );
    expect(indisponiveis).toHaveLength(ITENS_EM_DESENVOLVIMENTO.length + 3);
    for (const botao of indisponiveis) {
      expect(botao.tagName).toBe("BUTTON");
      expect(botao.textContent?.trim()).not.toBe("");
      expect(botao).toHaveAccessibleDescription(MENSAGEM);
      expect(botao).not.toHaveAttribute("href");
    }
  });

  describe("CSS", () => {
    const css = readFileSync("src/app/PainelNavigation.css", "utf8").replace(
      /\r\n/g,
      "\n",
    );
    const inicio = css.indexOf("/* ---- T209 — menu completo");
    const bloco = inicio > -1 ? css.slice(inicio) : "";

    it("o bloco existe e usa só tokens", () => {
      expect(inicio).toBeGreaterThan(-1);
      expect(bloco).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(bloco).not.toMatch(/\brgba?\(|\bhsla?\(/);
    });

    it("rodapé preso ao pé da faixa, separado por divisor", () => {
      expect(bloco).toMatch(
        /\.painel-nav__modulos--rodape \{[^}]*margin-top: auto;[^}]*border-top: var\(--divisor\);/,
      );
    });

    it("item em desenvolvimento: discreto, mas sem opacidade que o apague e sem cursor de proibido", () => {
      const regra =
        /\.painel-nav__destino--em-desenvolvimento \{([^}]*)\}/.exec(bloco);
      expect(regra).not.toBeNull();
      const opacidade = /opacity: ([\d.]+)/.exec(regra![1]!);
      if (opacidade) expect(Number(opacidade[1])).toBeGreaterThanOrEqual(0.7);
      expect(bloco).not.toMatch(/not-allowed/);
    });

    it("aviso e selos sem animação decorativa fora de 'no-preference'", () => {
      const semPreferencia = bloco.replace(
        /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g,
        "",
      );
      expect(semPreferencia).not.toMatch(/transition|animation/);
    });

    it("seções sem divisor no menu expandido; o divisor fica só no trilho (onde o título some)", () => {
      const secao = /\n\.painel-nav__secao \{([^}]*)\}/.exec(bloco);
      expect(secao).not.toBeNull();
      expect(secao![1]).not.toMatch(/border-top/);
      expect(bloco).toMatch(
        /\.painel-nav--trilho \.painel-nav__secao \{[^}]*border-top: var\(--divisor\);/,
      );
    });

    it("a marca de 'em desenvolvimento' é compacta e vai ao fim da linha", () => {
      expect(bloco).toMatch(
        /\.painel-nav__marca-em-desenvolvimento \{[^}]*margin-left: auto;/,
      );
    });

    it("no celular o título recolhível da seção também tem 44 px", () => {
      expect(bloco).toMatch(
        /@media \(max-width: 834px\) \{[^@]*\.painel-nav__secao-alternar \{[^}]*min-height: var\(--touch-target\);/,
      );
    });

    it("no celular os alvos do menu, inclusive os subitens, têm 44 px", () => {
      expect(css).toMatch(
        /@media \(max-width: 834px\) \{[^@]*\.painel-nav__destino--sub \{[^}]*min-height: var\(--touch-target\);/,
      );
    });
  });
});
