/**
 * T211 — organização do menu (decisões M1 a M8 do dossiê da T211): só a
 * navegação muda. Colaboradores reúne Escala de trabalho e Organograma;
 * Equipe e permissões vai para Configurações (T215: e de lá para o módulo
 * Segurança, como Permissões de acesso); Ponto e Administração da
 * liderança saem do menu com URL própria; Liderança vira item direto de
 * Pessoas; sem Operação e sem Demonstração no menu.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { PainelNavigation } from "./PainelNavigation";
import { MENU_LATERAL, PAPEIS_OPERACAO_DE_PESSOAS } from "./menuLateral";
import { capacidadeFuncionalDe } from "./mapaNavegacao";
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

/** Títulos das seções à vista. */
function titulosDeSecao(): string[] {
  return [...navegacao().querySelectorAll(".painel-nav__secao-titulo")].map(
    (t) => t.textContent ?? "",
  );
}

describe("T211 — menu por papel (correção final)", () => {
  it("gestor: só Liderança (Minha equipe) entre os destinos, além de Portal, Suporte, Segurança, Roadmap e Configurações", () => {
    montarMenu("gestor", "equipe");
    // T215 — Segurança (Sessões ativas) é de toda conta.
    expect(primeiroNivel()).toEqual([
      "Portal",
      "Liderança",
      "Suporte",
      "Segurança",
      "Roadmap",
      "Configurações",
    ]);
    expect(titulosDeSecao()).toEqual(["Pessoas"]);
    const texto = navegacao().textContent ?? "";
    for (const ausente of [
      "Colaboradores",
      "Escala de trabalho",
      "Organograma",
      "Desenvolvimento",
      "Recrutamento",
      "Pesquisas",
      "Calendário",
      "Remuneração",
      "Folha de Pagamento",
      "Benefícios",
      "Hub de Benefícios",
      "Empresas",
      "Equipe e permissões",
      "Permissões de acesso",
      "Dashboard",
    ]) {
      expect(texto, ausente).not.toContain(ausente);
    }
    expect(
      within(navegacao()).getByRole("button", { name: /^Liderança/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  it.each(["dp", "master_tecnico"])(
    "%s: a árvore aprovada, sem Liderança",
    (papel) => {
      montarMenu(papel);
      expect(primeiroNivel()).toEqual([
        "Dashboard",
        "Portal",
        "Colaboradores",
        "Recrutamento",
        "Pesquisas",
        "Calendário",
        "Folha de Pagamento",
        "Benefícios",
        "Hub de Benefícios",
        "Suporte",
        // T215 — Segurança, logo acima de Roadmap.
        "Segurança",
        "Roadmap",
        "Configurações",
      ]);
      expect(titulosDeSecao()).toEqual(["Pessoas", "Remuneração"]);
    },
  );

  it("sem papel conhecido, nada que dependa de papel aparece (negação por padrão)", () => {
    render(
      <PainelNavigation destinoAtivoId="pessoas" onSelecionar={() => {}} />,
    );
    const texto = navegacao().textContent ?? "";
    for (const ausente of ["Colaboradores", "Recrutamento", "Remuneração"]) {
      expect(texto, ausente).not.toContain(ausente);
    }
  });

  it("os papéis que veem Pessoas e Remuneração no menu são exatamente os que abrem Colaboradores", () => {
    const comCapacidade = [
      "rh",
      "dp",
      "master_tecnico",
      "gestor",
      "financeiro",
      "colaborador",
      "auditor",
      "dpo",
      "admin_tecnico",
    ].filter((papel) =>
      capacidadeFuncionalDe(papel).some((d) => d.id === "pessoas"),
    );
    expect([...PAPEIS_OPERACAO_DE_PESSOAS].sort()).toEqual(
      comCapacidade.sort(),
    );
    expect(PAPEIS_OPERACAO_DE_PESSOAS).not.toContain("gestor");
  });

  it("App do gestor: a gaveta (375 px) mostra o mesmo menu enxuto", async () => {
    const { definirLarguraDaJanela, redefinirLarguraDaJanela } =
      await import("../test/viewport");
    definirLarguraDaJanela(375);
    try {
      render(<App papelDoAtor="gestor" />);
      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      const gaveta = screen.getByRole("dialog", { name: "Menu de navegação" });
      expect(
        within(gaveta).getByRole("button", { name: /^Liderança/ }),
      ).toBeInTheDocument();
      expect(
        within(gaveta).queryByRole("button", { name: /^Colaboradores/ }),
      ).toBeNull();
      expect(
        within(gaveta).queryByRole("button", { name: /^Folha de Pagamento/ }),
      ).toBeNull();
    } finally {
      redefinirLarguraDaJanela();
    }
  });
});

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
      // T215 — Segurança, logo acima de Roadmap.
      "Segurança",
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
      // T215 — Benefícios (Remuneração).
      "Benefícios",
      // T215 — Segurança (Sessões ativas e Permissões de acesso).
      "Segurança",
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
    // T215 — as permissões de acesso moram em Segurança.
    ["contas-acesso", "#/seguranca/permissoes-de-acesso"],
    ["ponto", "#/jornada/ponto"],
    ["administracao-lideranca", "#/lideranca/administracao"],
    // T215 — o quadro da escala e os turnos, sub-página dele.
    ["jornadas-trabalho", "#/pessoas/escala"],
    ["turnos-escala", "#/pessoas/escala/turnos"],
  ])("%s ganha a URL %s, de ida e volta", (destino, rota) => {
    expect(rotaDoDestino(destino)).toBe(rota);
    expect(destinoDaRota(rota)).toBe(destino);
  });

  it("T215 — o endereço antigo de Escala de trabalho ainda abre o quadro", () => {
    expect(destinoDaRota("#/estrutura/jornadas-trabalho")).toBe(
      "jornadas-trabalho",
    );
  });

  it.each([
    ["pessoas", "#/pessoas/colaboradores"],
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
    // T215 — Turnos, sub-página do quadro.
    [
      "turnos-escala",
      ["Pessoas", "Colaboradores", "Escala de trabalho", "Turnos"],
    ],
    ["cadastros", ["Pessoas", "Colaboradores", "Organograma"]],
    ["equipe", ["Pessoas", "Liderança", "Minha equipe"]],
    // T215 — em Segurança.
    ["contas-acesso", ["Segurança", "Permissões de acesso"]],
  ])("%s: %j", (destino, esperado) => {
    expect(trilhaDoDestino(destino).map((i) => i.rotulo)).toEqual(esperado);
  });
});

describe("T211/T215 — Equipe e permissões saiu de Configurações (agora em Segurança)", () => {
  it("Configurações › Empresa tem só Empresas", () => {
    render(<NavegacaoConfiguracoes atual="empresas" mostrarEmpresas />);
    const nav = screen.getByRole("navigation", { name: "Configurações" });
    const empresa = within(nav).getByRole("list", { name: "Empresa" });
    expect(
      within(empresa)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Empresas"]);
  });

  it("sem Empresas, o grupo Empresa não aparece", () => {
    render(<NavegacaoConfiguracoes atual="meu-perfil" />);
    const nav = screen.getByRole("navigation", { name: "Configurações" });
    expect(within(nav).queryByText("Empresa")).toBeNull();
  });

  it.each(["rh", "dp", "master_tecnico", "gestor"])(
    "App em Meu perfil — %s não vê permissões em Configurações",
    (papel) => {
      window.history.replaceState(null, "", "/#/configuracoes/meu-perfil");
      render(<App papelDoAtor={papel} destinoInicial="configuracoes" />);
      const nav = screen.getByRole("navigation", { name: "Configurações" });
      expect(within(nav).queryByRole("link", { name: /permiss/i })).toBeNull();
    },
  );

  it("o endereço antigo abre Permissões de acesso, com Segurança marcado no menu", () => {
    window.history.replaceState(
      null,
      "",
      "/#/configuracoes/equipe-e-permissoes",
    );
    render(<App papelDoAtor="rh" destinoInicial="contas-acesso" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Permissões de acesso" }),
    ).toBeInTheDocument();
    expect(
      within(navegacao()).getByRole("button", { name: /^Segurança/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(navegacao()).getByRole("button", { name: /^Configurações/ }),
    ).not.toHaveAttribute("aria-current");
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
