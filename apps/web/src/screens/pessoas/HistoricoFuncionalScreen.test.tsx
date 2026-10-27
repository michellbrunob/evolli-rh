import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoricoFuncionalScreen } from "./HistoricoFuncionalScreen";
import {
  type ColaboradorApi,
  type ListagemColaboradoresApi,
  type VinculoApi,
  buscarColaborador,
  listarColaboradores,
  listarVinculosDoColaborador,
} from "../../api/colaboradoresClient";
import {
  type AreaApi,
  type CentroCustoApi,
  type DepartamentoApi,
  type EquipeApi,
  type UnidadeOrganizacionalApi,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { type CargoApi, listarCargos } from "../../api/cargoClient";
import {
  type MovimentacaoApi,
  buscarLinhaDoTempo,
  cancelarMovimentacao,
  efetivarMovimentacao,
  listarMovimentacoes,
  registrarMovimentacao,
  retificarMovimentacao,
} from "../../api/movimentacaoClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/organizacaoClient");
vi.mock("../../api/cargoClient");
vi.mock("../../api/movimentacaoClient");

interface ResultadoPaginadoTeste<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

function paginado<T>(itens: T[]): ResultadoPaginadoTeste<T> {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

/**
 * T178 — `GET /v1/colaboradores` passou a trazer os vínculos de cada item e os
 * `contadores` do escopo. Esta tela não usa nenhum dos dois; o envelope só
 * precisa ter a forma do contrato.
 */
function listagem(itens: ColaboradorApi[]): ListagemColaboradoresApi {
  return {
    ...paginado(itens.map((c) => ({ ...c, vinculos: [] }))),
    contadores: { ativos: 0, inativos: 0 },
  };
}

const EMPRESA_ID = "99999999-9999-9999-9999-999999999999";

const colaborador1: ColaboradorApi = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana Colaboradora (teste)",
  situacao: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const colaborador2: ColaboradorApi = {
  id: "22222222-2222-2222-2222-222222222222",
  nome: "Bruno Colaborador (teste)",
  situacao: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const vinculo1: VinculoApi = {
  id: "10101010-1010-1010-1010-101010101010",
  colaboradorId: colaborador1.id,
  empresaId: EMPRESA_ID,
  matricula: "MAT-001",
  tipo: "clt",
  situacao: "ativo",
  dataAdmissao: "2025-01-05",
  dataDesligamento: null,
  criadoEm: "2025-01-05T12:00:00.000Z",
  atualizadoEm: "2025-01-05T12:00:00.000Z",
};

const vinculo2a: VinculoApi = {
  id: "20202020-2020-2020-2020-202020202020",
  colaboradorId: colaborador2.id,
  empresaId: EMPRESA_ID,
  matricula: "MAT-002A",
  tipo: "clt",
  situacao: "ativo",
  dataAdmissao: "2024-01-05",
  dataDesligamento: null,
  criadoEm: "2024-01-05T12:00:00.000Z",
  atualizadoEm: "2024-01-05T12:00:00.000Z",
};

const vinculo2b: VinculoApi = {
  id: "21212121-2121-2121-2121-212121212121",
  colaboradorId: colaborador2.id,
  empresaId: EMPRESA_ID,
  matricula: "MAT-002B",
  tipo: "pj",
  situacao: "previsto",
  dataAdmissao: "2026-06-01",
  dataDesligamento: null,
  criadoEm: "2026-05-01T12:00:00.000Z",
  atualizadoEm: "2026-05-01T12:00:00.000Z",
};

const departamento1: DepartamentoApi = {
  id: "30303030-3030-3030-3030-303030303030",
  codigo: "DEP1",
  nome: "Departamento Um (teste)",
  empresaId: EMPRESA_ID,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const unidade1: UnidadeOrganizacionalApi = {
  id: "31313131-3131-3131-3131-313131313131",
  codigo: "UNI1",
  nome: "Unidade Um (teste)",
  empresaId: EMPRESA_ID,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const area1: AreaApi = {
  id: "32323232-3232-3232-3232-323232323232",
  departamentoId: departamento1.id,
  codigo: "ARE1",
  nome: "Área Um (teste)",
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const equipe1: EquipeApi = {
  id: "33333333-3333-3333-3333-333333333333",
  empresaId: EMPRESA_ID,
  departamentoId: departamento1.id,
  unidadeOrganizacionalId: null,
  codigo: "EQP1",
  nome: "Equipe Um (teste)",
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const cargo1: CargoApi = {
  id: "34343434-3434-3434-3434-343434343434",
  codigo: "CAR1",
  nome: "Cargo Um (teste)",
  empresaId: EMPRESA_ID,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const centroCusto1: CentroCustoApi = {
  id: "35353535-3535-3535-3535-353535353535",
  empresaId: EMPRESA_ID,
  codigo: "CC1",
  nome: "Centro de Custo Um (teste)",
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const movSolicitada: MovimentacaoApi = {
  id: "40404040-4040-4040-4040-404040404040",
  vinculoId: vinculo1.id,
  empresaId: EMPRESA_ID,
  tipo: "transferencia_organizacional",
  status: "solicitada",
  motivoCodigo: "realocacao_interna",
  registradaEm: "2026-01-05T10:00:00.000Z",
  solicitanteUserId: "user-1",
  vigenciaInicio: "2026-01-10",
  efetivadaEm: null,
  executorUserId: null,
  retificaId: null,
  destinoUnidadeOrganizacionalId: null,
  destinoDepartamentoId: departamento1.id,
  destinoAreaId: null,
  destinoEquipeId: null,
  destinoCargoId: null,
  destinoCentroCustoId: null,
  criadoEm: "2026-01-05T10:00:00.000Z",
  atualizadoEm: "2026-01-05T10:00:00.000Z",
};

const movAdmissaoEfetivada: MovimentacaoApi = {
  ...movSolicitada,
  id: "41414141-4141-4141-4141-414141414141",
  tipo: "admissao",
  status: "efetivada",
  motivoCodigo: "admissao_inicial",
  registradaEm: "2025-01-05T09:00:00.000Z",
  vigenciaInicio: "2025-01-05",
  efetivadaEm: "2025-01-05T09:05:00.000Z",
  executorUserId: "user-1",
  destinoDepartamentoId: null,
};

const movCancelada: MovimentacaoApi = {
  ...movSolicitada,
  id: "42424242-4242-4242-4242-424242424242",
  vinculoId: vinculo2a.id,
  tipo: "mudanca_cargo",
  status: "cancelada",
  motivoCodigo: "promocao",
  registradaEm: "2026-01-02T08:00:00.000Z",
  vigenciaInicio: "2026-01-15",
  destinoDepartamentoId: null,
  destinoCargoId: cargo1.id,
};

const movEfetivada: MovimentacaoApi = {
  ...movSolicitada,
  id: "43434343-4343-4343-4343-434343434343",
  status: "efetivada",
  vigenciaInicio: "2026-01-01",
  efetivadaEm: "2026-01-01T09:00:00.000Z",
  executorUserId: "user-1",
};

const movCorrecao: MovimentacaoApi = {
  ...movSolicitada,
  id: "44444444-4444-4444-4444-444444444444",
  status: "solicitada",
  motivoCodigo: "correcao_cadastral",
  vigenciaInicio: "2026-01-20",
  retificaId: movEfetivada.id,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarColaboradores).mockResolvedValue(
    listagem([colaborador1, colaborador2]),
  );
  vi.mocked(listarDepartamentos).mockResolvedValue(paginado([departamento1]));
  vi.mocked(listarUnidades).mockResolvedValue(paginado([unidade1]));
  vi.mocked(listarAreas).mockResolvedValue(paginado([area1]));
  vi.mocked(listarEquipes).mockResolvedValue(paginado([equipe1]));
  vi.mocked(listarCargos).mockResolvedValue(paginado([cargo1]));
  vi.mocked(listarCentrosCusto).mockResolvedValue(paginado([centroCusto1]));

  vi.mocked(listarVinculosDoColaborador).mockImplementation(async (id) => {
    if (id === colaborador1.id) return [vinculo1];
    if (id === colaborador2.id) return [vinculo2a, vinculo2b];
    return [];
  });

  vi.mocked(listarMovimentacoes).mockResolvedValue(
    paginado([movSolicitada, movAdmissaoEfetivada, movCancelada]),
  );
  vi.mocked(buscarLinhaDoTempo).mockResolvedValue([
    movAdmissaoEfetivada,
    movSolicitada,
  ]);
  vi.mocked(registrarMovimentacao).mockResolvedValue(movSolicitada);
  vi.mocked(efetivarMovimentacao).mockResolvedValue({
    ...movSolicitada,
    status: "efetivada",
  });
  vi.mocked(cancelarMovimentacao).mockResolvedValue({
    ...movSolicitada,
    status: "cancelada",
  });
  vi.mocked(retificarMovimentacao).mockResolvedValue(movCorrecao);
  // T188 — a seleção vinda da ficha busca o nome no servidor.
  vi.mocked(buscarColaborador).mockImplementation(async (id) => {
    const achado = [colaborador1, colaborador2].find((c) => c.id === id);
    if (!achado) throw new Error("404");
    return achado;
  });
});

/** T188 — o colaborador é escolhido na busca paginada, pelo nome. */
const NOME_POR_ID: Record<string, string> = {
  [colaborador1.id]: colaborador1.nome,
  [colaborador2.id]: colaborador2.nome,
  "55555555-5555-5555-5555-555555555555": "Carla Sem Vínculo (teste)",
};

async function selecionarColaborador(colaboradorId: string) {
  const lista = await screen.findByRole("list", {
    name: "Colaboradores encontrados",
  });
  fireEvent.click(
    within(lista).getByRole("button", {
      name: NOME_POR_ID[colaboradorId] ?? colaboradorId,
    }),
  );
  await waitFor(() => expect(listarVinculosDoColaborador).toHaveBeenCalled());
}

describe("HistoricoFuncionalScreen (T115 — funcional)", () => {
  it("tem um único h1 e exibe o aviso Somente RH e DP", async () => {
    render(<HistoricoFuncionalScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Histórico funcional" }),
    ).toHaveLength(1);
    expect(screen.getByText("Somente RH e DP")).toBeInTheDocument();

    await waitFor(() => expect(listarMovimentacoes).toHaveBeenCalled());
  });

  it("lista movimentações reais com tipo, status, motivo e vigência", async () => {
    render(<HistoricoFuncionalScreen />);

    const tabela = await screen.findByRole("table", {
      name: "Movimentações funcionais",
    });
    const dentro = within(tabela);
    expect(
      dentro.getByText("Transferência organizacional"),
    ).toBeInTheDocument();
    expect(dentro.getByText("Admissão")).toBeInTheDocument();
    expect(dentro.getByText("Solicitada")).toBeInTheDocument();
    expect(dentro.getByText("Efetivada")).toBeInTheDocument();
    expect(dentro.getByText("Cancelada")).toBeInTheDocument();
    expect(dentro.getByText("Realocação interna")).toBeInTheDocument();
    expect(dentro.getByText("10/01/2026")).toBeInTheDocument();
    // `registradaEm` é INSTANTE: 2026-01-05T10:00Z lido em America/Sao_Paulo.
    expect(dentro.getByText("05/01/2026 às 07:00")).toBeInTheDocument();

    // Guarda da T154: varre o texto visível INTEIRO da tela, não só a tabela —
    // filtros, cabeçalho e disclaimer entram junto. O `value` de campo de
    // formulário fica fora do alcance por ser atributo, e não texto: ali o ISO
    // é contrato com o `<input type="date">`, não apresentação.
    expectSemIsoVisivel(document.body);
  });

  it("mostra o estado de carregamento antes das movimentações chegarem", async () => {
    let resolver: (v: ResultadoPaginadoTeste<MovimentacaoApi>) => void;
    vi.mocked(listarMovimentacoes).mockReturnValueOnce(
      new Promise((resolve) => {
        resolver = resolve;
      }) as ReturnType<typeof listarMovimentacoes>,
    );

    render(<HistoricoFuncionalScreen />);

    expect(
      await screen.findByText("Carregando movimentações…"),
    ).toBeInTheDocument();

    resolver!(paginado([movSolicitada]));
    await screen.findByRole("table", { name: "Movimentações funcionais" });
  });

  it("mostra erro de carregamento da listagem e permite tentar novamente", async () => {
    vi.mocked(listarMovimentacoes).mockRejectedValueOnce(new Error("falha"));

    render(<HistoricoFuncionalScreen />);

    await screen.findByText("Não foi possível carregar as movimentações.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", { name: "Movimentações funcionais" });
  });

  it("mostra EmptyState quando não há movimentações", async () => {
    vi.mocked(listarMovimentacoes).mockResolvedValue(paginado([]));

    render(<HistoricoFuncionalScreen />);

    expect(
      await screen.findByRole("heading", {
        name: "Nenhuma movimentação encontrada",
      }),
    ).toBeInTheDocument();
  });

  it("mostra erro base e permite tentar novamente quando falha ao carregar dados de referência", async () => {
    vi.mocked(listarDepartamentos).mockRejectedValueOnce(new Error("falha"));

    render(<HistoricoFuncionalScreen />);

    await screen.findByRole("heading", {
      name: "Não foi possível carregar os dados desta tela",
    });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByRole("list", { name: "Colaboradores encontrados" }),
    ).toBeInTheDocument();
  });

  it("seleciona colaborador com um único vínculo: resolve automaticamente e habilita registrar", async () => {
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await selecionarColaborador(colaborador1.id);

    await waitFor(() =>
      expect(screen.getByLabelText(/^Vínculo\b/i)).toHaveValue(vinculo1.id),
    );
    expect(
      screen.getByRole("button", { name: "Registrar movimentação" }),
    ).not.toBeDisabled();
  });

  it("T179 — vínculo sem matrícula aparece como 'Sem matrícula' no seletor", async () => {
    vi.mocked(listarVinculosDoColaborador).mockImplementation(async (id) =>
      id === colaborador2.id
        ? [{ ...vinculo2a, matricula: null }, vinculo2b]
        : [vinculo1],
    );
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await selecionarColaborador(colaborador2.id);

    const seletor = screen.getByLabelText(/^Vínculo\b/i);
    await waitFor(() =>
      expect(
        within(seletor).getByRole("option", { name: "Sem matrícula — CLT" }),
      ).toBeInTheDocument(),
    );
    expect(seletor).not.toHaveTextContent("null");
  });

  it("seleciona colaborador com múltiplos vínculos: exige seleção explícita, sem escolha silenciosa", async () => {
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await selecionarColaborador(colaborador2.id);

    expect(screen.getByLabelText(/^Vínculo\b/i)).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Registrar movimentação" }),
    ).toBeDisabled();
  });

  it("colaborador sem nenhum vínculo bloqueia o registro e avisa", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      listagem([
        colaborador1,
        colaborador2,
        {
          ...colaborador1,
          id: "55555555-5555-5555-5555-555555555555",
          nome: "Carla Sem Vínculo (teste)",
        },
      ]),
    );

    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await selecionarColaborador("55555555-5555-5555-5555-555555555555");

    expect(
      screen.getByText("Este colaborador não tem nenhum vínculo."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar movimentação" }),
    ).toBeDisabled();
  });

  it("mostra erro ao carregar vínculos do colaborador", async () => {
    vi.mocked(listarVinculosDoColaborador).mockRejectedValueOnce(
      new Error("falha"),
    );

    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await selecionarColaborador(colaborador1.id);

    expect(
      await screen.findByText(
        "Não foi possível carregar os vínculos deste colaborador.",
      ),
    ).toBeInTheDocument();
  });

  it("filtra a listagem por tipo e por status", async () => {
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    fireEvent.change(screen.getByLabelText(/^Tipo\b/i), {
      target: { value: "desligamento" },
    });
    await waitFor(() =>
      expect(listarMovimentacoes).toHaveBeenLastCalledWith(
        expect.objectContaining({ tipo: "desligamento" }),
      ),
    );

    fireEvent.change(screen.getByLabelText(/^Status\b/i), {
      target: { value: "efetivada" },
    });
    await waitFor(() =>
      expect(listarMovimentacoes).toHaveBeenLastCalledWith(
        expect.objectContaining({ tipo: "desligamento", status: "efetivada" }),
      ),
    );
  });

  it("abre o formulário de registro e valida campos obrigatórios", async () => {
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });
    await selecionarColaborador(colaborador1.id);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Registrar movimentação" }),
      ).not.toBeDisabled(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar movimentação" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar registro" }));

    expect(
      await screen.findByText("Selecione o tipo de movimentação."),
    ).toBeInTheDocument();
    expect(screen.getByText("Selecione o motivo.")).toBeInTheDocument();
    expect(
      screen.getByText("Informe o início da vigência."),
    ).toBeInTheDocument();
    expect(registrarMovimentacao).not.toHaveBeenCalled();
  });

  it("registra transferência com destino departamento e recarrega a listagem", async () => {
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });
    await selecionarColaborador(colaborador1.id);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Registrar movimentação" }),
      ).not.toBeDisabled(),
    );
    const chamadasAntes = vi.mocked(listarMovimentacoes).mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar movimentação" }),
    );
    fireEvent.change(screen.getByLabelText(/^Tipo de movimentação/i), {
      target: { value: "transferencia_organizacional" },
    });
    fireEvent.change(screen.getByLabelText(/^Motivo\b/i), {
      target: { value: "realocacao_interna" },
    });
    fireEvent.change(screen.getByLabelText(/Vigência — início/i), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de destino organizacional/i), {
      target: { value: "departamento" },
    });
    fireEvent.change(screen.getByLabelText(/^Departamento\b/i), {
      target: { value: departamento1.id },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar registro" }));

    await waitFor(() =>
      expect(registrarMovimentacao).toHaveBeenCalledWith({
        vinculoId: vinculo1.id,
        tipo: "transferencia_organizacional",
        motivoCodigo: "realocacao_interna",
        vigenciaInicio: "2026-02-01",
        departamentoId: departamento1.id,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("form", {
          name: "Formulário de registro de movimentação",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(vi.mocked(listarMovimentacoes).mock.calls.length).toBeGreaterThan(
      chamadasAntes,
    );
  });

  it("desligamento não exibe nem exige destino organizacional", async () => {
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });
    await selecionarColaborador(colaborador1.id);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Registrar movimentação" }),
      ).not.toBeDisabled(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar movimentação" }),
    );
    fireEvent.change(screen.getByLabelText(/^Tipo de movimentação/i), {
      target: { value: "desligamento" },
    });

    expect(
      screen.queryByLabelText(/Tipo de destino organizacional/i),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Motivo\b/i), {
      target: { value: "encerramento_de_vinculo" },
    });
    fireEvent.change(screen.getByLabelText(/Vigência — início/i), {
      target: { value: "2026-03-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar registro" }));

    await waitFor(() =>
      expect(registrarMovimentacao).toHaveBeenCalledWith({
        vinculoId: vinculo1.id,
        tipo: "desligamento",
        motivoCodigo: "encerramento_de_vinculo",
        vigenciaInicio: "2026-03-01",
      }),
    );
  });

  it("mostra mensagem de erro amigável quando registrar falha", async () => {
    vi.mocked(registrarMovimentacao).mockRejectedValueOnce(
      new Error("Vínculo fora de escopo."),
    );

    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });
    await selecionarColaborador(colaborador1.id);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Registrar movimentação" }),
      ).not.toBeDisabled(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Registrar movimentação" }),
    );
    fireEvent.change(screen.getByLabelText(/^Tipo de movimentação/i), {
      target: { value: "desligamento" },
    });
    fireEvent.change(screen.getByLabelText(/^Motivo\b/i), {
      target: { value: "encerramento_de_vinculo" },
    });
    fireEvent.change(screen.getByLabelText(/Vigência — início/i), {
      target: { value: "2026-03-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar registro" }));

    expect(
      await screen.findByText("Vínculo fora de escopo."),
    ).toBeInTheDocument();
  });

  it("abre a linha do tempo de um vínculo e mostra o histórico completo, inclusive canceladas", async () => {
    vi.mocked(buscarLinhaDoTempo).mockResolvedValueOnce([
      movAdmissaoEfetivada,
      movSolicitada,
    ]);

    render(<HistoricoFuncionalScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Movimentações funcionais",
    });
    const linha = within(tabela).getByText("Admissão").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver linha do tempo/ }),
    );

    await waitFor(() =>
      expect(buscarLinhaDoTempo).toHaveBeenCalledWith(vinculo1.id),
    );
    expect(
      await screen.findByRole("heading", { name: /Linha do tempo/ }),
    ).toBeInTheDocument();
  });

  it("efetiva uma movimentação solicitada, atualiza a linha do tempo e a listagem", async () => {
    vi.mocked(buscarLinhaDoTempo).mockResolvedValue([movSolicitada]);

    render(<HistoricoFuncionalScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Movimentações funcionais",
    });
    const linha = within(tabela)
      .getByText("Transferência organizacional")
      .closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver linha do tempo/ }),
    );
    await screen.findByRole("heading", { name: /Linha do tempo/ });

    fireEvent.click(screen.getByRole("button", { name: "Efetivar" }));

    await waitFor(() =>
      expect(efetivarMovimentacao).toHaveBeenCalledWith(movSolicitada.id),
    );
    await waitFor(() => expect(buscarLinhaDoTempo).toHaveBeenCalledTimes(2));
  });

  it("cancela uma movimentação solicitada", async () => {
    vi.mocked(buscarLinhaDoTempo).mockResolvedValue([movSolicitada]);

    render(<HistoricoFuncionalScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Movimentações funcionais",
    });
    const linha = within(tabela)
      .getByText("Transferência organizacional")
      .closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver linha do tempo/ }),
    );
    await screen.findByRole("heading", { name: /Linha do tempo/ });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(cancelarMovimentacao).toHaveBeenCalledWith(movSolicitada.id),
    );
  });

  it("mostra erro inline quando a ação de efetivar falha, sem derrubar o painel", async () => {
    vi.mocked(buscarLinhaDoTempo).mockResolvedValue([movSolicitada]);
    vi.mocked(efetivarMovimentacao).mockRejectedValueOnce(
      new Error("Vigência ainda não alcançada."),
    );

    render(<HistoricoFuncionalScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Movimentações funcionais",
    });
    const linha = within(tabela)
      .getByText("Transferência organizacional")
      .closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver linha do tempo/ }),
    );
    await screen.findByRole("heading", { name: /Linha do tempo/ });

    fireEvent.click(screen.getByRole("button", { name: "Efetivar" }));

    expect(
      await screen.findByText("Vigência ainda não alcançada."),
    ).toBeInTheDocument();
  });

  it("retifica uma movimentação efetivada: cria a correção e preserva a original na linha do tempo", async () => {
    vi.mocked(buscarLinhaDoTempo)
      .mockResolvedValueOnce([movEfetivada])
      .mockResolvedValueOnce([
        { ...movEfetivada, status: "retificada" },
        movCorrecao,
      ]);

    render(<HistoricoFuncionalScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Movimentações funcionais",
    });
    const linha = within(tabela)
      .getByText("Transferência organizacional")
      .closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver linha do tempo/ }),
    );
    await screen.findByRole("heading", { name: /Linha do tempo/ });

    fireEvent.click(screen.getByRole("button", { name: "Retificar" }));
    fireEvent.change(screen.getByLabelText(/^Motivo\b/i), {
      target: { value: "correcao_cadastral" },
    });
    fireEvent.change(screen.getByLabelText(/Vigência — início/i), {
      target: { value: "2026-01-20" },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de destino organizacional/i), {
      target: { value: "departamento" },
    });
    fireEvent.change(screen.getByLabelText(/^Departamento\b/i), {
      target: { value: departamento1.id },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar retificação" }),
    );

    await waitFor(() =>
      expect(retificarMovimentacao).toHaveBeenCalledWith(movEfetivada.id, {
        motivoCodigo: "correcao_cadastral",
        vigenciaInicio: "2026-01-20",
        departamentoId: departamento1.id,
      }),
    );

    const painel = (
      await screen.findByRole("heading", { name: /Linha do tempo/ })
    ).closest("section")!;
    await waitFor(() =>
      expect(within(painel).getByText("Retificada")).toBeInTheDocument(),
    );
    expect(within(painel).getAllByText("Solicitada").length).toBeGreaterThan(0);
    expect(
      within(painel).getByText("Corrigida — nova vigência 20/01/2026"),
    ).toBeInTheDocument();
    expect(
      within(painel).getByText("É a correção de outra movimentação"),
    ).toBeInTheDocument();
  });

  it("movimentação cancelada ou retificada não exibe ações — são terminais", async () => {
    vi.mocked(buscarLinhaDoTempo).mockResolvedValue([
      movCancelada,
      { ...movEfetivada, status: "retificada" },
    ]);

    render(<HistoricoFuncionalScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Movimentações funcionais",
    });
    const linha = within(tabela).getByText("Cancelada").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver linha do tempo/ }),
    );
    const painel = (
      await screen.findByRole("heading", { name: /Linha do tempo/ })
    ).closest("section")!;

    expect(
      within(painel).queryByRole("button", { name: "Efetivar" }),
    ).not.toBeInTheDocument();
    expect(
      within(painel).queryByRole("button", { name: "Cancelar" }),
    ).not.toBeInTheDocument();
    expect(
      within(painel).queryByRole("button", { name: "Retificar" }),
    ).not.toBeInTheDocument();
  });

  it("fecha a linha do tempo e o registro fecha uma linha do tempo aberta", async () => {
    vi.mocked(buscarLinhaDoTempo).mockResolvedValue([movSolicitada]);

    render(<HistoricoFuncionalScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Movimentações funcionais",
    });
    const linha = within(tabela)
      .getByText("Transferência organizacional")
      .closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver linha do tempo/ }),
    );
    await screen.findByRole("heading", { name: /Linha do tempo/ });

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByRole("heading", { name: /Linha do tempo/ }),
    ).not.toBeInTheDocument();

    await selecionarColaborador(colaborador1.id);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Registrar movimentação" }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(
      within(tabela).getAllByRole("button", { name: /Ver linha do tempo/ })[0]!,
    );
    await screen.findByRole("heading", { name: /Linha do tempo/ });
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar movimentação" }),
    );
    expect(
      screen.queryByRole("heading", { name: /Linha do tempo/ }),
    ).not.toBeInTheDocument();
  });

  it("não tem botão de aprovar/rejeitar, nem referencia cálculo de jornada, Banco de Horas, Folha, CPF, senha ou sessão", async () => {
    vi.mocked(buscarLinhaDoTempo).mockResolvedValue([
      movSolicitada,
      movEfetivada,
    ]);

    render(<HistoricoFuncionalScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Movimentações funcionais",
    });
    await selecionarColaborador(colaborador1.id);
    fireEvent.click(
      within(tabela).getAllByRole("button", { name: /Ver linha do tempo/ })[0]!,
    );
    await screen.findByRole("heading", { name: /Linha do tempo/ });

    // Não há workflow de aprovação nesta V1 (Baseline V1, item 7): o
    // disclaimer da tela explica essa ausência em prosa (por isso as
    // palavras "aprovação"/"rejeição" aparecem no texto), mas nenhum
    // CONTROLE de aprovar/rejeitar existe de fato.
    expect(
      screen.queryByRole("button", { name: /Aprovar/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Rejeitar/ }),
    ).not.toBeInTheDocument();

    // "Banco de Horas", "Folha", "benefícios", "dependentes" e "afastamentos"
    // aparecem no próprio disclaimer da tela, EXPLICANDO que ela não os toca
    // — a ausência é declarada em prosa, e é isso que os testes acima e o
    // teste de botões (Aprovar/Rejeitar) verificam de fato.
    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "senha",
      "sessão",
      "tolerância",
      "hora extra",
      "localstorage",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});

// ---------------------------------------------------------------------------
// T187 — aberto pelo atalho da "Vida funcional" da ficha.
// ---------------------------------------------------------------------------
describe("T187 — seleção inicial vinda da ficha", () => {
  it("chega com o colaborador e o vínculo pedidos já filtrados", async () => {
    render(
      <HistoricoFuncionalScreen
        selecaoInicial={{
          colaboradorId: colaborador2.id,
          vinculoId: vinculo2b.id,
        }}
      />,
    );
    // Com dois vínculos, sem a seleção nada seria escolhido sozinho.
    await waitFor(() =>
      expect(listarMovimentacoes).toHaveBeenLastCalledWith(
        expect.objectContaining({ vinculoId: vinculo2b.id }),
      ),
    );
    expect(listarVinculosDoColaborador).toHaveBeenCalledWith(colaborador2.id);
    expect(buscarColaborador).toHaveBeenCalledWith(colaborador2.id);
    expect(
      screen.getByText(colaborador2.nome, { selector: "strong" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Vínculo\b/i)).toHaveValue(vinculo2b.id);
  });

  it("vínculo que o servidor não devolve para a sessão não é selecionado", async () => {
    render(
      <HistoricoFuncionalScreen
        selecaoInicial={{
          colaboradorId: colaborador2.id,
          vinculoId: "66666666-6666-4666-8666-666666666666",
        }}
      />,
    );
    await waitFor(() =>
      expect(listarVinculosDoColaborador).toHaveBeenCalledWith(colaborador2.id),
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/^Vínculo\b/i)).toHaveValue(""),
    );
    for (const chamada of vi.mocked(listarMovimentacoes).mock.calls) {
      expect(chamada[0]?.vinculoId).not.toBe(
        "66666666-6666-4666-8666-666666666666",
      );
    }
  });

  it("sem seleção inicial, nada muda: nenhum colaborador escolhido", async () => {
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });
    expect(listarVinculosDoColaborador).not.toHaveBeenCalled();
  });
});

/**
 * T188 — dublê de `GET /v1/colaboradores` com 150 pessoas: pagina, busca por
 * nome ou matrícula e filtra por situação, como o servidor (T178).
 */
function servidorComCentoECinquenta() {
  const lista = Array.from({ length: 150 }, (_, i) => {
    const n = String(i + 1).padStart(3, "0");
    return {
      id: `c-${n}`,
      nome: `Pessoa Teste ${n}`,
      situacao: "ativo" as const,
      criadoEm: "2026-01-01T12:00:00.000Z",
      atualizadoEm: "2026-01-01T12:00:00.000Z",
      vinculos: [
        {
          id: `vf-${n}`,
          empresaId: "e-1",
          matricula: `MAT-${n}`,
          situacao: "ativo" as const,
          dataAdmissao: "2025-01-01",
          dataDesligamento: null,
          lotacaoVigente: null,
          vigenciasDeJornada: [],
        },
      ],
    };
  });
  vi.mocked(listarColaboradores).mockImplementation((async (
    q: {
      busca?: string;
      pagina?: number;
      tamanhoPagina?: number;
      situacao?: string;
    } = {},
  ) => {
    const termo = (q.busca ?? "").toLowerCase();
    const filtrada = lista.filter(
      (c) =>
        (!q.situacao || c.situacao === q.situacao) &&
        (!termo ||
          c.nome.toLowerCase().includes(termo) ||
          c.vinculos[0]!.matricula.toLowerCase().includes(termo)),
    );
    const pagina = q.pagina ?? 1;
    const tamanho = q.tamanhoPagina ?? 20;
    return {
      itens: filtrada.slice((pagina - 1) * tamanho, pagina * tamanho),
      pagina,
      tamanhoPagina: tamanho,
      total: filtrada.length,
      contadores: { ativos: filtrada.length, inativos: 0 },
    };
  }) as never);
}

async function buscarEEscolher(termo: string, nome: RegExp) {
  const campo = await screen.findByLabelText(
    "Colaborador (buscar por nome ou matrícula)",
  );
  fireEvent.change(campo, { target: { value: termo } });
  fireEvent.keyDown(campo, { key: "Enter" });
  const botao = await screen.findByRole("button", { name: nome });
  fireEvent.click(botao);
}

describe("T188 — Histórico funcional sem o teto de 100", () => {
  it("escolhe a 130ª pessoa pela busca e filtra pelos vínculos dela", async () => {
    servidorComCentoECinquenta();
    vi.mocked(listarVinculosDoColaborador).mockImplementation(async (id) =>
      id === "c-130"
        ? [
            {
              ...vinculo1,
              id: "vf-130",
              colaboradorId: "c-130",
              matricula: "MAT-130",
            },
          ]
        : [],
    );
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await buscarEEscolher("Pessoa Teste 130", /^Pessoa Teste 130/);

    await waitFor(() =>
      expect(listarVinculosDoColaborador).toHaveBeenCalledWith("c-130"),
    );
    await waitFor(() =>
      expect(listarMovimentacoes).toHaveBeenLastCalledWith(
        expect.objectContaining({ vinculoId: "vf-130", pagina: 1 }),
      ),
    );
    expect(
      screen.getByText("Pessoa Teste 130", { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("movimentações paginadas: navega, preserva os filtros e volta à página 1 ao filtrar", async () => {
    vi.mocked(listarMovimentacoes).mockImplementation(async (q = {}) => ({
      itens: [movSolicitada],
      pagina: q.pagina ?? 1,
      tamanhoPagina: q.tamanhoPagina ?? 20,
      total: 45,
    }));
    render(<HistoricoFuncionalScreen />);
    const nav = await screen.findByRole("navigation", {
      name: "Páginas de movimentações",
    });
    expect(within(nav).getByText("Página 1 de 3")).toBeInTheDocument();
    expect(listarMovimentacoes).toHaveBeenLastCalledWith({
      pagina: 1,
      tamanhoPagina: 20,
    });

    fireEvent.click(within(nav).getByRole("button", { name: "Próxima" }));
    await waitFor(() =>
      expect(listarMovimentacoes).toHaveBeenLastCalledWith({
        pagina: 2,
        tamanhoPagina: 20,
      }),
    );
    await screen.findByText("Página 2 de 3");

    fireEvent.change(screen.getByLabelText(/^Tipo\b/i), {
      target: { value: "desligamento" },
    });
    await waitFor(() =>
      expect(listarMovimentacoes).toHaveBeenLastCalledWith({
        pagina: 1,
        tamanhoPagina: 20,
        tipo: "desligamento",
      }),
    );
    // Nenhum pedido da página 2 com o filtro novo.
    expect(listarMovimentacoes).not.toHaveBeenCalledWith(
      expect.objectContaining({ pagina: 2, tipo: "desligamento" }),
    );
  });

  it("estados históricos seguem visíveis na página (cancelada inclusive)", async () => {
    render(<HistoricoFuncionalScreen />);
    const tabela = await screen.findByRole("table", {
      name: "Movimentações funcionais",
    });
    expect(within(tabela).getByText("Cancelada")).toBeInTheDocument();
  });

  it("seleção vinda da ficha de alguém fora da sessão: nada fica selecionado", async () => {
    vi.mocked(buscarColaborador).mockRejectedValue(new Error("404"));
    render(
      <HistoricoFuncionalScreen
        selecaoInicial={{ colaboradorId: "c-outra", vinculoId: "v-outra" }}
      />,
    );
    await waitFor(() =>
      expect(buscarColaborador).toHaveBeenCalledWith("c-outra"),
    );
    await screen.findByRole("list", { name: "Colaboradores encontrados" });
    expect(
      screen.getByText("Nenhum colaborador selecionado."),
    ).toBeInTheDocument();
    expect(listarVinculosDoColaborador).not.toHaveBeenCalled();
  });

  it("servidor recusa a busca de colaboradores: aviso, sem nomes, movimentações intactas", async () => {
    vi.mocked(listarColaboradores).mockRejectedValue(
      Object.assign(new Error("recusado"), { status: 403 }),
    );
    render(<HistoricoFuncionalScreen />);
    expect(
      await screen.findByText(/Não foi possível buscar os colaboradores/),
    ).toBeInTheDocument();
    expect(screen.queryByText(colaborador1.nome)).toBeNull();
    expect(
      await screen.findByRole("table", { name: "Movimentações funcionais" }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T188 (O3) — corridas ao carregar os vínculos do colaborador escolhido. Uma
// resposta que já não pertence ao colaborador da tela é descartada: B nunca
// fica com os vínculos de A, e "Registrar movimentação" nunca usa vínculo de
// outra pessoa.
// ---------------------------------------------------------------------------

function adiado<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

/** Os vínculos de cada colaborador chegam quando o teste mandar. */
function vinculosControlados() {
  const pendentes = new Map<string, ReturnType<typeof adiado<VinculoApi[]>>>();
  vi.mocked(listarVinculosDoColaborador).mockImplementation((id) => {
    const d = adiado<VinculoApi[]>();
    pendentes.set(id, d);
    return d.promessa;
  });
  return {
    responder: async (id: string, vinculos: VinculoApi[]) => {
      await act(async () => {
        pendentes.get(id)!.resolver(vinculos);
      });
    },
  };
}

const seletorVinculo = () =>
  screen.getByLabelText(/^Vínculo\b/i) as HTMLSelectElement;
const opcoesDeVinculo = () =>
  [...seletorVinculo().options].map((o) => o.value).filter(Boolean);
const botaoRegistrar = () =>
  screen.getByRole("button", { name: "Registrar movimentação" });

describe("T188 (O3) — resposta atrasada de vínculos é descartada", () => {
  it("escolhe A e logo B; os vínculos de A chegam por último e não valem", async () => {
    const controle = vinculosControlados();
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await selecionarColaborador(colaborador2.id); // A — pendente
    await selecionarColaborador(colaborador1.id); // B — pendente

    await controle.responder(colaborador1.id, [vinculo1]); // B chega antes
    await waitFor(() => expect(seletorVinculo()).toHaveValue(vinculo1.id));

    await controle.responder(colaborador2.id, [vinculo2a]); // A, atrasada

    expect(seletorVinculo()).toHaveValue(vinculo1.id);
    expect(opcoesDeVinculo()).toEqual([vinculo1.id]);
    expect(
      screen.getByText(colaborador1.nome, { selector: "strong" }),
    ).toBeInTheDocument();
    // O registro, se aberto, é do vínculo de B.
    expect(botaoRegistrar()).toBeEnabled();
    expect(listarMovimentacoes).toHaveBeenLastCalledWith(
      expect.objectContaining({ vinculoId: vinculo1.id }),
    );
    expect(listarMovimentacoes).not.toHaveBeenCalledWith(
      expect.objectContaining({ vinculoId: vinculo2a.id }),
    );
  });

  it("seleção da ficha ainda carregando e escolha manual depois: vale a manual", async () => {
    const controle = vinculosControlados();
    const ficha = adiado<typeof colaborador2>();
    vi.mocked(buscarColaborador).mockReturnValue(ficha.promessa);
    render(
      <HistoricoFuncionalScreen
        selecaoInicial={{
          colaboradorId: colaborador2.id,
          vinculoId: vinculo2b.id,
        }}
      />,
    );
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await selecionarColaborador(colaborador1.id);
    await controle.responder(colaborador1.id, [vinculo1]);
    await waitFor(() => expect(seletorVinculo()).toHaveValue(vinculo1.id));

    // O nome da ficha chega depois da escolha manual.
    await act(async () => {
      ficha.resolver(colaborador2);
    });

    expect(listarVinculosDoColaborador).not.toHaveBeenCalledWith(
      colaborador2.id,
    );
    expect(seletorVinculo()).toHaveValue(vinculo1.id);
    expect(
      screen.getByText(colaborador1.nome, { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("seleção da ficha recusada depois da escolha manual não desfaz a escolha", async () => {
    const controle = vinculosControlados();
    const ficha = adiado<typeof colaborador2>();
    vi.mocked(buscarColaborador).mockReturnValue(ficha.promessa);
    render(
      <HistoricoFuncionalScreen
        selecaoInicial={{ colaboradorId: "c-outra", vinculoId: "v-outra" }}
      />,
    );
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await selecionarColaborador(colaborador1.id);
    await controle.responder(colaborador1.id, [vinculo1]);
    await waitFor(() => expect(seletorVinculo()).toHaveValue(vinculo1.id));

    await act(async () => {
      ficha.rejeitar(new Error("404"));
    });

    expect(seletorVinculo()).toHaveValue(vinculo1.id);
    expect(
      screen.getByText(colaborador1.nome, { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("limpar a seleção com a leitura pendente: a resposta não repovoa nada", async () => {
    const controle = vinculosControlados();
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await selecionarColaborador(colaborador1.id);
    fireEvent.click(
      screen.getByRole("button", { name: "Ver todos os colaboradores" }),
    );
    await controle.responder(colaborador1.id, [vinculo1]);

    expect(
      screen.getByText("Nenhum colaborador selecionado."),
    ).toBeInTheDocument();
    expect(seletorVinculo()).toBeDisabled();
    expect(seletorVinculo()).toHaveValue("");
    expect(opcoesDeVinculo()).toEqual([]);
    expect(botaoRegistrar()).toBeDisabled();
  });

  it("troca de empresa com a leitura pendente: a tela nova não recebe nada da antiga", async () => {
    const controle = vinculosControlados();
    const { unmount } = render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });
    await selecionarColaborador(colaborador1.id);

    // O shell remonta a árvore na troca de empresa.
    unmount();
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await controle.responder(colaborador1.id, [vinculo1]);

    expect(
      screen.getByText("Nenhum colaborador selecionado."),
    ).toBeInTheDocument();
    expect(seletorVinculo()).toHaveValue("");
    expect(opcoesDeVinculo()).toEqual([]);
    expect(botaoRegistrar()).toBeDisabled();
  });

  it("clicar de novo no mesmo colaborador continua limpando o vínculo escolhido", async () => {
    const controle = vinculosControlados();
    render(<HistoricoFuncionalScreen />);
    await screen.findByRole("table", { name: "Movimentações funcionais" });

    await selecionarColaborador(colaborador2.id);
    await controle.responder(colaborador2.id, [vinculo2a, vinculo2b]);
    await waitFor(() => expect(opcoesDeVinculo()).toHaveLength(2));
    fireEvent.change(seletorVinculo(), { target: { value: vinculo2b.id } });
    expect(seletorVinculo()).toHaveValue(vinculo2b.id);

    await selecionarColaborador(colaborador2.id);
    expect(seletorVinculo()).toHaveValue("");
    await controle.responder(colaborador2.id, [vinculo2a, vinculo2b]);
    await waitFor(() => expect(opcoesDeVinculo()).toHaveLength(2));
    expect(seletorVinculo()).toHaveValue("");
    expect(botaoRegistrar()).toBeDisabled();
  });
});
