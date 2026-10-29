import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DadosContratuaisScreen } from "./DadosContratuaisScreen";
import {
  listarColaboradores,
  listarVinculosDoColaborador,
} from "../../api/colaboradoresClient";
import {
  ApiError,
  listarAlocacoesVinculo,
} from "../../api/vinculoContratualClient";
import { buscarLinhaDoTempo } from "../../api/movimentacaoClient";
import { listarVinculosHorario } from "../../api/vinculoHorarioClient";
import { listarCargos } from "../../api/cargoClient";
import {
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { listarTabelasHorario } from "../../api/horariosClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/colaboradoresClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/colaboradoresClient")
  >("../../api/colaboradoresClient");
  return {
    ...actual,
    listarColaboradores: vi.fn(),
    listarVinculosDoColaborador: vi.fn(),
  };
});
vi.mock("../../api/vinculoContratualClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/vinculoContratualClient")
  >("../../api/vinculoContratualClient");
  return { ...actual, listarAlocacoesVinculo: vi.fn() };
});
vi.mock("../../api/movimentacaoClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/movimentacaoClient")
  >("../../api/movimentacaoClient");
  return { ...actual, buscarLinhaDoTempo: vi.fn() };
});
vi.mock("../../api/vinculoHorarioClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/vinculoHorarioClient")
  >("../../api/vinculoHorarioClient");
  return { ...actual, listarVinculosHorario: vi.fn() };
});
vi.mock("../../api/cargoClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/cargoClient")>(
    "../../api/cargoClient",
  );
  return { ...actual, listarCargos: vi.fn() };
});
vi.mock("../../api/organizacaoClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/organizacaoClient")
  >("../../api/organizacaoClient");
  return {
    ...actual,
    listarUnidades: vi.fn(),
    listarDepartamentos: vi.fn(),
    listarAreas: vi.fn(),
    listarEquipes: vi.fn(),
    listarCentrosCusto: vi.fn(),
    listarEmpresasMulti: vi.fn(),
  };
});
vi.mock("../../api/horariosClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/horariosClient")
  >("../../api/horariosClient");
  return { ...actual, listarTabelasHorario: vi.fn() };
});

const COLAB_1 = {
  id: "colab-1",
  nome: "Colaborador Um",
  situacao: "ativo" as const,
  criadoEm: "2026-01-01T10:00:00.000Z",
  atualizadoEm: "2026-01-01T10:00:00.000Z",
  vinculos: [],
};
const COLAB_2 = { ...COLAB_1, id: "colab-2", nome: "Colaborador Dois" };

/** T188 — o colaborador é escolhido pela busca paginada, não por `<select>`. */
const campoColaborador = () =>
  screen.findByLabelText("Colaborador (buscar por nome ou matrícula)");

async function escolherColaborador(nome: string) {
  const lista = await screen.findByRole("list", {
    name: "Colaboradores encontrados",
  });
  fireEvent.click(within(lista).getByRole("button", { name: nome }));
}

function vinculo(over: Record<string, unknown> = {}) {
  return {
    id: "vinc-1",
    colaboradorId: "colab-1",
    empresaId: "emp-1",
    matricula: "M-001",
    tipo: "clt" as const,
    situacao: "ativo" as const,
    dataAdmissao: "2026-01-05",
    dataDesligamento: null,
    criadoEm: "2026-01-05T09:00:00.000Z",
    atualizadoEm: "2026-01-05T09:00:00.000Z",
    ...over,
  };
}

const ALOC = {
  id: "aloc-1",
  vinculoId: "vinc-1",
  empresaId: "emp-1",
  unidadeOrganizacionalId: "un-1",
  departamentoId: null,
  areaId: null,
  equipeId: null,
  cargoId: "cargo-1",
  centroCustoId: null,
  vigenteDe: "2026-01-05",
  vigenteAte: null,
  movimentacaoOrigemId: "mov-1",
  criadoEm: "2026-01-05T09:00:00.000Z",
};

const HORARIO = {
  id: "vh-1",
  colaboradorId: "colab-1",
  empresaId: "emp-1",
  tabelaHorarioId: "tab-1",
  vigenciaInicio: "2026-01-05",
  vigenciaFim: null,
  criadoPorUserId: "rh-1",
  criadoEm: "2026-01-05T09:00:00.000Z",
  atualizadoEm: "2026-01-05T09:00:00.000Z",
};

const MOV = {
  id: "mov-1",
  vinculoId: "vinc-1",
  empresaId: "emp-1",
  tipo: "admissao" as const,
  status: "efetivada" as const,
  motivoCodigo: "admissao_inicial" as const,
  registradaEm: "2026-01-05T09:00:00.000Z",
  solicitanteUserId: "rh-1",
  vigenciaInicio: "2026-01-05",
  efetivadaEm: "2026-01-05T09:00:00.000Z",
  executorUserId: "rh-1",
  retificaId: null,
  destinoUnidadeOrganizacionalId: "un-1",
  destinoDepartamentoId: null,
  destinoAreaId: null,
  destinoEquipeId: null,
  destinoCargoId: "cargo-1",
  destinoCentroCustoId: null,
  criadoEm: "2026-01-05T09:00:00.000Z",
  atualizadoEm: "2026-01-05T09:00:00.000Z",
};

function pagina<T>(itens: T[]) {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

function configurarPadrao(over?: {
  colaboradores?: unknown[];
  vinculos?: unknown[];
}) {
  vi.mocked(listarColaboradores).mockResolvedValue(
    pagina(over?.colaboradores ?? [COLAB_1, COLAB_2]) as never,
  );
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue(
    (over?.vinculos ?? [vinculo()]) as never,
  );
  vi.mocked(listarAlocacoesVinculo).mockResolvedValue([ALOC] as never);
  vi.mocked(buscarLinhaDoTempo).mockResolvedValue([MOV] as never);
  vi.mocked(listarVinculosHorario).mockResolvedValue(
    pagina([HORARIO]) as never,
  );
  vi.mocked(listarCargos).mockResolvedValue(
    pagina([{ id: "cargo-1", codigo: "ANL", nome: "Analista" }]) as never,
  );
  vi.mocked(listarUnidades).mockResolvedValue(
    pagina([{ id: "un-1", codigo: "MTZ", nome: "Matriz" }]) as never,
  );
  vi.mocked(listarDepartamentos).mockResolvedValue(pagina([]) as never);
  vi.mocked(listarAreas).mockResolvedValue(pagina([]) as never);
  vi.mocked(listarEquipes).mockResolvedValue(pagina([]) as never);
  vi.mocked(listarCentrosCusto).mockResolvedValue(pagina([]) as never);
  vi.mocked(listarTabelasHorario).mockResolvedValue(
    pagina([{ id: "tab-1", nome: "Comercial 44h", ativo: true }]) as never,
  );
  vi.mocked(listarEmpresasMulti).mockResolvedValue(
    pagina([{ id: "emp-1", codigo: "E1", nome: "Empresa Um" }]) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  configurarPadrao();
});

describe("DadosContratuaisScreen (T134 — funcional, somente leitura)", () => {
  it("tem um único h1 'Dados contratuais'", async () => {
    render(<DadosContratuaisScreen />);
    expect(
      screen.getAllByRole("heading", { level: 1, name: "Dados contratuais" }),
    ).toHaveLength(1);
    await campoColaborador();
  });

  it("múltiplos colaboradores: não seleciona em silêncio", async () => {
    render(<DadosContratuaisScreen />);
    await screen.findByRole("list", { name: "Colaboradores encontrados" });
    expect(
      screen.getByText("Nenhum colaborador selecionado."),
    ).toBeInTheDocument();
    expect(listarVinculosDoColaborador).not.toHaveBeenCalled();
  });

  it("um colaborador e um vínculo: resolve automaticamente e mostra o detalhe", async () => {
    configurarPadrao({ colaboradores: [COLAB_1], vinculos: [vinculo()] });
    render(<DadosContratuaisScreen />);
    expect(
      await screen.findByRole("heading", { name: "Vínculo — M-001" }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText(/Analista/)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Matriz/)).length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText(/Comercial 44h/)).length,
    ).toBeGreaterThan(0);
  });

  it("zero colaboradores: estado vazio", async () => {
    configurarPadrao({ colaboradores: [] });
    render(<DadosContratuaisScreen />);
    expect(
      await screen.findByText("Nenhum colaborador no seu escopo."),
    ).toBeInTheDocument();
  });

  it("erro ao carregar colaboradores oferece nova tentativa", async () => {
    vi.mocked(listarColaboradores)
      .mockRejectedValueOnce(new ApiError(500, "x"))
      .mockResolvedValueOnce(pagina([COLAB_1]) as never);
    render(<DadosContratuaisScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    expect(
      await screen.findByRole("list", { name: "Colaboradores encontrados" }),
    ).toBeInTheDocument();
  });

  it("múltiplos vínculos exigem seleção explícita, sem escolher o primeiro", async () => {
    configurarPadrao({
      colaboradores: [COLAB_1],
      vinculos: [vinculo(), vinculo({ id: "vinc-2", matricula: "M-002" })],
    });
    render(<DadosContratuaisScreen />);
    const selVinc = (await screen.findByLabelText(
      "Vínculo",
    )) as HTMLSelectElement;
    expect(selVinc.value).toBe("");
    expect(
      screen.queryByRole("heading", { name: /^Vínculo — / }),
    ).not.toBeInTheDocument();
    fireEvent.change(selVinc, { target: { value: "vinc-2" } });
    expect(
      await screen.findByRole("heading", { name: "Vínculo — M-002" }),
    ).toBeInTheDocument();
  });

  it("T179 — vínculo sem matrícula: 'Sem matrícula' na opção, no título e no detalhe", async () => {
    configurarPadrao({
      colaboradores: [COLAB_1],
      vinculos: [
        vinculo({ matricula: null }),
        vinculo({ id: "vinc-2", matricula: "M-002" }),
      ],
    });
    render(<DadosContratuaisScreen />);
    const selVinc = (await screen.findByLabelText(
      "Vínculo",
    )) as HTMLSelectElement;
    expect(
      within(selVinc).getByRole("option", { name: /^Sem matrícula · CLT/ }),
    ).toBeInTheDocument();
    fireEvent.change(selVinc, { target: { value: "vinc-1" } });
    expect(
      await screen.findByRole("heading", { name: "Vínculo — Sem matrícula" }),
    ).toBeInTheDocument();
    const matricula = screen.getByText("Matrícula", { selector: "dt" });
    expect(matricula.nextElementSibling).toHaveTextContent("Sem matrícula");
    expect(document.body).not.toHaveTextContent(/\bnull\b/);
  });

  it("detalhe exibe matrícula, tipo, situação, admissão e desligamento", async () => {
    configurarPadrao({
      colaboradores: [COLAB_1],
      vinculos: [
        vinculo({ situacao: "encerrado", dataDesligamento: "2026-06-30" }),
      ],
    });
    render(<DadosContratuaisScreen />);
    await screen.findByRole("heading", { name: "Vínculo — M-001" });
    expect(screen.getAllByText("05/01/2026").length).toBeGreaterThan(0);
    expect(screen.getByText("30/06/2026")).toBeInTheDocument();
    expect(screen.getAllByText("Encerrado").length).toBeGreaterThan(0);
    // Nenhum ISO cru sobra na tela (T154).
    expect(screen.queryByText("2026-01-05")).toBeNull();
    expect(screen.queryByText("2026-06-30")).toBeNull();
  });

  /**
   * T154. `criadoEm`/`atualizadoEm`/`registradaEm` são `DateTime` sem
   * `@db.Date` — instantes de verdade. A implementação anterior fatiava o ISO
   * e mostrava a hora **UTC**: `2026-01-05T09:00:00.000Z` aparecia como
   * "2026-01-05 09:00", três horas adiantada para quem lê no Brasil. Agora o
   * instante é convertido para America/Sao_Paulo e exibido com `às` e relógio
   * de 24 horas: "05/01/2026 às 06:00".
   */
  it("instantes são exibidos no fuso de São Paulo, não em UTC", async () => {
    configurarPadrao({ colaboradores: [COLAB_1], vinculos: [vinculo()] });
    render(<DadosContratuaisScreen />);
    await screen.findByRole("heading", { name: "Vínculo — M-001" });

    // "Criado em", "Atualizado em" (detalhe) e "Registrada em" (linha do
    // tempo) partem todos de 2026-01-05T09:00:00.000Z.
    expect(screen.getAllByText("05/01/2026 às 06:00").length).toBe(3);
    // A hora UTC não sobra em lugar nenhum, em nenhuma das duas grafias.
    expect(screen.queryByText("2026-01-05 09:00")).toBeNull();
    expect(screen.queryByText("05/01/2026 às 09:00")).toBeNull();

    // Guarda da T154: varre o texto visível inteiro da tela, não só os
    // trechos que este teste nomeia. O `value` de campo de formulário fica
    // fora do alcance por ser atributo — ali o ISO é contrato, não
    // apresentação, e deve continuar cru.
    expectSemIsoVisivel(document.body);
  });

  it("linha do tempo é somente leitura e orienta para Histórico funcional", async () => {
    configurarPadrao({ colaboradores: [COLAB_1], vinculos: [vinculo()] });
    render(<DadosContratuaisScreen />);
    await screen.findByRole("heading", {
      name: "Linha do tempo de movimentações",
    });
    expect(screen.getByText(/use a aba/i)).toBeInTheDocument();
    expect(screen.getAllByText("Histórico funcional").length).toBeGreaterThan(
      0,
    );
    // Nenhuma ação de mutação de movimentação/vínculo nesta aba.
    for (const nome of [
      "Registrar movimentação",
      "Efetivar",
      "Cancelar",
      "Retificar",
      "Editar",
      "Desligar",
      "Nova admissão",
    ]) {
      expect(
        screen.queryByRole("button", { name: nome }),
      ).not.toBeInTheDocument();
    }
  });

  it("não expõe campos financeiros/sensíveis (salário, CPF, endereço)", async () => {
    configurarPadrao({ colaboradores: [COLAB_1], vinculos: [vinculo()] });
    const { container } = render(<DadosContratuaisScreen />);
    await screen.findByRole("heading", { name: "Vínculo — M-001" });
    const texto = (container.textContent ?? "").toLowerCase();
    for (const termo of [
      "salário",
      "salario",
      "remuneração",
      "cpf",
      "endereço",
      "banco",
      "pix",
    ]) {
      expect(texto).not.toContain(termo);
    }
  });

  it("erro nas alocações oferece nova tentativa sem quebrar a tela", async () => {
    configurarPadrao({ colaboradores: [COLAB_1], vinculos: [vinculo()] });
    vi.mocked(listarAlocacoesVinculo)
      .mockRejectedValueOnce(new ApiError(500, "x"))
      .mockResolvedValueOnce([ALOC] as never);
    render(<DadosContratuaisScreen />);
    await screen.findByRole("heading", { name: "Vínculo — M-001" });
    fireEvent.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    await waitFor(() =>
      expect(vi.mocked(listarAlocacoesVinculo).mock.calls.length).toBe(2),
    );
  });

  it("tabelas de alocações e horário renderizam (vigências)", async () => {
    configurarPadrao({ colaboradores: [COLAB_1], vinculos: [vinculo()] });
    render(<DadosContratuaisScreen />);
    await screen.findByRole("heading", { name: "Vínculo — M-001" });
    expect(
      screen.getByRole("table", { name: "Cargo e lotação por vigência" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Horário por vigência" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Movimentações do vínculo" }),
    ).toBeInTheDocument();
  });
});

// Promessa controlável para forçar ordens de resolução deterministas.
function deferred<T>() {
  let resolver!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolver = r;
  });
  return { promise, resolve: resolver };
}

const COLAB_A = { ...COLAB_1, id: "colab-A", nome: "Alice" };
const COLAB_B = { ...COLAB_1, id: "colab-B", nome: "Bob" };

describe("DadosContratuaisScreen (T134) — corridas assíncronas", () => {
  it("troca de colaborador: resposta antiga (A) que chega após B não sobrescreve B", async () => {
    const dVincA = deferred<unknown>();
    const dVincB = deferred<unknown>();
    const dHorA = deferred<unknown>();
    const dHorB = deferred<unknown>();
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([COLAB_A, COLAB_B]) as never,
    );
    vi.mocked(listarVinculosDoColaborador).mockImplementation(((id: string) =>
      id === "colab-A" ? dVincA.promise : dVincB.promise) as never);
    vi.mocked(listarVinculosHorario).mockImplementation(((q: {
      colaboradorId?: string;
    }) =>
      q.colaboradorId === "colab-A" ? dHorA.promise : dHorB.promise) as never);

    render(<DadosContratuaisScreen />);
    await escolherColaborador("Alice");
    await escolherColaborador("Bob");

    // Resolve B primeiro (mais recente), depois A (obsoleta).
    dVincB.resolve([
      vinculo({ id: "vb", matricula: "MB", colaboradorId: "colab-B" }),
    ]);
    dHorB.resolve(
      pagina([{ ...HORARIO, id: "hb", vigenciaInicio: "2026-09-09" }]),
    );
    await screen.findByRole("heading", { name: "Vínculo — MB" });

    dVincA.resolve([
      vinculo({ id: "va", matricula: "MA", colaboradorId: "colab-A" }),
    ]);
    dHorA.resolve(
      pagina([{ ...HORARIO, id: "ha", vigenciaInicio: "2020-01-01" }]),
    );
    await Promise.resolve();
    await Promise.resolve();

    // Só B permanece visível; nada de A vaza para a tela.
    expect(
      screen.getByRole("heading", { name: "Vínculo — MB" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/MA/)).not.toBeInTheDocument();
    expect(screen.queryByText("01/01/2020")).not.toBeInTheDocument();
    expect(screen.getAllByText("09/09/2026").length).toBeGreaterThan(0);
  });

  it("troca de vínculo: alocações/linha do tempo tardias de V1 não aparecem no detalhe de V2", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([COLAB_1]) as never,
    );
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      vinculo({ id: "v1", matricula: "V1" }),
      vinculo({ id: "v2", matricula: "V2" }),
    ] as never);
    vi.mocked(listarCargos).mockResolvedValue(
      pagina([
        { id: "cargo-1", codigo: "ANL", nome: "Analista" },
        { id: "cargo-2", codigo: "GER", nome: "Gerente" },
      ]) as never,
    );
    const dAlocV1 = deferred<unknown>();
    const dLinhaV1 = deferred<unknown>();
    vi.mocked(listarAlocacoesVinculo).mockImplementation(((id: string) =>
      id === "v1"
        ? dAlocV1.promise
        : Promise.resolve([
            { ...ALOC, id: "av2", cargoId: "cargo-2" },
          ])) as never);
    vi.mocked(buscarLinhaDoTempo).mockImplementation(((id: string) =>
      id === "v1" ? dLinhaV1.promise : Promise.resolve([MOV])) as never);

    render(<DadosContratuaisScreen />);
    const selVinc = await screen.findByLabelText("Vínculo");
    fireEvent.change(selVinc, { target: { value: "v1" } });
    fireEvent.change(selVinc, { target: { value: "v2" } });

    await screen.findByRole("heading", { name: "Vínculo — V2" });
    // V2 resolvido: mostra "Gerente"; V1 nunca deve aparecer.
    expect((await screen.findAllByText(/Gerente/)).length).toBeGreaterThan(0);

    dAlocV1.resolve([{ ...ALOC, id: "av1", cargoId: "cargo-1" }]);
    dLinhaV1.resolve([MOV]);
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByText(/Analista/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Gerente/).length).toBeGreaterThan(0);
  });

  it("duas cargas para o MESMO colaborador (re-seleção): só a mais recente aplica", async () => {
    const dA1 = deferred<unknown>();
    const dA2 = deferred<unknown>();
    const filaA = [dA1, dA2];
    vi.mocked(listarColaboradores).mockResolvedValue(
      pagina([COLAB_A, COLAB_B]) as never,
    );
    vi.mocked(listarVinculosDoColaborador).mockImplementation(((id: string) => {
      if (id === "colab-A") return (filaA.shift() ?? dA2).promise;
      return Promise.resolve([
        vinculo({ id: "vb", matricula: "MB", colaboradorId: "colab-B" }),
      ]);
    }) as never);

    render(<DadosContratuaisScreen />);
    await escolherColaborador("Alice"); // carga A #1 (dA1)
    await escolherColaborador("Bob");
    await escolherColaborador("Alice"); // carga A #2 (dA2)

    // Resolve a SEGUNDA carga de A primeiro, depois a primeira (obsoleta).
    dA2.resolve([
      vinculo({ id: "va2", matricula: "MA2", colaboradorId: "colab-A" }),
    ]);
    await screen.findByRole("heading", { name: "Vínculo — MA2" });

    dA1.resolve([
      vinculo({ id: "va1", matricula: "MA1", colaboradorId: "colab-A" }),
    ]);
    await Promise.resolve();
    await Promise.resolve();

    expect(
      screen.getByRole("heading", { name: "Vínculo — MA2" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/MA1/)).not.toBeInTheDocument();
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

describe("T188 — Dados contratuais sem o teto de 100", () => {
  it("escolhe a 120ª pessoa pela matrícula e consulta os vínculos dela", async () => {
    servidorComCentoECinquenta();
    render(<DadosContratuaisScreen />);
    await buscarEEscolher("MAT-120", /^Pessoa Teste 120/);
    await waitFor(() =>
      expect(listarVinculosDoColaborador).toHaveBeenCalledWith("c-120"),
    );
  });

  it("com mais de um no escopo, nada é escolhido sozinho", async () => {
    servidorComCentoECinquenta();
    render(<DadosContratuaisScreen />);
    await screen.findByRole("list", { name: "Colaboradores encontrados" });
    expect(
      screen.getByText("Nenhum colaborador selecionado."),
    ).toBeInTheDocument();
    expect(listarVinculosDoColaborador).not.toHaveBeenCalled();
  });

  it("somente leitura: a tela não oferece edição", async () => {
    configurarPadrao({ colaboradores: [COLAB_1], vinculos: [vinculo()] });
    render(<DadosContratuaisScreen />);
    await screen.findByRole("heading", { name: "Vínculo — M-001" });
    for (const acao of [/Salvar/, /Editar/, /Registrar/, /Efetivar/]) {
      expect(screen.queryByRole("button", { name: acao })).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// T198 — a visão da empresa continua aqui (D24), com atalho coerente para a
// ficha do colaborador escolhido; embutida na ficha, sem seletor nem atalho.
// ---------------------------------------------------------------------------
describe("T198 — Dados contratuais e a ficha do colaborador", () => {
  it("visão da empresa: escolhido o colaborador, 'Abrir ficha de …' leva o id dele", async () => {
    configurarPadrao({
      colaboradores: [COLAB_1, COLAB_2],
      vinculos: [vinculo()],
    });
    const onAbrirFicha = vi.fn();
    render(<DadosContratuaisScreen onAbrirFicha={onAbrirFicha} />);
    expect(
      screen.queryByRole("button", { name: /^Abrir ficha de/ }),
    ).toBeNull();

    await escolherColaborador(COLAB_1.nome);
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Abrir ficha de ${COLAB_1.nome}`,
      }),
    );
    expect(onAbrirFicha).toHaveBeenCalledWith(COLAB_1.id);
  });

  it("embutida na ficha: sem h1, sem seletor e sem atalho para a própria ficha", async () => {
    configurarPadrao({ colaboradores: [COLAB_1], vinculos: [vinculo()] });
    render(
      <DadosContratuaisScreen
        colaborador={{ id: COLAB_1.id, nome: COLAB_1.nome }}
        onAbrirFicha={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Vínculo — M-001" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(
      screen.queryByLabelText("Colaborador (buscar por nome ou matrícula)"),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Abrir ficha de/ }),
    ).toBeNull();
  });
});
