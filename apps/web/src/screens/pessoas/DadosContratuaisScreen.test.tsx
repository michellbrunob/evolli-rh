import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
};
const COLAB_2 = { ...COLAB_1, id: "colab-2", nome: "Colaborador Dois" };

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
    await screen.findByLabelText("Colaborador");
  });

  it("múltiplos colaboradores: não seleciona em silêncio", async () => {
    render(<DadosContratuaisScreen />);
    const sel = (await screen.findByLabelText(
      "Colaborador",
    )) as HTMLSelectElement;
    expect(sel.value).toBe("");
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
      await screen.findByText("Nenhum colaborador no seu escopo"),
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
    expect(await screen.findByLabelText("Colaborador")).toBeInTheDocument();
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

  it("detalhe exibe matrícula, tipo, situação, admissão e desligamento", async () => {
    configurarPadrao({
      colaboradores: [COLAB_1],
      vinculos: [
        vinculo({ situacao: "encerrado", dataDesligamento: "2026-06-30" }),
      ],
    });
    render(<DadosContratuaisScreen />);
    await screen.findByRole("heading", { name: "Vínculo — M-001" });
    expect(screen.getAllByText("2026-01-05").length).toBeGreaterThan(0);
    expect(screen.getByText("2026-06-30")).toBeInTheDocument();
    expect(screen.getAllByText("Encerrado").length).toBeGreaterThan(0);
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
