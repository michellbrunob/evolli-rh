/**
 * T208 — Configurações › Meu perfil no shell: rota (`#/configuracoes/meu-perfil`
 * e o atalho `#/configuracoes`), todos os papéis, menu (item próprio, trilho
 * recolhido e gaveta do celular), histórico, recarga, URL inválida, papel
 * desconhecido, foco no título, link de pular e a guarda de saída.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { useEdicaoEmAndamento } from "./edicoesPendentes";
import { ComGuardaDeSaida } from "../test/ComGuardaDeSaida";
import {
  definirLarguraDaJanela,
  redefinirLarguraDaJanela,
} from "../test/viewport";
import type { ContaDoMeuPerfil } from "../screens/configuracoes/MeuPerfilScreen";

vi.mock("../api/contextoEmpresarialClient", async () => {
  const actual = await vi.importActual<
    typeof import("../api/contextoEmpresarialClient")
  >("../api/contextoEmpresarialClient");
  return {
    ...actual,
    listarEmpresasDoContexto: vi.fn().mockResolvedValue([]),
    trocarEmpresaDoContexto: vi.fn(),
  };
});

const ROTA = "#/configuracoes/meu-perfil";
const EMPRESA = {
  id: "empresa-sintetica",
  codigo: "ALFA",
  nome: "Empresa Alfa",
};
const CONTA: ContaDoMeuPerfil = {
  email: "pessoa.teste@example.test",
  role: "rh",
  createdAt: "2026-03-15T12:00:00.000Z",
  empresaAtiva: EMPRESA,
};

const PAPEIS = [
  "rh",
  "dp",
  "master_tecnico",
  "gestor",
  "financeiro",
  "colaborador",
  "auditor",
  "dpo",
  "admin_tecnico",
] as const;

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  redefinirLarguraDaJanela();
  window.history.replaceState(null, "", "/");
});

function montar(
  rota: string | null,
  papel: string,
  opcoes: {
    focarTitulo?: boolean;
    recolhido?: boolean;
    conta?: ContaDoMeuPerfil;
  } = {},
) {
  window.history.replaceState(null, "", rota === null ? "/" : `/${rota}`);
  return render(
    <ComGuardaDeSaida>
      <App
        papelDoAtor={papel}
        empresaAtiva={EMPRESA}
        contaDoAtor={opcoes.conta ?? { ...CONTA, role: papel }}
        focarTituloAoAbrir={opcoes.focarTitulo ?? false}
        {...(opcoes.recolhido ? { menuRecolhido: true } : {})}
      />
    </ComGuardaDeSaida>,
  );
}

const tituloDeConfiguracoes = () =>
  screen.queryByRole("heading", { level: 1, name: "Configurações" });
const navegacao = () =>
  screen.getByRole("navigation", { name: "Navegação do painel" });
const itemDoMenu = () =>
  within(navegacao()).getByRole("button", { name: /^Configurações/ });

/** O que o navegador faz no "voltar"/"avançar": a URL, e `popstate`. */
function navegadorVaiPara(fragmento: string) {
  act(() => {
    window.history.replaceState(null, "", `/${fragmento}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("T208 — rota e papéis", () => {
  it.each(PAPEIS)(
    "%s abre Meu perfil pela rota direta, na forma canônica",
    (papel) => {
      montar(ROTA, papel);
      expect(tituloDeConfiguracoes()).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: "Meu perfil" }),
      ).toBeInTheDocument();
      expect(window.location.hash).toBe(ROTA);
    },
  );

  it("`#/configuracoes` abre Meu perfil e a URL é corrigida no lugar", () => {
    montar("#/configuracoes", "dp");
    expect(tituloDeConfiguracoes()).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA);
  });

  it("caminho sem tela (`#/configuracoes/seguranca`) não é rota: nada de Configurações", () => {
    montar("#/configuracoes/seguranca", "colaborador");
    expect(tituloDeConfiguracoes()).toBeNull();
    // Cai no destino inicial do papel (a Visão geral, que não chama nada).
    expect(screen.getByRole("main")).toHaveAttribute(
      "aria-labelledby",
      "inicio-visao-geral-titulo",
    );
  });

  it("papel desconhecido não abre Configurações pela rota (negação por padrão)", () => {
    montar(ROTA, "papel_desconhecido");
    expect(tituloDeConfiguracoes()).toBeNull();
    expect(window.location.hash).not.toBe(ROTA);
  });

  it("recarregar a rota abre Meu perfil de novo", () => {
    const { unmount } = montar(ROTA, "gestor");
    expect(tituloDeConfiguracoes()).toBeInTheDocument();
    unmount();
    montar(ROTA, "gestor");
    expect(tituloDeConfiguracoes()).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA);
  });
});

describe("T208 — menu, histórico e foco", () => {
  it.each(PAPEIS)(
    "%s tem Configurações como item próprio do menu, na lista da conta",
    (papel) => {
      montar(ROTA, papel);
      const item = itemDoMenu();
      expect(item.closest("ul")).toHaveClass("painel-nav__modulos--conta");
      expect(item).toHaveAttribute("aria-current", "page");
      expect(item).toHaveAttribute("type", "button");
    },
  );

  it("pelo menu: abre Meu perfil e empilha a rota; voltar e avançar percorrem", () => {
    montar(null, "colaborador");
    expect(tituloDeConfiguracoes()).toBeNull();
    fireEvent.click(itemDoMenu());
    expect(tituloDeConfiguracoes()).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA);

    navegadorVaiPara("");
    expect(tituloDeConfiguracoes()).toBeNull();

    navegadorVaiPara(ROTA);
    expect(tituloDeConfiguracoes()).toBeInTheDocument();
  });

  it("ao abrir com o pedido de foco, o título recebe o foco", () => {
    montar(ROTA, "rh", { focarTitulo: true });
    expect(document.activeElement).toBe(tituloDeConfiguracoes());
    expect(screen.getByRole("main")).toHaveAttribute(
      "aria-labelledby",
      "configuracoes-titulo",
    );
  });

  it("recarga (sem foco em lugar nenhum): o título recebe o foco", () => {
    (document.activeElement as HTMLElement | null)?.blur();
    montar(ROTA, "dp");
    expect(document.activeElement).toBe(tituloDeConfiguracoes());
  });

  it("pelo menu: o foco fica no item do menu, não é tomado pela tela", () => {
    montar(null, "colaborador");
    const item = itemDoMenu();
    item.focus();
    fireEvent.click(item);
    expect(tituloDeConfiguracoes()).toBeInTheDocument();
    expect(document.activeElement).toBe(itemDoMenu());
  });

  it("o link de pular leva o foco ao conteúdo sem trocar de tela", () => {
    montar(ROTA, "rh");
    fireEvent.click(
      screen.getByRole("link", { name: "Pular para o conteúdo" }),
    );
    expect(document.activeElement).toBe(screen.getByRole("main"));
    expect(tituloDeConfiguracoes()).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA);
  });

  it("teclado: o item do menu é botão nativo e a navegação interna é um link com aria-current", () => {
    montar(ROTA, "rh");
    const interna = screen.getByRole("navigation", { name: "Configurações" });
    const links = within(interna).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("Meu perfil");
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[0]).toHaveAttribute("href", ROTA);
    expect(itemDoMenu().tagName).toBe("BUTTON");
  });

  it("menu recolhido: Configurações vira ícone do trilho, com o nome acessível e a dica", () => {
    montar(ROTA, "rh", { recolhido: true });
    const item = itemDoMenu();
    expect(item).toHaveAttribute("data-dica", "Configurações");
    expect(item.querySelector("svg.painel-nav__icone")).not.toBeNull();
    expect(item).toHaveAttribute("aria-current", "page");
  });

  it("gaveta do celular (375 px): escolher Configurações abre Meu perfil e fecha a gaveta", () => {
    definirLarguraDaJanela(375);
    montar(null, "colaborador");
    const menu = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(itemDoMenu());
    expect(tituloDeConfiguracoes()).toBeInTheDocument();
    expect(menu).toHaveAttribute("aria-expanded", "false");
  });
});

describe("T208 — gaveta do celular alcança o pé do menu (CSS)", () => {
  it("presa entre o topo e o pé da tela, a gaveta estica (align-self) e rola: Configurações e Demonstração ficam alcançáveis", () => {
    const css = readFileSync("src/app/app-shell.css", "utf8");
    const movel = css.slice(css.indexOf("@media (max-width: 834px)"));
    const inicio = movel.indexOf("\n  .app-shell__sidebar {");
    const regra = movel.slice(inicio, movel.indexOf("}", inicio));
    expect(regra).toMatch(/position:\s*fixed/);
    expect(regra).toMatch(/top:\s*0/);
    expect(regra).toMatch(/bottom:\s*0/);
    // Sem isto, o `align-self: flex-start` do desktop faz a gaveta crescer
    // com o conteúdo (o navegador aplica `align-self` a caixas fixas) e o
    // que passa da altura da tela deixa de ser alcançável.
    expect(regra).toMatch(/align-self:\s*stretch/);
  });
});

function EdicaoPendente() {
  useEdicaoEmAndamento("Formulário sintético", {
    pendente: true,
    salvando: false,
  });
  return null;
}

describe("T208 — guarda de saída sem regressão", () => {
  it("com edição pendente, ir a Configurações pergunta; só sai com 'Sair sem salvar'", () => {
    window.history.replaceState(null, "", "/");
    render(
      <ComGuardaDeSaida>
        <EdicaoPendente />
        <App
          papelDoAtor="colaborador"
          empresaAtiva={EMPRESA}
          contaDoAtor={CONTA}
        />
      </ComGuardaDeSaida>,
    );
    fireEvent.click(itemDoMenu());
    const dialogo = screen.getByRole("alertdialog");
    expect(dialogo).toHaveTextContent("Formulário sintético");
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Continuar editando" }),
    );
    expect(tituloDeConfiguracoes()).toBeNull();

    fireEvent.click(itemDoMenu());
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Sair sem salvar",
      }),
    );
    expect(tituloDeConfiguracoes()).toBeInTheDocument();
  });
});
