/**
 * T209 — barra superior fixa do shell: marca, recolher o menu e a trilha da
 * rota à esquerda; à direita, só a conta (avatar ou iniciais, nome de
 * exibição e um menu acessível com Meu perfil e Sair). Nunca e-mail, papel
 * técnico, empresa ou identificador. Sem Hub.
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
import { listarEmpresasDoContexto } from "../api/contextoEmpresarialClient";
import {
  definirLarguraDaJanela,
  redefinirLarguraDaJanela,
} from "../test/viewport";

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

const EMAIL = "pessoa.sintetica@exemplo.invalid";
const EMPRESA = {
  id: "11111111-1111-4111-8111-111111111111",
  codigo: "ALFA",
  nome: "Empresa Alfa Sintética",
};

function conta(nomeExibicao: string | null, fotoVersao: string | null = null) {
  return {
    email: EMAIL,
    role: "rh",
    createdAt: "2026-01-01T00:00:00.000Z",
    empresaAtiva: EMPRESA,
    nomeExibicao,
    perfilAtualizadoEm: null,
    fotoVersao,
  };
}

function montar(props: Partial<Parameters<typeof App>[0]> = {}): {
  onLogout: ReturnType<typeof vi.fn>;
} {
  const onLogout = vi.fn();
  render(
    <App
      papelDoAtor="rh"
      destinoInicial="pessoas"
      onLogout={onLogout}
      empresaAtiva={EMPRESA}
      contaDoAtor={conta("Ana Paula Sintética")}
      {...props}
    />,
  );
  return { onLogout };
}

/** A barra do shell (telas como a Nova admissão têm o próprio `<header>`). */
const barra = () =>
  document.querySelector<HTMLElement>("header.barra-superior")!;
const botaoConta = () =>
  within(barra()).getByRole("button", { name: /^Conta: / });

function abrirMenuDaConta() {
  fireEvent.keyDown(botaoConta(), { key: "Enter" });
  return screen.findByRole("menu", { name: /^Conta: / });
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

describe("T209 — barra superior: esquerda", () => {
  it("a barra começa pela trilha da tela, com o ícone do módulo (decorativo)", () => {
    montar();
    const topo = barra();
    const trilha = within(topo).getByRole("navigation", { name: "Trilha" });
    expect(
      within(trilha)
        .getAllByRole("listitem")
        .map((i) => i.textContent),
    ).toEqual(["Pessoas", "Colaboradores"]);
    expect(within(trilha).getByText("Colaboradores")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const icone = topo.querySelector(".barra-superior__trilha-icone");
    expect(icone).toHaveAttribute("aria-hidden", "true");
    expect(icone?.querySelector("svg")).not.toBeNull();
  });

  it("marca e recolher no topo da faixa lateral, na linha da barra — e não duplicados na barra", () => {
    montar();
    const lateral = document.getElementById("navegacao-lateral")!;
    const topoDaFaixa = lateral.querySelector(".app-shell__cabecalho-lateral")!;
    expect(lateral.firstElementChild).toBe(topoDaFaixa);
    expect(
      within(topoDaFaixa as HTMLElement).getByRole("img", { name: "Evolli" }),
    ).toBeInTheDocument();
    expect(
      within(topoDaFaixa as HTMLElement).getByRole("button", {
        name: "Recolher menu",
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(within(barra()).queryByRole("img", { name: "Evolli" })).toBeNull();
    expect(
      within(barra()).queryByRole("button", { name: "Recolher menu" }),
    ).toBeNull();
  });

  it("a trilha acompanha a navegação; numa sub-página, o pai leva de volta", async () => {
    montar({ destinoInicial: "nova-admissao" });
    const trilha = within(barra()).getByRole("navigation", { name: "Trilha" });
    expect(trilha).toHaveTextContent("PessoasColaboradoresNovo colaborador");
    fireEvent.click(
      within(trilha).getByRole("button", { name: "Colaboradores" }),
    );
    await waitFor(() =>
      expect(
        within(barra()).getByRole("navigation", { name: "Trilha" }),
      ).toHaveTextContent(/^PessoasColaboradores$/),
    );
  });

  it("o recolher, no topo da faixa, continua funcionando", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(
      screen.getByRole("button", { name: "Expandir menu" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("navigation", { name: "Navegação do painel" }),
    ).toHaveClass("painel-nav--trilho");
  });
});

describe("T209 — barra superior: conta", () => {
  it("só o nome de exibição — nunca e-mail, papel, empresa ou identificador", () => {
    montar();
    const topo = barra();
    expect(botaoConta()).toHaveAccessibleName("Conta: Ana Paula Sintética");
    expect(topo).toHaveTextContent("Ana Paula Sintética");
    expect(topo).not.toHaveTextContent(EMAIL);
    expect(topo).not.toHaveTextContent("Empresa Alfa");
    expect(topo).not.toHaveTextContent(/\bRH\b/);
    expect(topo.innerHTML).not.toContain(EMPRESA.id);
    expect(topo.querySelector(".app-shell__contexto")).toBeNull();
  });

  it("sem nome de exibição: 'Minha conta' e avatar neutro, sem derivar nada do e-mail", () => {
    montar({ contaDoAtor: conta(null) });
    expect(botaoConta()).toHaveAccessibleName("Conta: Minha conta");
    expect(barra()).not.toHaveTextContent("pessoa.sintetica");
    expect(barra().querySelector(".barra-superior__iniciais")).toBeNull();
  });

  it("sem foto, as iniciais do nome no avatar (decorativo)", () => {
    montar();
    const iniciais = botaoConta().querySelector(".barra-superior__iniciais");
    expect(iniciais).toHaveTextContent("AS");
    expect(iniciais?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("com foto, a foto da própria conta pela rota autenticada, decorativa", () => {
    montar({ contaDoAtor: conta("Ana Paula Sintética", "v7") });
    const foto = botaoConta().querySelector("img")!;
    expect(foto).toHaveAttribute("alt", "");
    expect(foto.getAttribute("src")).toMatch(/\/users\/me\/foto/);
  });

  it("menu da conta pelo teclado: Meu perfil, Sessões ativas e Sair; Escape fecha e devolve o foco", async () => {
    montar();
    const menu = await abrirMenuDaConta();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Meu perfil", "Sessões ativas", "Sair"]);
    expect(botaoConta()).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(botaoConta()).toHaveFocus();
  });

  it("com MFA disponível, Segurança também entra no menu", async () => {
    montar({ mfaDisponivel: true });
    const menu = await abrirMenuDaConta();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Meu perfil", "Segurança", "Sessões ativas", "Sair"]);
  });

  it("'Meu perfil' abre Configurações › Meu perfil", async () => {
    montar();
    fireEvent.click(
      within(await abrirMenuDaConta()).getByRole("menuitem", {
        name: "Meu perfil",
      }),
    );
    await waitFor(() =>
      expect(window.location.hash).toBe("#/configuracoes/meu-perfil"),
    );
  });

  it("'Sair' sai (pela guarda de saída, como antes)", async () => {
    const { onLogout } = montar();
    fireEvent.click(
      within(await abrirMenuDaConta()).getByRole("menuitem", { name: "Sair" }),
    );
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  // T215 — leva à página Segurança › Sessões ativas (o mesmo conteúdo).
  it("'Sessões ativas' leva à página de Segurança", async () => {
    montar();
    fireEvent.click(
      within(await abrirMenuDaConta()).getByRole("menuitem", {
        name: "Sessões ativas",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: /Sessões ativas/ }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/seguranca/sessoes-ativas");
  });

  it("clique fora fecha o menu", async () => {
    montar();
    await abrirMenuDaConta();
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("sem sessão (sem onLogout), não há controle de conta", () => {
    render(<App papelDoAtor="rh" destinoInicial="pessoas" />);
    expect(
      within(barra()).queryByRole("button", {
        name: /^Conta: /,
      }),
    ).toBeNull();
  });
});

describe("T209 — Hub fora da barra", () => {
  it("nenhum botão ou texto 'Hub' na barra, mesmo com onVoltarAoHub", () => {
    montar({ onVoltarAoHub: vi.fn() });
    expect(barra()).not.toHaveTextContent(/\bHub\b/);
    expect(screen.queryByRole("button", { name: "Hub" })).toBeNull();
  });
});

describe("T209 — barra superior no celular (375 px)", () => {
  it("botão Menu, marca e conta; a trilha some, o nome segue no nome acessível", () => {
    act(() => definirLarguraDaJanela(375));
    montar();
    const topo = barra();
    expect(
      within(topo).getByRole("button", { name: "Menu" }),
    ).toBeInTheDocument();
    expect(botaoConta()).toHaveAccessibleName("Conta: Ana Paula Sintética");
    // No celular a faixa é gaveta: a marca vem para a barra.
    const marca = within(topo).getByRole("img", { name: "Evolli" });
    expect(marca.getAttribute("src")).toMatch(/evolli-horizontal\.svg$/);
    // T210 — até 400 px o navegador troca para o símbolo (prancha da marca).
    expect(
      marca.closest("picture")?.querySelector("source")?.getAttribute("srcset"),
    ).toMatch(/evolli-symbol\.svg$/);
    expect(
      within(topo).queryByRole("button", { name: "Recolher menu" }),
    ).toBeNull();
  });
});

describe("T209 — barra superior: CSS", () => {
  const css = readFileSync("src/app/BarraSuperior.css", "utf8").replace(
    /\r\n/g,
    "\n",
  );

  it("fica no topo (sticky, sem sair do fluxo) e o foco não some debaixo dela", () => {
    expect(css).toMatch(
      /\.barra-superior \{[^}]*position: sticky;[^}]*top: 0;/,
    );
    expect(css).toMatch(/scroll-padding-top: var\(--altura-barra-superior\)/);
  });

  it("só tokens; nome truncado com reticências; sem animação fora de no-preference", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).toMatch(
      /\.barra-superior__nome \{[^}]*text-overflow: ellipsis;/,
    );
    const semPreferencia = css.replace(
      /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g,
      "",
    );
    expect(semPreferencia).not.toMatch(/transition|animation/);
  });

  it("no celular a trilha some e os alvos têm 44 px", () => {
    expect(css).toMatch(
      /@media \(max-width: 834px\) \{[\s\S]*\.barra-superior__trilha \{[^}]*display: none;/,
    );
    expect(css).toMatch(/min-height: var\(--touch-target\)/);
  });
});
