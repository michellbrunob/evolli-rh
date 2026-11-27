/**
 * T215 — módulo Segurança, no rodapé do menu, logo acima de Roadmap, com a
 * mesma organização de Configurações (título do módulo, navegação interna e
 * painel):
 *
 * - **Sessões ativas** (a página inicial do módulo, de toda conta): o mesmo
 *   conteúdo do antigo painel da barra; "Sessões ativas" no menu da conta
 *   agora leva a esta página.
 * - **Permissões de acesso** (as Contas de acesso, que saem de
 *   Configurações): só para quem tem a capacidade de sempre.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { PainelNavigation } from "./PainelNavigation";
import { MENU_LATERAL } from "./menuLateral";
import { capacidadeFuncionalDe } from "./mapaNavegacao";
import { destinoDaRota, rotaDoDestino } from "./rotasDoShell";
import { iconeDaTrilha, trilhaDoDestino } from "./trilhaDoShell";
import { NavegacaoSeguranca } from "../screens/seguranca/NavegacaoSeguranca";
import { listarEmpresasDoContexto } from "../api/contextoEmpresarialClient";
import { listarSessoesAtivas } from "../api/sessoesClient";

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

vi.mock("../api/sessoesClient", async () => {
  const actual = await vi.importActual<typeof import("../api/sessoesClient")>(
    "../api/sessoesClient",
  );
  return { ...actual, listarSessoesAtivas: vi.fn(), revogarSessao: vi.fn() };
});

const ROTA_SESSOES = "#/seguranca/sessoes-ativas";
const ROTA_PERMISSOES = "#/seguranca/permissoes-de-acesso";
const PAPEIS_COM_PERMISSOES = ["rh", "dp", "master_tecnico"];
const PAPEIS_SEM_PERMISSOES = [
  "gestor",
  "financeiro",
  "colaborador",
  "auditor",
  "dpo",
  "admin_tecnico",
];

beforeEach(() => {
  vi.mocked(listarEmpresasDoContexto).mockReset();
  vi.mocked(listarEmpresasDoContexto).mockResolvedValue([]);
  vi.mocked(listarSessoesAtivas).mockReset();
  vi.mocked(listarSessoesAtivas).mockResolvedValue([]);
  window.history.replaceState(null, "", window.location.pathname);
});
afterEach(() => {
  window.history.replaceState(null, "", window.location.pathname);
});

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

function montarMenu(papel: string, destinoAtivoId = "configuracoes") {
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

async function itemDaConta(nome: string): Promise<HTMLElement> {
  const conta = screen.getByRole("button", { name: /^Conta: / });
  if (conta.getAttribute("aria-expanded") !== "true") {
    fireEvent.keyDown(conta, { key: "Enter" });
  }
  return screen.findByRole("menuitem", { name: nome });
}

describe("T215 — Segurança no menu", () => {
  it.each([...PAPEIS_COM_PERMISSOES, ...PAPEIS_SEM_PERMISSOES])(
    "%s: Segurança no rodapé, logo acima de Roadmap",
    (papel) => {
      montarMenu(papel);
      expect(primeiroNivel().slice(-4)).toEqual([
        "Suporte",
        "Segurança",
        "Roadmap",
        "Configurações",
      ]);
    },
  );

  it("Segurança é item direto: abre Sessões ativas", () => {
    const { onSelecionar } = montarMenu("rh");
    const seguranca = within(navegacao()).getByRole("button", {
      name: /^Segurança/,
    });
    expect(seguranca).not.toHaveAttribute("aria-expanded");
    fireEvent.click(seguranca);
    expect(onSelecionar).toHaveBeenCalledWith("seguranca");
  });

  it.each(["seguranca", "contas-acesso"])(
    "com %s aberto, Segurança fica marcado e Configurações não",
    (destino) => {
      montarMenu("rh", destino);
      expect(
        within(navegacao()).getByRole("button", { name: /^Segurança/ }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        within(navegacao()).getByRole("button", { name: /^Configurações/ }),
      ).not.toHaveAttribute("aria-current");
    },
  );

  it("o menu aponta para o módulo Segurança, antes de Configurações", () => {
    const gruposNoMenu = MENU_LATERAL.flatMap((s) =>
      s.entradas.flatMap((e) => (e.tipo === "modulo" ? [e.grupo] : [])),
    );
    expect(gruposNoMenu).toEqual([
      "Dashboard",
      "Gestão de Pessoas",
      // T216 — Pesquisas (Pessoas › Pesquisas).
      "Pesquisas",
      "Liderança",
      // T215 — Benefícios (Remuneração).
      "Benefícios",
      "Segurança",
      "Configurações",
    ]);
  });

  it("capacidade: Sessões ativas para toda conta; permissões só para quem já as tinha", () => {
    const ids = (papel: string) =>
      capacidadeFuncionalDe(papel).map((d) => d.id);
    for (const papel of PAPEIS_COM_PERMISSOES) {
      expect(ids(papel), papel).toEqual(
        expect.arrayContaining(["seguranca", "contas-acesso"]),
      );
    }
    for (const papel of PAPEIS_SEM_PERMISSOES) {
      expect(ids(papel), papel).toContain("seguranca");
      expect(ids(papel), papel).not.toContain("contas-acesso");
    }
    expect(ids("papel_desconhecido")).toEqual([]);
  });
});

describe("T215 — rotas e trilha de Segurança", () => {
  it.each([
    ["seguranca", ROTA_SESSOES],
    ["contas-acesso", ROTA_PERMISSOES],
  ])("%s tem a URL %s, de ida e volta", (destino, rota) => {
    expect(rotaDoDestino(destino)).toBe(rota);
    expect(destinoDaRota(rota)).toBe(destino);
  });

  it("#/seguranca sozinho leva a Sessões ativas; o endereço antigo de Configurações, às permissões", () => {
    expect(destinoDaRota("#/seguranca")).toBe("seguranca");
    expect(destinoDaRota("#/configuracoes/equipe-e-permissoes")).toBe(
      "contas-acesso",
    );
  });

  it.each([
    ["seguranca", ["Segurança", "Sessões ativas"]],
    ["contas-acesso", ["Segurança", "Permissões de acesso"]],
  ])("trilha de %s: %j, com o ícone do módulo", (destino, esperado) => {
    expect(trilhaDoDestino(destino).map((i) => i.rotulo)).toEqual(esperado);
    expect(iconeDaTrilha(destino)).toBe("seguranca");
  });
});

describe("T215 — navegação interna de Segurança", () => {
  const nav = () => screen.getByRole("navigation", { name: "Segurança" });

  it("Sua conta: Sessões ativas; Empresa: Permissões de acesso, pelas URLs próprias", () => {
    render(
      <NavegacaoSeguranca atual="permissoes-de-acesso" mostrarPermissoes />,
    );
    const conta = within(nav()).getByRole("list", { name: "Sua conta" });
    const empresa = within(nav()).getByRole("list", { name: "Empresa" });
    const [sessoes] = within(conta).getAllByRole("link");
    const [permissoes] = within(empresa).getAllByRole("link");
    expect(sessoes).toHaveTextContent("Sessões ativas");
    expect(sessoes).toHaveAttribute("href", ROTA_SESSOES);
    expect(sessoes).not.toHaveAttribute("aria-current");
    expect(permissoes).toHaveTextContent("Permissões de acesso");
    expect(permissoes).toHaveAttribute("href", ROTA_PERMISSOES);
    expect(permissoes).toHaveAttribute("aria-current", "page");
  });

  it("sem a capacidade, o grupo Empresa não aparece", () => {
    render(<NavegacaoSeguranca atual="sessoes-ativas" />);
    expect(within(nav()).queryByRole("list", { name: "Empresa" })).toBeNull();
    expect(
      within(nav()).getByRole("link", { name: "Sessões ativas" }),
    ).toHaveAttribute("aria-current", "page");
  });
});

describe("T215 — Segurança no shell", () => {
  function tituloUnico() {
    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent("Segurança");
    const main = screen.getByRole("main");
    expect(document.getElementById(main.getAttribute("aria-labelledby")!)).toBe(
      titulos[0],
    );
  }

  it.each(PAPEIS_COM_PERMISSOES)(
    "%s: a URL das permissões abre Segurança, com a navegação interna",
    (papel) => {
      window.history.replaceState(null, "", `/${ROTA_PERMISSOES}`);
      render(<App papelDoAtor={papel} destinoInicial="contas-acesso" />);
      tituloUnico();
      expect(
        screen.getByRole("heading", { level: 2, name: "Permissões de acesso" }),
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole("navigation", { name: "Segurança" })).getByRole(
          "link",
          { name: "Permissões de acesso" },
        ),
      ).toHaveAttribute("aria-current", "page");
      expect(window.location.hash).toBe(ROTA_PERMISSOES);
    },
  );

  it.each(["rh", "gestor", "colaborador"])(
    "%s: a URL de Sessões ativas abre a página, sem botão Fechar",
    async (papel) => {
      window.history.replaceState(null, "", `/${ROTA_SESSOES}`);
      render(<App papelDoAtor={papel} destinoInicial="seguranca" />);
      tituloUnico();
      expect(
        screen.getByRole("heading", { level: 2, name: "Sessões ativas" }),
      ).toBeInTheDocument();
      expect(
        await screen.findByRole("heading", { name: "Nenhuma sessão ativa" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
      expect(window.location.hash).toBe(ROTA_SESSOES);
    },
  );

  it("gestor não vê o item Permissões de acesso", () => {
    window.history.replaceState(null, "", `/${ROTA_SESSOES}`);
    render(<App papelDoAtor="gestor" destinoInicial="seguranca" />);
    expect(
      within(screen.getByRole("navigation", { name: "Segurança" })).queryByRole(
        "link",
        { name: "Permissões de acesso" },
      ),
    ).toBeNull();
  });

  it("o endereço antigo de Configurações abre as permissões e é reescrito", () => {
    window.history.replaceState(
      null,
      "",
      "/#/configuracoes/equipe-e-permissoes",
    );
    render(<App papelDoAtor="rh" destinoInicial="contas-acesso" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Permissões de acesso" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA_PERMISSOES);
  });

  it("Configurações não oferece mais as permissões de acesso", () => {
    window.history.replaceState(null, "", "/#/configuracoes/meu-perfil");
    render(<App papelDoAtor="rh" destinoInicial="configuracoes" />);
    const nav = screen.getByRole("navigation", { name: "Configurações" });
    expect(within(nav).queryByRole("link", { name: /permiss/i })).toBeNull();
    const empresa = within(nav).getByRole("list", { name: "Empresa" });
    expect(
      within(empresa)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Empresas"]);
  });

  it("'Sessões ativas' no menu da conta leva a Segurança › Sessões ativas", async () => {
    render(<App papelDoAtor="rh" onLogout={vi.fn()} />);
    fireEvent.click(await itemDaConta("Sessões ativas"));
    expect(window.location.hash).toBe(ROTA_SESSOES);
    tituloUnico();
    expect(
      within(screen.getByRole("main")).getByRole("heading", {
        level: 2,
        name: "Sessões ativas",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  });
});
