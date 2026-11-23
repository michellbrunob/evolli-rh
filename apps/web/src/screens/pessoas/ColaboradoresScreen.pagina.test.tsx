/**
 * T215 — a página inicial de Colaboradores no desenho da referência
 * (decisão de 2026-11-23: textos iguais):
 *
 * - cabeçalho: "Colaboradores", "Gerencie contratos, dados e documentos do
 *   time.", "Exportar" (PDF e Excel) e "Novo colaborador";
 * - três cartões: Colaboradores ativos (com as admissões do mês e os
 *   cadastrados e desligados do ano), Por tipo de contrato e Ausentes hoje;
 * - abas Ativos, Férias e ausências, Escala de trabalho, Organograma,
 *   Desligados e Todos (sem "Em admissão");
 * - busca "Buscar por nome, CPF, e-mail ou ID" e "Filtrar";
 * - tabela: seleção, Colaborador (com o cargo), CPF, Contatos, Salário,
 *   Contrato e o ⋯; no pé, "N resultados".
 */
import {
  fireEvent,
  render as renderSemGuarda,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComGuardaDeSaida } from "../../test/ComGuardaDeSaida";
import { ColaboradoresScreen } from "./ColaboradoresScreen";
import {
  type ColaboradorListadoApi,
  type ContadoresColaboradoresApi,
  listarColaboradores,
} from "../../api/colaboradoresClient";
import {
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarUnidades,
} from "../../api/organizacaoClient";
import { listarCargos } from "../../api/cargoClient";
import { baixarArquivo } from "../dashboard/exportacao";

vi.mock("../../api/colaboradoresClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/colaboradoresClient")
  >("../../api/colaboradoresClient");
  return { ...actual, listarColaboradores: vi.fn() };
});
vi.mock("../../api/organizacaoClient");
vi.mock("../../api/cargoClient");
vi.mock("../../api/vinculoHorarioClient");
vi.mock("../../api/horariosClient");
vi.mock("../dashboard/exportacao", async () => {
  const actual = await vi.importActual<
    typeof import("../dashboard/exportacao")
  >("../dashboard/exportacao");
  return { ...actual, baixarArquivo: vi.fn() };
});

const EMPRESA = { nome: "Empresa Alfa (teste)", codigo: "ALFA" };
const ANO = new Date().getFullYear();

const CONTADORES: ContadoresColaboradoresApi = {
  ativos: 6,
  inativos: 1,
  emAdmissao: 0,
  desligados: 1,
  total: 7,
  desativados: 0,
  ativosPorTipo: {
    clt: 3,
    estagio: 1,
    aprendiz: 0,
    pj: 0,
    temporario: 1,
    outro_controlado: 0,
    part_time: 1,
    freelancer: 0,
    trainee: 0,
  },
  admitidosNoMes: 3,
  desligadosNoAno: 0,
  serieAtivos: [2, 3, 3, 3, 3, 6],
};

function pessoa(
  id: string,
  nome: string,
  extra: Partial<ColaboradorListadoApi> = {},
  cargo: string | null = null,
  tipo: ColaboradorListadoApi["vinculos"][number]["tipo"] = "clt",
): ColaboradorListadoApi {
  return {
    id,
    nome,
    situacao: "ativo",
    criadoEm: "2026-01-01T12:00:00.000Z",
    atualizadoEm: "2026-01-01T12:00:00.000Z",
    vinculos: [
      {
        id: `v-${id}`,
        empresaId: "e-1",
        matricula: null,
        tipo,
        situacao: "ativo",
        dataAdmissao: "2026-01-05",
        dataDesligamento: null,
        lotacaoVigente: {
          cargo: cargo ? { id: "c-1", codigo: "C", nome: cargo } : null,
          departamento: null,
        },
        vigenciasDeJornada: [],
      },
    ],
    ...extra,
  } as ColaboradorListadoApi;
}

const MARIA = pessoa(
  "11111111-1111-4111-8111-111111111111",
  "Maria Teste Santos",
  {
    cpf: "52998224725",
    contatos: {
      emailPessoal: "maria.teste@example.test",
      celular: "+5511912345678",
    },
    salarioBruto: "5000.00",
  },
  "Analista de RH",
);
const PEDRO = pessoa(
  "22222222-2222-4222-8222-222222222222",
  "Pedro Teste",
  { cpf: null, contatos: null, salarioBruto: null },
  null,
  "estagio",
);

function resposta(itens: ColaboradorListadoApi[]) {
  return {
    itens,
    pagina: 1,
    tamanhoPagina: 20,
    total: itens.length,
    contadores: CONTADORES,
  };
}

beforeEach(() => {
  vi.mocked(listarColaboradores).mockReset();
  vi.mocked(listarColaboradores).mockResolvedValue(resposta([MARIA, PEDRO]));
  for (const listar of [
    listarDepartamentos,
    listarAreas,
    listarCentrosCusto,
    listarUnidades,
    listarCargos,
  ]) {
    vi.mocked(listar).mockResolvedValue({
      itens: [],
      pagina: 1,
      tamanhoPagina: 100,
      total: 0,
    } as never);
  }
  vi.mocked(baixarArquivo).mockReset();
});

function render(ui: Parameters<typeof renderSemGuarda>[0]) {
  return renderSemGuarda(ui, { wrapper: ComGuardaDeSaida });
}

function montar(
  props: Partial<Parameters<typeof ColaboradoresScreen>[0]> = {},
) {
  return render(
    <ColaboradoresScreen
      empresaAtiva={EMPRESA}
      onNovaAdmissao={vi.fn()}
      onAbrirFicha={vi.fn()}
      onAbrirOrganograma={vi.fn()}
      {...props}
    />,
  );
}

const tabela = () => screen.findByRole("table", { name: /^Colaboradores — / });

describe("T215 — página de Colaboradores: cabeçalho", () => {
  it("título, descrição, Exportar e Novo colaborador; sem o aviso de RH e DP", async () => {
    montar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Gerencie contratos, dados e documentos do time."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar" })).toHaveAttribute(
      "aria-haspopup",
      "menu",
    );
    expect(
      screen.getByRole("button", { name: "Novo colaborador" }),
    ).toBeInTheDocument();
    await tabela();
    expect(screen.queryByText("RH e DP")).toBeNull();
    expect(screen.queryByText(/sem filtros$/)).toBeNull();
  });

  it("Exportar: PDF e Excel, com a nota de que busca e filtros valem", async () => {
    montar();
    await tabela();
    const exportar = screen.getByRole("button", { name: "Exportar" });
    fireEvent.keyDown(exportar, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    const itens = within(menu).getAllByRole("menuitem");
    expect(itens.map((i) => i.textContent)).toEqual([
      "Exportar em PDFRelatório para impressão",
      "Exportar em ExcelPlanilha com todas as colunas",
    ]);
    expect(
      within(menu).getByText("Busca e filtros atuais são respeitados."),
    ).toBeInTheDocument();
  });

  it("Exportar em Excel baixa a planilha da consulta atual (todas as páginas)", async () => {
    montar();
    await tabela();
    fireEvent.keyDown(screen.getByRole("button", { name: "Exportar" }), {
      key: "Enter",
    });
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /^Exportar em Excel/ }),
    );
    await waitFor(() => expect(baixarArquivo).toHaveBeenCalledTimes(1));
    const [conteudo, nome, tipo] = vi.mocked(baixarArquivo).mock.calls[0]!;
    expect(conteudo).toBeInstanceOf(Uint8Array);
    expect(nome).toMatch(/^colaboradores-.*\.xlsx$/);
    expect(tipo).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const leituraDaExportacao = vi
      .mocked(listarColaboradores)
      .mock.calls.at(-1)![0];
    expect(leituraDaExportacao).toMatchObject({
      grupo: "ativos",
      tamanhoPagina: 100,
      pagina: 1,
    });
  });
});

describe("T215 — página de Colaboradores: cartões", () => {
  it("Colaboradores ativos, Por tipo de contrato e Ausentes hoje", async () => {
    montar();
    await tabela();
    const ativos = screen.getByRole("group", { name: "Colaboradores ativos" });
    expect(within(ativos).getByText("6")).toBeInTheDocument();
    expect(within(ativos).getByText("3 no mês")).toBeInTheDocument();
    expect(
      within(ativos).getByText(`7 cadastrados · 0 desligados em ${ANO}`),
    ).toBeInTheDocument();

    const tipos = screen.getByRole("group", { name: "Por tipo de contrato" });
    const legenda = within(tipos)
      .getAllByRole("listitem")
      .map((i) => i.textContent);
    expect(legenda).toEqual([
      "CLT 3",
      "PJ 0",
      "Estágio 1",
      "Aprendiz 0",
      "Outros 2",
    ]);

    const ausentes = screen.getByRole("group", { name: "Ausentes hoje" });
    expect(within(ausentes).getByText("0")).toBeInTheDocument();
    expect(
      within(ausentes).getByText("Ninguém ausente hoje"),
    ).toBeInTheDocument();
    expect(
      within(ausentes).getByRole("button", { name: "Ver calendário" }),
    ).toBeInTheDocument();
  });
});

describe("T215 — página de Colaboradores: abas, busca e tabela", () => {
  it("abas sem Em admissão, com os totais", async () => {
    montar();
    await tabela();
    const abas = within(
      screen.getByRole("tablist", { name: "Grupos de colaboradores" }),
    )
      .getAllByRole("tab")
      .map((t) => t.textContent);
    expect(abas).toEqual([
      "Ativos6",
      "Férias e ausências0",
      "Escala de trabalho",
      "Organograma",
      "Desligados1",
      "Todos7",
    ]);
  });

  it("busca por nome, CPF, e-mail ou ID: Enter consulta o servidor", async () => {
    montar();
    await tabela();
    const busca = screen.getByRole("searchbox", {
      name: "Buscar por nome, CPF, e-mail ou ID",
    });
    expect(busca).toHaveAttribute(
      "placeholder",
      "Buscar por nome, CPF, e-mail ou ID",
    );
    expect(screen.queryByRole("button", { name: "Buscar" })).toBeNull();
    fireEvent.change(busca, { target: { value: "529.982" } });
    fireEvent.submit(busca.closest("form")!);
    await waitFor(() =>
      expect(
        vi.mocked(listarColaboradores).mock.calls.at(-1)![0],
      ).toMatchObject({ busca: "529.982" }),
    );
    expect(screen.getByRole("button", { name: "Filtrar" })).toBeInTheDocument();
  });

  it("a busca também consulta sozinha, pouco depois de digitar", async () => {
    montar();
    await tabela();
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "Buscar por nome, CPF, e-mail ou ID",
      }),
      { target: { value: "maria" } },
    );
    await waitFor(() =>
      expect(
        vi.mocked(listarColaboradores).mock.calls.at(-1)![0],
      ).toMatchObject({ busca: "maria" }),
    );
  });

  it("colunas e células como na referência", async () => {
    montar();
    const t = await tabela();
    const cabecalhos = within(t)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(cabecalhos).toEqual([
      "Selecionar todos desta página",
      "Colaborador",
      "CPF",
      "Contatos",
      "Salário",
      "Contrato",
      "Ações",
    ]);
    const [, linhaMaria, linhaPedro] = within(t).getAllByRole("row");
    const maria = within(linhaMaria!).getAllByRole("cell");
    expect(maria[1]).toHaveTextContent("Maria Teste Santos");
    expect(maria[1]).toHaveTextContent("Analista de RH");
    expect(maria[2]).toHaveTextContent("529.982.247-25");
    expect(maria[3]).toHaveTextContent("maria.teste@example.test");
    expect(maria[3]).toHaveTextContent("(11) 91234-5678");
    expect(maria[4]).toHaveTextContent("R$ 5.000,00");
    expect(maria[5]).toHaveTextContent("CLT");

    const pedro = within(linhaPedro!).getAllByRole("cell");
    expect(pedro[1]).toHaveTextContent("Sem cargo");
    expect(pedro[2]).toHaveTextContent("—");
    expect(pedro[3]).toHaveTextContent("Sem contato");
    expect(pedro[4]).toHaveTextContent("—");
    expect(pedro[5]).toHaveTextContent("Estágio");
  });

  it("seleção: por linha e todos da página", async () => {
    montar();
    const t = await tabela();
    const todos = within(t).getByRole("checkbox", {
      name: "Selecionar todos desta página",
    });
    const maria = within(t).getByRole("checkbox", {
      name: "Selecionar Maria Teste Santos",
    });
    fireEvent.click(maria);
    expect(maria).toBeChecked();
    expect(todos).toHaveProperty("indeterminate", true);
    fireEvent.click(todos);
    expect(
      within(t).getByRole("checkbox", { name: "Selecionar Pedro Teste" }),
    ).toBeChecked();
    fireEvent.click(todos);
    expect(maria).not.toBeChecked();
  });

  it("no pé, N resultados", async () => {
    montar();
    await tabela();
    expect(screen.getByText("2 resultados")).toBeInTheDocument();
    expect(screen.queryByText("Itens por página")).toBeNull();
  });
});
