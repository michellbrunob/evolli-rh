/**
 * T211 — organização do menu (decisões M1 a M8 do dossiê da T211): só a
 * navegação muda. Colaboradores reúne Escala de trabalho e Organograma;
 * Equipe e permissões vai para Configurações; Ponto e Administração da
 * liderança saem do menu com URL própria; Liderança vira item direto de
 * Pessoas; sem Operação e sem Demonstração no menu.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { PainelNavigation } from "./PainelNavigation";
import { MENU_LATERAL } from "./menuLateral";
import { destinoDaRota, rotaDoDestino } from "./rotasDoShell";
import { trilhaDoDestino } from "./trilhaDoShell";
import { NavegacaoConfiguracoes } from "../screens/configuracoes/NavegacaoConfiguracoes";
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

beforeEach(() => {
  vi.mocked(listarEmpresasDoContexto).mockReset();
  vi.mocked(listarEmpresasDoContexto).mockResolvedValue([]);
  window.history.replaceState(null, "", window.location.pathname);
});
afterEach(() => {
  window.history.replaceState(null, "", window.location.pathname);
});

function montarMenu(papel: string, destinoAtivoId = "pessoas") {
  const onSelecionar = vi.fn();
  render(
    <PainelNavigation
      destinoAtivoId={destinoAtivoId}
      onSelecionar={onSelecionar}
      papel={papel}
    />,
  );
  return { onSelecionar };
}

const navegacao = () =>
  screen.getByRole("navigation", { name: "Navegação do painel" });

/** Rótulos visíveis dos itens de primeiro nível, na ordem. */
function primeiroNivel(): string[] {
  return [
    ...navegacao().querySelectorAll(
      ".painel-nav__modulo > button .painel-nav__rotulo",
    ),
  ].map((r) => r.firstChild?.textContent ?? "");
}

/** Rótulos do submenu de um módulo expandido. */
function submenuDe(rotulo: string): string[] {
  const cabecalho = within(navegacao()).getByRole("button", {
    name: rotulo,
    expanded: true,
  });
  const regiao = document.getElementById(
    cabecalho.getAttribute("aria-controls")!,
  )!;
  return [...regiao.querySelectorAll(".painel-nav__rotulo")].map(
    (r) => r.firstChild?.textContent ?? "",
  );
}

describe("T211 — árvore do menu", () => {
  it("RH: primeiro nível na ordem, com Liderança depois de Calendário e o rodapé de sempre", () => {
    montarMenu("rh");
    expect(primeiroNivel()).toEqual([
      "Dashboard",
      "Portal",
      "Colaboradores",
      "Recrutamento",
      "Pesquisas",
      "Calendário",
      "Liderança",
      "Folha de Pagamento",
      "Benefícios",
      "Hub de Benefícios",
      "Suporte",
      "Roadmap",
      "Configurações",
    ]);
  });

  it("seções: só Pessoas e Remuneração têm título (sem Operação e sem Demonstração)", () => {
    montarMenu("rh");
    const titulos = [
      ...navegacao().querySelectorAll(".painel-nav__secao-titulo"),
    ].map((t) => t.textContent);
    expect(titulos).toEqual(["Pessoas", "Remuneração"]);
    expect(MENU_LATERAL.map((s) => s.id)).toEqual([
      "inicio",
      "pessoas",
      "remuneracao",
      "rodape",
    ]);
  });

  it("Colaboradores: Colaboradores, Escala de trabalho, Organograma e Desenvolvimento (em desenvolvimento)", () => {
    montarMenu("rh");
    expect(submenuDe("Colaboradores")).toEqual([
      "Colaboradores",
      "Escala de trabalho",
      "Organograma",
      "Desenvolvimento",
    ]);
    expect(
      within(navegacao()).getByRole("button", {
        name: /^Desenvolvimento Em desenvolvimento$/,
      }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("Escala de trabalho e Organograma abrem os destinos de sempre", () => {
    const { onSelecionar } = montarMenu("rh");
    fireEvent.click(
      within(navegacao()).getByRole("button", { name: /^Escala de trabalho/ }),
    );
    fireEvent.click(
      within(navegacao()).getByRole("button", { name: /^Organograma/ }),
    );
    expect(onSelecionar.mock.calls).toEqual([
      ["jornadas-trabalho"],
      ["cadastros"],
    ]);
  });

  it("nada de Estrutura, Jornada, Operação, Contas de acesso, Administração da liderança ou Demonstração no menu", () => {
    montarMenu("rh");
    const texto = navegacao().textContent ?? "";
    for (const ausente of [
      "Estrutura organizacional",
      "Jornadas de trabalho",
      "Operação",
      "Contas de acesso",
      "Equipe e permissões",
      "Administração da liderança",
      "Demonstração",
    ]) {
      expect(texto, ausente).not.toContain(ausente);
    }
    // Nenhuma entrada do menu aponta para os grupos que saíram dele.
    const gruposNoMenu = MENU_LATERAL.flatMap((s) =>
      s.entradas.flatMap((e) => (e.tipo === "modulo" ? [e.grupo] : [])),
    );
    expect(gruposNoMenu).toEqual([
      "Dashboard",
      "Gestão de Pessoas",
      "Liderança",
      "Configurações",
    ]);
    // "Jornada" (Ponto) também não é item.
    expect(primeiroNivel()).not.toContain("Jornada");
  });

  it.each([
    ["gestor", true],
    ["rh", true],
    ["dp", false],
    ["master_tecnico", false],
  ])("%s: Liderança como item direto (sem submenu) = %s", (papel, aparece) => {
    const { onSelecionar } = montarMenu(papel, "equipe");
    const lideranca = within(navegacao()).queryByRole("button", {
      name: /^Liderança/,
    });
    if (!aparece) {
      expect(lideranca).toBeNull();
      return;
    }
    expect(lideranca).not.toHaveAttribute("aria-expanded");
    expect(lideranca).toHaveAttribute("aria-current", "page");
    fireEvent.click(lideranca!);
    expect(onSelecionar).toHaveBeenCalledWith("equipe");
  });

  it("Organograma aberto: Colaboradores fica marcado e expandido, com Organograma atual", () => {
    montarMenu("rh", "cadastros");
    expect(submenuDe("Colaboradores")).toContain("Organograma");
    expect(
      within(navegacao()).getByRole("button", { name: /^Organograma/ }),
    ).toHaveAttribute("aria-current", "page");
  });
});

describe("T211 — rotas", () => {
  it.each([
    ["contas-acesso", "#/configuracoes/equipe-e-permissoes"],
    ["ponto", "#/jornada/ponto"],
    ["administracao-lideranca", "#/lideranca/administracao"],
  ])("%s ganha a URL %s, de ida e volta", (destino, rota) => {
    expect(rotaDoDestino(destino)).toBe(rota);
    expect(destinoDaRota(rota)).toBe(destino);
  });

  it.each([
    ["pessoas", "#/pessoas/colaboradores"],
    ["jornadas-trabalho", "#/estrutura/jornadas-trabalho"],
    ["configuracoes", "#/configuracoes/meu-perfil"],
    ["configuracoes-aparencia", "#/configuracoes/aparencia"],
    ["configuracoes-empresas", "#/configuracoes/empresas"],
  ])("a URL de %s continua %s", (destino, rota) => {
    expect(rotaDoDestino(destino)).toBe(rota);
    expect(destinoDaRota(rota)).toBe(destino);
  });
});

describe("T211 — trilha", () => {
  it.each([
    ["jornadas-trabalho", ["Pessoas", "Colaboradores", "Escala de trabalho"]],
    ["cadastros", ["Pessoas", "Colaboradores", "Organograma"]],
    ["equipe", ["Pessoas", "Liderança", "Minha equipe"]],
    ["contas-acesso", ["Configurações", "Equipe e permissões"]],
  ])("%s: %j", (destino, esperado) => {
    expect(trilhaDoDestino(destino).map((i) => i.rotulo)).toEqual(esperado);
  });
});

describe("T211 — Equipe e permissões em Configurações", () => {
  it("item do grupo Empresa, depois de Empresas, com a URL própria", () => {
    render(
      <NavegacaoConfiguracoes
        atual="equipe-e-permissoes"
        mostrarEmpresas
        mostrarEquipe
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Configurações" });
    const empresa = within(nav).getByRole("list", { name: "Empresa" });
    const links = within(empresa).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Empresas",
      "Equipe e permissões",
    ]);
    expect(links[1]).toHaveAttribute(
      "href",
      "#/configuracoes/equipe-e-permissoes",
    );
    expect(links[1]).toHaveAttribute("aria-current", "page");
  });

  it("sem a capacidade, o item não aparece; o grupo Empresa aparece só com algum item", () => {
    const { rerender } = render(<NavegacaoConfiguracoes atual="meu-perfil" />);
    const nav = () => screen.getByRole("navigation", { name: "Configurações" });
    expect(within(nav()).queryByText("Empresa")).toBeNull();
    rerender(<NavegacaoConfiguracoes atual="meu-perfil" mostrarEquipe />);
    expect(
      within(nav()).getByRole("link", { name: "Equipe e permissões" }),
    ).toBeInTheDocument();
    expect(within(nav()).queryByRole("link", { name: "Empresas" })).toBeNull();
  });

  it.each([
    ["rh", true],
    ["dp", true],
    ["master_tecnico", true],
    ["gestor", false],
  ])("App em Meu perfil — %s vê Equipe e permissões: %s", (papel, ve) => {
    window.history.replaceState(null, "", "/#/configuracoes/meu-perfil");
    render(<App papelDoAtor={papel} destinoInicial="configuracoes" />);
    const nav = screen.getByRole("navigation", { name: "Configurações" });
    const link = within(nav).queryByRole("link", {
      name: "Equipe e permissões",
    });
    if (ve)
      expect(link).toHaveAttribute(
        "href",
        "#/configuracoes/equipe-e-permissoes",
      );
    else expect(link).toBeNull();
  });

  it("a URL abre Contas de acesso (a mesma tela), com Configurações marcado no menu", () => {
    window.history.replaceState(
      null,
      "",
      "/#/configuracoes/equipe-e-permissoes",
    );
    render(<App papelDoAtor="rh" destinoInicial="contas-acesso" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Contas de acesso" }),
    ).toBeInTheDocument();
    expect(
      within(navegacao()).getByRole("button", { name: /^Configurações/ }),
    ).toHaveAttribute("aria-current", "page");
  });
});

describe("T211 — fora do menu, com URL própria", () => {
  it("Ponto abre pela URL própria", () => {
    window.history.replaceState(null, "", "/#/jornada/ponto");
    render(<App papelDoAtor="rh" destinoInicial="ponto" />);
    expect(window.location.hash).toBe("#/jornada/ponto");
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("Administração da liderança abre pela URL própria (RH)", () => {
    window.history.replaceState(null, "", "/#/lideranca/administracao");
    render(<App papelDoAtor="rh" destinoInicial="administracao-lideranca" />);
    expect(window.location.hash).toBe("#/lideranca/administracao");
  });

  it("gestor segue entrando por Minha equipe", () => {
    render(<App papelDoAtor="gestor" />);
    expect(
      within(navegacao()).getByRole("button", { name: /^Liderança/ }),
    ).toHaveAttribute("aria-current", "page");
  });
});
