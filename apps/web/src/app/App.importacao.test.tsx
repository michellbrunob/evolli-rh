/**
 * T209 (Bloco C) — a página de importação no shell: rota própria
 * (`#/pessoas/importar`), sub-página de Colaboradores, só para quem admite
 * (RH e DP, a mesma regra da Nova admissão), e aberta pelo painel
 * "Adicionar colaborador".
 */
import {
  fireEvent,
  render as renderSemGuarda,
  screen,
  within,
  type RenderOptions,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComGuardaDeSaida } from "../test/ComGuardaDeSaida";
import { App } from "./App";
import { DESTINOS } from "./mapaNavegacao";
import { destinoAposTrocaDeEmpresa, rotaDoDestino } from "./rotasDoShell";
import {
  admitirColaborador,
  listarColaboradores,
} from "../api/colaboradoresClient";
import {
  listarDepartamentos,
  listarEmpresasMulti,
  listarUnidades,
} from "../api/organizacaoClient";
import { listarCargos } from "../api/cargoClient";

vi.mock("../api/colaboradoresClient", async (original) => ({
  ...(await original<typeof import("../api/colaboradoresClient")>()),
  admitirColaborador: vi.fn(),
  listarColaboradores: vi.fn(),
}));
vi.mock("../api/organizacaoClient", async (original) => ({
  ...(await original<typeof import("../api/organizacaoClient")>()),
  listarEmpresasMulti: vi.fn(),
  listarDepartamentos: vi.fn(),
  listarUnidades: vi.fn(),
}));
vi.mock("../api/cargoClient", async (original) => ({
  ...(await original<typeof import("../api/cargoClient")>()),
  listarCargos: vi.fn(),
}));

vi.setConfig({ testTimeout: 20_000 });

const ROTA = "#/pessoas/importar";
const TITULO = "Importar planilha de colaboradores";

function paginado<T>(itens: T[]) {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

function render(ui: ReactElement, opcoes?: RenderOptions) {
  return renderSemGuarda(ui, { wrapper: ComGuardaDeSaida, ...opcoes });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
  vi.mocked(listarColaboradores).mockResolvedValue({
    ...paginado([]),
    contadores: {
      ativos: 0,
      inativos: 0,
      emAdmissao: 0,
      desligados: 0,
      total: 0,
      ativosPorTipo: {
        clt: 0,
        estagio: 0,
        aprendiz: 0,
        pj: 0,
        temporario: 0,
        outro_controlado: 0,
        part_time: 0,
        freelancer: 0,
        trainee: 0,
      },
    },
  } as never);
  vi.mocked(listarEmpresasMulti).mockResolvedValue(
    paginado([
      { id: "emp-1", codigo: "ALFA", nome: "Empresa Alfa", status: "ativo" },
    ]),
  );
  vi.mocked(listarDepartamentos).mockResolvedValue(paginado([]));
  vi.mocked(listarCargos).mockResolvedValue(paginado([]));
  vi.mocked(listarUnidades).mockResolvedValue(paginado([]) as never);
});

describe("T209 (Bloco C) — rota da importação", () => {
  it("é sub-página de Colaboradores, com rota própria, e volta à listagem ao trocar de empresa", () => {
    const destino = DESTINOS.find((d) => d.id === "importar-colaboradores");
    expect(destino).toMatchObject({
      agrupadoEm: "pessoas",
      papeis: ["rh", "dp"],
    });
    expect(rotaDoDestino("importar-colaboradores")).toBe(ROTA);
    expect(destinoAposTrocaDeEmpresa("importar-colaboradores")).toBe("pessoas");
  });

  it.each(["rh", "dp"] as const)(
    "%s: a URL abre a página, com Colaboradores marcado na barra",
    async (papel) => {
      window.history.replaceState(null, "", `/${ROTA}`);
      render(<App papelDoAtor={papel} />);
      expect(
        await screen.findByRole("heading", { level: 1, name: TITULO }),
      ).toBeInTheDocument();
      expect(window.location.hash).toBe(ROTA);
      const nav = screen.getByRole("navigation", {
        name: "Navegação do painel",
      });
      expect(
        within(nav).getByRole("button", { name: /^Colaboradores Consulta/ }),
      ).toHaveAttribute("aria-current", "page");
    },
  );

  it.each(["master_tecnico", "gestor", "colaborador"] as const)(
    "%s: a URL não monta a página nem envia nada",
    async (papel) => {
      window.history.replaceState(null, "", `/${ROTA}`);
      render(<App papelDoAtor={papel} />);
      await screen.findByRole("navigation", { name: "Navegação do painel" });
      expect(
        screen.queryByRole("heading", { level: 1, name: TITULO }),
      ).toBeNull();
      expect(window.location.hash).not.toBe(ROTA);
      expect(admitirColaborador).not.toHaveBeenCalled();
    },
  );

  it("T212 — rh: no painel, 'Iniciar importação' espera o arquivo do passo 3 (nada abre antes)", async () => {
    render(<App papelDoAtor="rh" destinoInicial="pessoas" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Novo colaborador" }),
    );
    const painel = screen.getByRole("dialog", {
      name: "Adicionar colaborador",
    });
    fireEvent.click(
      within(painel).getByRole("radio", { name: /^Importar planilha/ }),
    );
    const iniciar = within(painel).getByRole("button", {
      name: "Iniciar importação",
    });
    expect(iniciar).toBeDisabled();
    fireEvent.click(iniciar);
    expect(
      screen.queryByRole("heading", { level: 1, name: TITULO }),
    ).toBeNull();
    expect(window.location.hash).not.toBe(ROTA);
  });

  it("T212 — rh: escolher o arquivo no passo 3 do painel abre a página já na conferência", async () => {
    vi.mocked(listarDepartamentos).mockResolvedValue(
      paginado([
        {
          id: "dep-1",
          codigo: "ADM",
          nome: "ADM",
          empresaId: "emp-1",
          status: "ativo",
          criadoEm: "",
          atualizadoEm: "",
        },
      ]) as never,
    );
    vi.mocked(listarCargos).mockResolvedValue(
      paginado([
        {
          id: "car-1",
          codigo: "ANALISTA",
          nome: "ANALISTA",
          empresaId: "emp-1",
          status: "ativo",
          criadoEm: "",
          atualizadoEm: "",
        },
      ]) as never,
    );
    render(<App papelDoAtor="rh" destinoInicial="pessoas" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Novo colaborador" }),
    );
    const painel = screen.getByRole("dialog", {
      name: "Adicionar colaborador",
    });
    fireEvent.click(
      within(painel).getByRole("radio", { name: /^Importar planilha/ }),
    );
    const { ABA_COLABORADORES, montarXlsx } =
      await import("../screens/pessoas/importacao/planilhaXlsx");
    const bytes = montarXlsx([
      {
        nome: ABA_COLABORADORES,
        linhas: [
          "nome;tipo_vinculo;data_admissao;data_nascimento;departamento_codigo;cargo_codigo;matricula;unidade_codigo".split(
            ";",
          ),
          [
            "Pessoa Sintética",
            "clt",
            "01/12/2026",
            "15/05/1990",
            "ADM",
            "ANALISTA",
          ],
        ],
      },
    ]);
    fireEvent.change(
      within(painel).getByLabelText("Arquivo da planilha (.xlsx ou .csv)"),
      {
        target: {
          files: [new File([bytes as unknown as BlobPart], "do-painel.xlsx")],
        },
      },
    );
    fireEvent.click(
      within(painel).getByRole("button", { name: "Iniciar importação" }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: TITULO }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(ROTA);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Conferência" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "1 linha lida: 1 pronta para importar, nenhuma com erro.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Adicionar colaborador" }),
    ).toBeNull();
  });

  it("'Voltar para Colaboradores' sem arquivo volta à listagem", async () => {
    window.history.replaceState(null, "", `/${ROTA}`);
    render(<App papelDoAtor="rh" />);
    await screen.findByRole("heading", { level: 1, name: TITULO });
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/pessoas/colaboradores");
  });
});
