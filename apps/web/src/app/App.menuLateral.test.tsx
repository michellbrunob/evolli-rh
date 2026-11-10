/**
 * T206 — shell com menu lateral fixo e recolhível.
 *
 * O que estes testes prendem:
 *
 * - o botão de recolher (nome, estado, foco, anúncio único);
 * - o trilho (nome acessível de cada item, destino funcional, submenus,
 *   empresa, item ativo, nada focável escondido);
 * - a dica visual (foco, ponteiro, Escape, clique, nunca a fonte do nome);
 * - a guarda de edição pendente (T200) a partir do trilho;
 * - a gaveta do celular, que continua a mesma, e a travessia do breakpoint;
 * - o contrato de CSS que faz a faixa encostar na borda e o conteúdo crescer.
 *
 * O jsdom não calcula layout: largura e posição reais são medidas na
 * validação local (dossiê, seção de evidências). Aqui se prende o que as
 * produz — classes, atributos e as regras do CSS.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ProvedorDeEdicoes, RegistroDeEdicoes } from "./edicoesPendentes";
import { ProvedorDeGuarda } from "./guardaDeSaida";
import { ID_NAVEGACAO_PAINEL } from "./PainelNavigation";
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

const barra = () => document.getElementById("navegacao-lateral")!;
const shell = () => document.querySelector(".app-shell")!;
const emTrilho = () => shell().classList.contains("app-shell--menu-recolhido");
const botaoRecolher = () =>
  document.querySelector<HTMLButtonElement>(".app-shell__recolher")!;
const dica = () => document.querySelector<HTMLElement>(".dica-trilho");
const navegacao = () =>
  screen.getByRole("navigation", { name: "Navegação do painel" });

/** Controles alcançáveis da barra: fora de qualquer `[hidden]`. */
function alcancaveisDaBarra(): HTMLElement[] {
  return [
    ...barra().querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((e) => e.closest("[hidden]") === null);
}

function itemDoTrilho(nome: string): HTMLElement {
  const item = barra().querySelector<HTMLElement>(`[data-dica="${nome}"]`);
  if (!item) throw new Error(`item do trilho "${nome}" não existe`);
  return item;
}

function recolher() {
  fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
}

/**
 * Saída do ponteiro com `relatedTarget` real: o `fireEvent.pointerOut` do
 * jsdom não o repassa, e é ele que diz para onde o ponteiro foi.
 */
function ponteiroSai(de: Element, para: Element) {
  act(() => {
    de.dispatchEvent(
      new MouseEvent("pointerout", { bubbles: true, relatedTarget: para }),
    );
  });
}

function tituloDaTela(): string {
  const id = screen.getByRole("main").getAttribute("aria-labelledby")!;
  return document.getElementById(id)?.textContent ?? "";
}

beforeEach(() => {
  vi.mocked(listarEmpresasDoContexto).mockReset();
  vi.mocked(listarEmpresasDoContexto).mockResolvedValue([ALFA, BETA]);
});

afterEach(() => {
  redefinirLarguraDaJanela();
});

describe("T206 — botão de recolher/expandir (desktop)", () => {
  it("começa expandido: 'Recolher menu', aria-expanded verdadeiro, controla a navegação", () => {
    render(<App papelDoAtor="rh" />);
    const botao = screen.getByRole("button", { name: "Recolher menu" });
    expect(botao).toBe(botaoRecolher());
    expect(botao.tagName).toBe("BUTTON");
    expect(botao).toHaveAttribute("type", "button");
    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(botao).toHaveAttribute("aria-controls", ID_NAVEGACAO_PAINEL);
    expect(navegacao()).toHaveAttribute("id", ID_NAVEGACAO_PAINEL);
    expect(botao).not.toHaveAttribute("hidden");
    expect(emTrilho()).toBe(false);
    expect(navegacao()).not.toHaveClass("painel-nav--trilho");
  });

  it("o nome vem do texto do botão, não da dica nem de aria-label", () => {
    render(<App papelDoAtor="rh" />);
    const botao = botaoRecolher();
    expect(botao).not.toHaveAttribute("aria-label");
    expect(dica()).toBeNull();
    expect(botao).toHaveAccessibleName("Recolher menu");
    expect(
      within(botao).getByText("Recolher menu", {
        selector: ".app-shell__oculto",
      }),
    ).toBeInTheDocument();
  });

  it("recolher e expandir: o MESMO botão, com o foco nele, troca nome e estado", () => {
    render(<App papelDoAtor="rh" />);
    const botao = botaoRecolher();
    botao.focus();

    fireEvent.click(botao);
    expect(botaoRecolher()).toBe(botao);
    expect(document.activeElement).toBe(botao);
    expect(botao).toHaveAccessibleName("Expandir menu");
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(emTrilho()).toBe(true);
    expect(navegacao()).toHaveClass("painel-nav--trilho");

    fireEvent.click(botao);
    expect(botaoRecolher()).toBe(botao);
    expect(document.activeElement).toBe(botao);
    expect(botao).toHaveAccessibleName("Recolher menu");
    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(emTrilho()).toBe(false);
    expect(document.activeElement).not.toBe(document.body);
  });

  it("anúncio único: alternar não escreve em nenhuma região viva", () => {
    render(<App papelDoAtor="rh" />);
    const vivas = () =>
      [
        ...document.querySelectorAll(
          '[role="status"], [role="alert"], [aria-live]',
        ),
      ].map((e) => e.textContent);
    const antes = vivas();
    recolher();
    expect(vivas()).toEqual(antes);
    fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }));
    expect(vivas()).toEqual(antes);
  });

  it("preferência controlada: nasce recolhido e avisa quem a guarda", () => {
    const aoMudar = vi.fn();
    const { rerender } = render(
      <App papelDoAtor="rh" menuRecolhido onMenuRecolhidoChange={aoMudar} />,
    );
    expect(emTrilho()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }));
    expect(aoMudar).toHaveBeenCalledWith(false);
    // Controlado: o shell não muda sozinho; muda quando quem guarda muda.
    expect(emTrilho()).toBe(true);
    rerender(
      <App
        papelDoAtor="rh"
        menuRecolhido={false}
        onMenuRecolhidoChange={aoMudar}
      />,
    );
    expect(emTrilho()).toBe(false);
  });

  it("nenhum armazenamento: nem localStorage nem sessionStorage", () => {
    const gravar = vi.spyOn(Storage.prototype, "setItem");
    render(<App papelDoAtor="rh" />);
    recolher();
    fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }));
    expect(gravar).not.toHaveBeenCalled();
    gravar.mockRestore();
  });
});

describe("T206 — trilho de ícones", () => {
  it("todo controle alcançável tem nome acessível e dica; nada além deles é alcançável", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    const controles = alcancaveisDaBarra();
    expect(controles.length).toBeGreaterThan(3);
    for (const controle of controles) {
      expect(controle).toHaveAccessibleName();
      expect(controle).toHaveAttribute("data-dica");
    }
    // Os submenus inteiros estão fechados: nenhum sub-item é alcançável.
    for (const sub of barra().querySelectorAll(".painel-nav__destino--sub")) {
      expect(sub.closest("[hidden]")).not.toBeNull();
    }
  });

  it("o nome de cada item é o rótulo dele — a dica só repete o que já está no DOM", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    expect(dica()).toBeNull();
    for (const item of barra().querySelectorAll<HTMLElement>(
      ".painel-nav [data-dica]",
    )) {
      const rotulo = item.getAttribute("data-dica")!;
      expect(item).not.toHaveAttribute("aria-label");
      expect(item.textContent).toContain(rotulo);
    }
    expect(itemDoTrilho("Dashboard")).toHaveAccessibleName(/^Dashboard/);
    expect(itemDoTrilho("Estrutura")).toHaveAccessibleName("Estrutura");
  });

  it("destino direto: navega e o menu continua recolhido", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    const jornada = itemDoTrilho("Jornada");
    jornada.focus();
    fireEvent.click(jornada);
    expect(tituloDaTela()).toBe("Visão do período");
    expect(jornada).toHaveAttribute("aria-current", "page");
    expect(emTrilho()).toBe(true);
    expect(document.activeElement).toBe(jornada);
  });

  it.each(["Gestão de Pessoas", "Estrutura", "Liderança", "Demonstração"])(
    "módulo com submenu (%s): expande o menu, abre o módulo e o foco fica no cabeçalho",
    (modulo) => {
      render(<App papelDoAtor="rh" />);
      recolher();
      const cabecalho = itemDoTrilho(modulo);
      expect(cabecalho).toHaveAttribute("aria-expanded", "false");
      const regiao = document.getElementById(
        cabecalho.getAttribute("aria-controls")!,
      )!;
      expect(regiao).toHaveAttribute("hidden");

      cabecalho.focus();
      fireEvent.click(cabecalho);

      expect(emTrilho()).toBe(false);
      expect(document.activeElement).toBe(cabecalho);
      expect(cabecalho).toHaveAttribute("aria-expanded", "true");
      expect(regiao).not.toHaveAttribute("hidden");
      expect(within(regiao).getAllByRole("button").length).toBeGreaterThan(0);
    },
  );

  it("um módulo fechado à mão continua abrível pelo trilho", () => {
    render(<App papelDoAtor="rh" />);
    const estrutura = screen.getByRole("button", { name: "Estrutura" });
    fireEvent.click(estrutura); // fecha
    expect(estrutura).toHaveAttribute("aria-expanded", "false");
    recolher();
    fireEvent.click(itemDoTrilho("Estrutura"));
    expect(estrutura).toHaveAttribute("aria-expanded", "true");
  });
});

describe("T206 — item ativo nos dois estados", () => {
  it("destino direto: aria-current e marca visual expandido e no trilho", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: /^Jornada Visão/ }));
    const jornada = screen.getByRole("button", { name: /^Jornada Visão/ });
    expect(jornada).toHaveAttribute("aria-current", "page");
    expect(jornada).toHaveClass("painel-nav__destino--ativo");
    recolher();
    expect(jornada).toHaveAttribute("aria-current", "page");
    expect(jornada).toHaveClass("painel-nav__destino--ativo");
  });

  it("destino dentro de submenu: no trilho o cabeçalho herda a marca e a semântica", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: /^Colaboradores/ }));
    const cabecalho = screen.getByRole("button", { name: "Gestão de Pessoas" });
    expect(cabecalho).not.toHaveAttribute("aria-current");
    expect(cabecalho).not.toHaveClass("painel-nav__cabecalho--contem-ativo");

    recolher();
    expect(cabecalho).toHaveAttribute("aria-current", "true");
    expect(cabecalho).toHaveClass("painel-nav__cabecalho--contem-ativo");
    // O botão marcado como página está oculto junto com o submenu.
    const colaboradores = barra().querySelector('[aria-current="page"]')!;
    expect(colaboradores.closest("[hidden]")).not.toBeNull();
  });

  it("módulo fechado à mão no menu expandido também carrega a semântica", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.click(screen.getByRole("button", { name: /^Colaboradores/ }));
    const cabecalho = screen.getByRole("button", { name: "Gestão de Pessoas" });
    fireEvent.click(cabecalho);
    expect(cabecalho).toHaveAttribute("aria-expanded", "false");
    expect(cabecalho).toHaveAttribute("aria-current", "true");
  });
});

describe("T206 — dica visual do trilho", () => {
  it("aparece ao focar, com o rótulo, aria-hidden; some ao perder o foco", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    const estrutura = itemDoTrilho("Estrutura");
    act(() => estrutura.focus());
    expect(dica()).not.toBeNull();
    expect(dica()).toHaveTextContent("Estrutura");
    expect(dica()).toHaveAttribute("aria-hidden", "true");
    act(() => estrutura.blur());
    expect(dica()).toBeNull();
  });

  it("aparece ao passar o ponteiro e some ao sair dele", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    const jornada = itemDoTrilho("Jornada");
    fireEvent.pointerOver(jornada);
    expect(dica()).toHaveTextContent("Jornada");
    ponteiroSai(jornada, document.body);
    expect(dica()).toBeNull();
  });

  it("o ponteiro pode passar do item para a dica sem que ela suma (1.4.13)", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    const jornada = itemDoTrilho("Jornada");
    fireEvent.pointerOver(jornada);
    const caixa = dica()!;
    ponteiroSai(jornada, caixa);
    expect(dica()).not.toBeNull();
    ponteiroSai(caixa, document.body);
    expect(dica()).toBeNull();
  });

  it("Escape e clique a escondem", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    const estrutura = itemDoTrilho("Estrutura");
    act(() => estrutura.focus());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dica()).toBeNull();
    fireEvent.pointerOver(estrutura);
    expect(dica()).not.toBeNull();
    fireEvent.click(itemDoTrilho("Jornada"));
    expect(dica()).toBeNull();
  });

  it("reposiciona ao fim da transição da faixa (o foco pode chegar com a largura andando)", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    const estrutura = itemDoTrilho("Estrutura");
    const caixa = (direita: number, topo: number) =>
      ({ top: topo, height: 40, right: direita }) as DOMRect;
    // Durante a transição a faixa ainda é larga: a medida sai deslocada.
    estrutura.getBoundingClientRect = () => caixa(272, 100);
    act(() => estrutura.focus());
    expect(dica()!.style.left).toBe("272px");
    // Terminada a transição, o item está no trilho.
    estrutura.getBoundingClientRect = () => caixa(64, 100);
    act(() => {
      barra().dispatchEvent(new Event("transitionend", { bubbles: true }));
    });
    expect(dica()!.style.left).toBe("64px");
    expect(dica()!.style.top).toBe("120px");
  });

  it("some quando a janela é redimensionada", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    act(() => itemDoTrilho("Estrutura").focus());
    expect(dica()).not.toBeNull();
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(dica()).toBeNull();
  });

  it("o botão de recolher também tem dica, com o nome atual", () => {
    render(<App papelDoAtor="rh" />);
    fireEvent.pointerOver(botaoRecolher());
    expect(dica()).toHaveTextContent("Recolher menu");
    fireEvent.click(botaoRecolher());
    fireEvent.pointerOver(botaoRecolher());
    expect(dica()).toHaveTextContent("Expandir menu");
  });

  it("menu expandido: os itens não têm dica (o texto está à vista)", () => {
    render(<App papelDoAtor="rh" />);
    expect(navegacao().querySelectorAll("[data-dica]")).toHaveLength(0);
  });
});

describe("T206 — empresa no trilho", () => {
  it("compacto, com o nome no DOM; acionar expande o menu e abre a lista na empresa atual", async () => {
    render(
      <App
        papelDoAtor="rh"
        onLogout={() => undefined}
        empresaAtiva={ALFA}
        podeTrocarEmpresa
      />,
    );
    const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
    recolher();
    expect(document.querySelector(".seletor-empresa--compacto")).not.toBeNull();
    expect(botao).toHaveAccessibleName(/Empresa Alfa/);
    expect(botao).toHaveAttribute("data-dica", "Empresa ativa: Empresa Alfa");

    botao.focus();
    fireEvent.click(botao);

    expect(emTrilho()).toBe(false);
    expect(document.querySelector(".seletor-empresa--compacto")).toBeNull();
    expect(botao).toHaveAttribute("aria-expanded", "true");
    const atual = await screen.findByRole("button", { name: /^Empresa Alfa/ });
    expect(atual).toHaveAttribute("aria-current", "true");
    expect(document.activeElement).toBe(atual);
  });

  it("seta para baixo no trilho também expande e abre", async () => {
    render(
      <App
        papelDoAtor="rh"
        onLogout={() => undefined}
        empresaAtiva={ALFA}
        podeTrocarEmpresa
      />,
    );
    const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
    recolher();
    fireEvent.keyDown(botao, { key: "ArrowDown" });
    expect(emTrilho()).toBe(false);
    expect(botao).toHaveAttribute("aria-expanded", "true");
  });

  it("só leitura: monograma no trilho, nome no DOM e dica", () => {
    render(
      <App
        papelDoAtor="dp"
        onLogout={() => undefined}
        empresaAtiva={ALFA}
        podeTrocarEmpresa={false}
      />,
    );
    recolher();
    const cartao = barra().querySelector(".seletor-empresa__leitura")!;
    expect(cartao).toHaveTextContent("Empresa Alfa");
    expect(cartao).toHaveAttribute("data-dica", "Empresa ativa: Empresa Alfa");
    expect(within(cartao as HTMLElement).getByText("EA")).toBeInTheDocument();
  });

  it("sem empresa ativa (acesso global): símbolo próprio e o nome do acesso", async () => {
    render(
      <App
        papelDoAtor="master_tecnico"
        onLogout={() => undefined}
        empresaAtiva={null}
        podeTrocarEmpresa
      />,
    );
    const botao = await screen.findByRole("button", { name: /Empresa ativa/ });
    recolher();
    expect(botao.querySelector(".seletor-empresa__simbolo")).not.toBeNull();
    expect(botao).toHaveAccessibleName(/Acesso global/);
  });
});

describe("T206 — guarda de edição pendente com o menu recolhido", () => {
  it("navegar pelo trilho com edição pendente pergunta antes; continuar editando fica", () => {
    const registro = new RegistroDeEdicoes();
    render(
      <ProvedorDeEdicoes registro={registro}>
        <ProvedorDeGuarda suspensa={false}>
          <App papelDoAtor="rh" />
        </ProvedorDeGuarda>
      </ProvedorDeEdicoes>,
    );
    const antes = tituloDaTela();
    recolher();
    act(() =>
      registro.definir("edicao-sintetica", {
        rotulo: "Cadastro sintético",
        pendente: true,
        salvando: false,
      }),
    );
    fireEvent.click(itemDoTrilho("Jornada"));
    const dialogo = screen.getByRole("alertdialog", {
      name: "Sair sem salvar?",
    });
    expect(dialogo).toHaveTextContent("Cadastro sintético");
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Continuar editando" }),
    );
    expect(tituloDaTela()).toBe(antes);
    expect(emTrilho()).toBe(true);
  });
});

describe("T206 — celular: a gaveta continua a mesma", () => {
  it("abaixo de 835px não há trilho nem botão de recolher alcançável, mesmo com a preferência ligada", () => {
    definirLarguraDaJanela(375);
    render(<App papelDoAtor="rh" onLogout={() => undefined} menuRecolhido />);
    expect(emTrilho()).toBe(false);
    expect(navegacao()).not.toHaveClass("painel-nav--trilho");
    expect(botaoRecolher()).toHaveAttribute("hidden");
  });

  it("gaveta: diálogo modal, fundo inerte, foco no primeiro item (nunca no botão oculto) e Escape devolve ao Menu", () => {
    definirLarguraDaJanela(375);
    render(<App papelDoAtor="rh" onLogout={() => undefined} menuRecolhido />);
    const menu = screen.getByRole("button", { name: "Menu" });
    menu.focus();
    fireEvent.click(menu);
    const gaveta = screen.getByRole("dialog", { name: "Menu de navegação" });
    expect(gaveta).toBe(barra());
    for (const seletor of ["header", "main", "footer"]) {
      expect(document.querySelector(seletor)).toHaveAttribute("inert");
    }
    expect(document.activeElement).not.toBe(botaoRecolher());
    expect(barra().contains(document.activeElement)).toBe(true);
    // Todos os submenus à vista: a gaveta é sempre o menu inteiro.
    for (const cabecalho of barra().querySelectorAll(
      ".painel-nav__cabecalho",
    )) {
      expect(cabecalho).toHaveAttribute("aria-expanded", "true");
    }
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(menu);
  });

  it("atravessar o breakpoint com o foco num acionador leva o foco ao equivalente — nunca ao body", () => {
    render(<App papelDoAtor="rh" />);
    const recolherBotao = botaoRecolher();
    recolherBotao.focus();
    act(() => definirLarguraDaJanela(375));
    expect(recolherBotao).toHaveAttribute("hidden");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Menu" }),
    );
    act(() => definirLarguraDaJanela(1280));
    expect(document.activeElement).toBe(recolherBotao);
  });

  it("o navegador já tirou o foco no redimensionamento (CSS da gaveta): ainda assim vai ao equivalente", () => {
    // No Chrome, a faixa some pelo CSS no próprio redimensionamento e o foco
    // cai no body ANTES de o React saber do breakpoint.
    render(<App papelDoAtor="rh" />);
    const recolherBotao = botaoRecolher();
    recolherBotao.focus();
    act(() => {
      recolherBotao.blur();
      definirLarguraDaJanela(375);
    });
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(document.activeElement).toBe(menu);
    act(() => {
      menu.blur();
      definirLarguraDaJanela(1280);
    });
    expect(document.activeElement).toBe(recolherBotao);
  });

  it("foco perdido em qualquer item da faixa vai ao Menu; fora da faixa, nada é movido", () => {
    render(<App papelDoAtor="rh" />);
    const jornada = screen.getByRole("button", { name: /^Jornada Visão/ });
    jornada.focus();
    act(() => {
      jornada.blur();
      definirLarguraDaJanela(375);
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Menu" }),
    );
    act(() => definirLarguraDaJanela(1280));

    const principal = screen.getByRole("main");
    principal.focus();
    act(() => definirLarguraDaJanela(375));
    expect(document.activeElement).toBe(principal);
  });

  it("desktop → celular → desktop: o trilho escolhido volta", () => {
    render(<App papelDoAtor="rh" />);
    recolher();
    act(() => definirLarguraDaJanela(375));
    expect(emTrilho()).toBe(false);
    act(() => definirLarguraDaJanela(1280));
    expect(emTrilho()).toBe(true);
  });
});

describe("T206 — contrato de CSS do shell", () => {
  const shellCss = readFileSync("src/app/app-shell.css", "utf8");
  const navCss = readFileSync("src/app/PainelNavigation.css", "utf8");
  const seletorCss = readFileSync("src/app/SeletorEmpresaAtiva.css", "utf8");

  /** Conteúdo exato de um bloco delimitado por chaves a partir de `inicio`. */
  function bloco(css: string, cabecalho: RegExp): string {
    const achado = cabecalho.exec(css);
    if (!achado) throw new Error(`bloco ${cabecalho} não existe`);
    const abre = achado.index + achado[0].length - 1;
    let profundidade = 0;
    for (let i = abre; i < css.length; i += 1) {
      if (css[i] === "{") profundidade += 1;
      else if (css[i] === "}") {
        profundidade -= 1;
        if (profundidade === 0) return css.slice(abre + 1, i);
      }
    }
    throw new Error(`bloco ${cabecalho} não fecha`);
  }

  /** A primeira regra (fora de @media) de um seletor exato. */
  function regra(css: string, seletor: string): string {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return bloco(css, new RegExp(`(^|\\n)${escapado}\\s*\\{`));
  }

  const desktop = bloco(shellCss, /@media\s*\(\s*min-width:\s*835px\s*\)\s*\{/);
  const semMovimentoReduzido = bloco(
    shellCss,
    /@media\s*\(\s*prefers-reduced-motion:\s*no-preference\s*\)\s*\{/,
  );

  it("o extrator delimita o bloco do desktop, sem varrer o arquivo", () => {
    expect(desktop.length).toBeGreaterThan(0);
    expect(desktop.length).toBeLessThan(shellCss.length);
    expect(desktop).not.toContain("@media");
  });

  it("sem trava de largura nem centralização: a faixa encosta na borda e a coluna vai até a direita", () => {
    for (const seletor of [
      ".app-shell__body",
      ".app-shell__main",
      ".app-shell__topbar-inner",
      ".app-shell__footer-inner",
    ]) {
      const corpo = regra(shellCss, seletor);
      expect(corpo, seletor).not.toMatch(/max-width/);
      expect(corpo, seletor).not.toMatch(/margin:\s*0 auto/);
    }
  });

  it("a faixa tem a altura da janela, fica presa no topo e usa a largura variável", () => {
    const faixa = regra(shellCss, ".app-shell__sidebar");
    expect(faixa).toMatch(/position:\s*sticky/);
    expect(faixa).toMatch(/top:\s*0;/);
    expect(faixa).toMatch(/height:\s*100vh/);
    expect(faixa).toMatch(/width:\s*var\(--largura-lateral\)/);
    expect(faixa).toMatch(/flex:\s*0 0 var\(--largura-lateral\)/);
    expect(faixa).toMatch(/overflow-y:\s*auto/);
    const coluna = regra(shellCss, ".app-shell__coluna");
    expect(coluna).toMatch(/flex:\s*1 1 auto/);
    expect(coluna).toMatch(/min-width:\s*0/);
  });

  it("recolher troca só a largura da faixa, e só no desktop", () => {
    expect(desktop).toMatch(
      /\.app-shell--menu-recolhido\s*\{[^}]*--largura-lateral:\s*var\(--largura-trilho\)/,
    );
    const foraDoDesktop = shellCss.replace(desktop, "");
    expect(foraDoDesktop).not.toMatch(
      /--largura-lateral:\s*var\(--largura-trilho\)/,
    );
  });

  it("no trilho o texto fica visualmente oculto, nunca removido (continua sendo o nome)", () => {
    const textoDoItem = regra(navCss, ".painel-nav--trilho .painel-nav__texto");
    const textoDaEmpresa = regra(
      seletorCss,
      ".seletor-empresa--compacto .seletor-empresa__textos",
    );
    const textoDaMarca = bloco(
      desktop,
      /\.app-shell--menu-recolhido\s+\.app-shell__marca-texto\s*\{/,
    );
    for (const corpo of [textoDoItem, textoDaEmpresa, textoDaMarca]) {
      expect(corpo).toMatch(/clip:\s*rect\(0 0 0 0\)/);
      expect(corpo).toMatch(/position:\s*absolute/);
      expect(corpo).not.toMatch(/display:\s*none/);
      expect(corpo).not.toMatch(/visibility:\s*hidden/);
    }
  });

  it("o texto oculto fica contido num ancestral posicionado (não alarga a página)", () => {
    expect(
      regra(navCss, ".painel-nav__destino,\n.painel-nav__cabecalho"),
    ).toMatch(/position:\s*relative/);
    expect(regra(shellCss, ".app-shell__recolher")).toMatch(
      /position:\s*relative/,
    );
    expect(regra(shellCss, ".app-shell__marca")).toMatch(
      /position:\s*relative/,
    );
  });

  it("botão de recolher com alvo de 44px e a dica fixa, sem deslocamento horizontal", () => {
    const botao = regra(shellCss, ".app-shell__recolher");
    expect(botao).toMatch(/width:\s*var\(--touch-target\)/);
    expect(botao).toMatch(/height:\s*var\(--touch-target\)/);
    expect(regra(shellCss, ".dica-trilho")).toMatch(/position:\s*fixed/);
    expect(shellCss).not.toMatch(/translateX|translate3d/);
  });

  it("no celular todo item do menu tem alvo de 44px, inclusive os sub-itens", () => {
    const celular = bloco(navCss, /@media\s*\(\s*max-width:\s*834px\s*\)\s*\{/);
    expect(celular).toMatch(
      /\.painel-nav__destino--sub\s*\{[^}]*min-height:\s*var\(--touch-target\)/,
    );
    expect(
      regra(navCss, ".painel-nav__destino,\n.painel-nav__cabecalho"),
    ).toMatch(/min-height:\s*var\(--touch-target\)/);
  });

  it("a transição de largura só existe sem redução de movimento", () => {
    expect(semMovimentoReduzido).toMatch(/\.app-shell__sidebar\s*\{[^}]*width/);
    const foraDela = shellCss.replace(semMovimentoReduzido, "");
    expect(foraDela).not.toMatch(/transition:[^;]*width/);
  });
});
