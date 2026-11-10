/**
 * T205 — o Dashboard no shell: rota (`#/dashboard?ano=AAAA`), correção do ano
 * no lugar, histórico deliberado (trocar de ano empilha; voltar e avançar
 * percorrem os anos), recarga, papéis que o abrem, menu, atalhos para a
 * listagem de Colaboradores (com volta e foco) e a guarda de saída.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ComGuardaDeSaida } from "../test/ComGuardaDeSaida";
import { listarColaboradores } from "../api/colaboradoresClient";
import { listarMovimentacoes } from "../api/movimentacaoClient";
import type { MovimentacaoApi } from "../api/movimentacaoClient";
import { listarCargos } from "../api/cargoClient";
import { listarDepartamentos } from "../api/organizacaoClient";
import { listarEquipe } from "../api/gestorClient";

vi.mock("../api/colaboradoresClient");
vi.mock("../api/movimentacaoClient");
vi.mock("../api/cargoClient");
vi.mock("../api/organizacaoClient");
vi.mock("../api/gestorClient");

const AGORA = new Date(2026, 10, 9, 12, 0, 0);
const EMPRESA = {
  id: "empresa-sintetica",
  codigo: "ALFA",
  nome: "Empresa Alfa",
};

function paginado<T>(itens: T[]) {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

let n = 0;
function mov(tipo: "admissao" | "desligamento", vigenciaInicio: string) {
  n += 1;
  return {
    id: `m-${n}`,
    vinculoId: `v-${n}`,
    empresaId: EMPRESA.id,
    tipo,
    status: "efetivada",
    vigenciaInicio,
  } as MovimentacaoApi;
}

const MOVIMENTACOES = [
  mov("admissao", "2026-02-10"),
  mov("admissao", "2025-05-10"),
  mov("admissao", "2025-06-10"),
  mov("desligamento", "2024-03-10"),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  window.history.replaceState(null, "", "/");
  vi.mocked(listarColaboradores).mockResolvedValue({
    ...paginado([]),
    total: 3,
    contadores: {
      ativos: 3,
      inativos: 0,
      emAdmissao: 1,
      desligados: 0,
      total: 4,
      ativosPorTipo: {
        clt: 2,
        estagio: 1,
        pj: 0,
        temporario: 0,
        outro_controlado: 0,
      },
    },
  });
  vi.mocked(listarMovimentacoes).mockImplementation(async (q = {}) =>
    paginado(
      MOVIMENTACOES.filter((m) => m.tipo === q.tipo).sort((a, b) =>
        a.vigenciaInicio < b.vigenciaInicio ? 1 : -1,
      ),
    ),
  );
  vi.mocked(listarCargos).mockResolvedValue(paginado([]) as never);
  vi.mocked(listarDepartamentos).mockResolvedValue(paginado([]) as never);
  vi.mocked(listarEquipe).mockResolvedValue({
    dataReferencia: "2026-11-09",
    itens: [],
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

/** O que o navegador faz no "voltar"/"avançar": a URL, e `popstate`. */
function navegadorVaiPara(fragmento: string) {
  act(() => {
    window.history.replaceState(null, "", `/${fragmento}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

function montar(
  rota: string,
  papel = "rh",
  empresa: typeof EMPRESA | null = EMPRESA,
) {
  window.history.replaceState(null, "", `/${rota}`);
  return render(
    <ComGuardaDeSaida>
      <App papelDoAtor={papel} empresaAtiva={empresa} />
    </ComGuardaDeSaida>,
  );
}

const anoDaTabela = () =>
  screen.getByRole("table").getAttribute("aria-label") ??
  screen.getByRole("table").querySelector("caption")?.textContent;

function statusDoDashboard() {
  return document.querySelector<HTMLElement>(".dashboard [role=status]")!;
}

async function esperarLeitura(ano: number) {
  await waitFor(() =>
    expect(statusDoDashboard()).toHaveTextContent(
      `Dashboard de ${ano} lido em`,
    ),
  );
}

describe("T205 — rota do Dashboard no shell", () => {
  it("sem ano: abre no ano corrente e corrige a URL no lugar, sem entrada nova", async () => {
    window.history.replaceState(null, "", "/#/dashboard");
    const entradas = window.history.length;
    render(<App papelDoAtor="rh" empresaAtiva={EMPRESA} />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(window.location.hash).toBe("#/dashboard?ano=2026"),
    );
    expect(window.history.length).toBe(entradas);
    await esperarLeitura(2026);
  });

  it.each([
    "#/dashboard?ano=2031",
    "#/dashboard?ano=19x9",
    "#/dashboard?ano=1999",
  ])(
    "ano inválido ou futuro (%s): corrigido no lugar, e a leitura é do ano corrente",
    async (rota) => {
      window.history.replaceState(null, "", `/${rota}`);
      const entradas = window.history.length;
      render(<App papelDoAtor="rh" empresaAtiva={EMPRESA} />);
      await esperarLeitura(2026);
      expect(window.location.hash).toBe("#/dashboard?ano=2026");
      expect(window.history.length).toBe(entradas);
    },
  );

  it("recarga mantém o ano da URL", async () => {
    const { unmount } = montar("#/dashboard?ano=2024");
    await esperarLeitura(2024);
    expect(anoDaTabela()).toMatch(/em 2024$/);
    unmount();
    montar("#/dashboard?ano=2024");
    await esperarLeitura(2024);
    expect(window.location.hash).toBe("#/dashboard?ano=2024");
  });

  it("trocar de ano empilha; voltar e avançar percorrem os anos (com releitura e URL coerente)", async () => {
    montar("#/dashboard?ano=2026");
    await esperarLeitura(2026);
    const entradas = window.history.length;
    fireEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
    await waitFor(() =>
      expect(window.location.hash).toBe("#/dashboard?ano=2025"),
    );
    expect(window.history.length).toBe(entradas + 1);
    await esperarLeitura(2025);
    expect(
      within(screen.getByRole("table")).getAllByRole("row").at(-1),
    ).toHaveTextContent("Total20+2");

    navegadorVaiPara("#/dashboard?ano=2026");
    await esperarLeitura(2026);
    expect(screen.getByRole("combobox", { name: "Ano" })).toHaveValue("2026");
    navegadorVaiPara("#/dashboard?ano=2025");
    await esperarLeitura(2025);
    expect(screen.getByRole("combobox", { name: "Ano" })).toHaveValue("2025");
  });

  it("voltar para um ano inválido: o corrente, com a URL corrigida no lugar", async () => {
    montar("#/dashboard?ano=2025");
    await esperarLeitura(2025);
    navegadorVaiPara("#/dashboard?ano=2099");
    await esperarLeitura(2026);
    expect(window.location.hash).toBe("#/dashboard?ano=2026");
  });
});

describe("T205 — quem abre o Dashboard (D-2, D-6)", () => {
  it.each(["rh", "dp", "master_tecnico"])(
    "%s com empresa ativa abre o Dashboard e lê os dados",
    async (papel) => {
      montar("#/dashboard?ano=2026", papel);
      await esperarLeitura(2026);
      expect(listarColaboradores).toHaveBeenCalledWith({ tamanhoPagina: 1 });
    },
  );

  it("master_tecnico sem empresa ativa: orientação e nenhuma consulta", async () => {
    montar("#/dashboard?ano=2026", "master_tecnico", null);
    expect(
      await screen.findByText(
        "Escolha uma empresa ativa no menu para ver o Dashboard.",
      ),
    ).toBeVisible();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(listarColaboradores).not.toHaveBeenCalled();
    expect(listarMovimentacoes).not.toHaveBeenCalled();
  });

  it.each([
    ["gestor", "Minha equipe"],
    ["colaborador", "Visão geral"],
    ["financeiro", "Visão geral"],
  ])(
    "%s com a URL do Dashboard: não monta o Dashboard, não lê nada dele, URL corrigida",
    async (papel, titulo) => {
      montar("#/dashboard?ano=2026", papel);
      expect(
        await screen.findByRole("heading", { level: 1, name: titulo }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { level: 1, name: "Dashboard" }),
      ).toBeNull();
      expect(listarMovimentacoes).not.toHaveBeenCalled();
      expect(window.location.hash).not.toContain("dashboard");
      const nav = screen.getByRole("navigation", {
        name: "Navegação do painel",
      });
      expect(
        within(nav).queryByRole("button", { name: /^Dashboard/ }),
      ).toBeNull();
    },
  );

  it("menu: Dashboard é o primeiro item para o rh e abre no ano corrente", async () => {
    montar("#/dashboard?ano=2024");
    await esperarLeitura(2024);
    const nav = screen.getByRole("navigation", { name: "Navegação do painel" });
    const primeiro = within(nav).getAllByRole("button")[0]!;
    expect(primeiro).toHaveTextContent(/^Dashboard/);
    expect(primeiro).toHaveAttribute("aria-current", "page");
    fireEvent.click(
      within(nav).getByRole("button", { name: /^Colaboradores/ }),
    );
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    fireEvent.click(within(nav).getAllByRole("button")[0]!);
    await esperarLeitura(2026);
    expect(window.location.hash).toBe("#/dashboard?ano=2026");
  });
});

describe("T205 — atalhos para a listagem (D-5)", () => {
  it("'Pessoas ativas hoje' abre Colaboradores (aba Ativos), empilha a URL e não deixa o foco no body; voltar retorna ao ano e ao título", async () => {
    montar("#/dashboard?ano=2025");
    await esperarLeitura(2025);
    const entradas = window.history.length;
    const link = screen.getByRole("link", { name: /Pessoas ativas hoje/ });
    link.focus();
    fireEvent.click(link);
    await screen.findByRole("heading", { level: 1, name: "Colaboradores" });
    expect(window.location.hash).toBe("#/pessoas/colaboradores");
    expect(window.history.length).toBe(entradas + 1);
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));

    // Voltar: o navegador leva o foco embora com a tela que sai.
    (document.activeElement as HTMLElement | null)?.blur();
    navegadorVaiPara("#/dashboard?ano=2025");
    await esperarLeitura(2025);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Ano" })).toHaveValue("2025");
  });

  it("'Pessoas em admissão hoje' e cada tipo abrem a listagem com a aba e o tipo que ela aceita", async () => {
    montar("#/dashboard?ano=2026");
    await esperarLeitura(2026);
    fireEvent.click(screen.getByRole("link", { name: /^Estágio:/ }));
    await waitFor(() =>
      expect(window.location.hash).toBe("#/pessoas/colaboradores?tipo=estagio"),
    );
    navegadorVaiPara("#/dashboard?ano=2026");
    await esperarLeitura(2026);
    fireEvent.click(
      screen.getByRole("link", { name: /Pessoas em admissão hoje/ }),
    );
    await waitFor(() =>
      expect(window.location.hash).toBe(
        "#/pessoas/colaboradores?aba=em-admissao",
      ),
    );
  });
});
