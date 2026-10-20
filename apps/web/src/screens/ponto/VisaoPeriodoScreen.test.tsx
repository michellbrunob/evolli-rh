import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VisaoPeriodoScreen } from "./VisaoPeriodoScreen";
import {
  type ColaboradorApi,
  type ListagemColaboradoresApi,
  type VinculoApi,
  listarColaboradores,
  listarVinculosDoColaborador,
} from "../../api/colaboradoresClient";
import {
  type EventoPontoApi,
  type EventoPontoDetalhadoApi,
  buscarPonto,
  listarPontos,
  registrarAjustePonto,
  registrarPonto,
} from "../../api/pontoClient";
import {
  type TabelaHorarioApi,
  buscarTabelaHorario,
} from "../../api/horariosClient";
import {
  type VinculoHorarioApi,
  listarVinculosHorario,
} from "../../api/vinculoHorarioClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/pontoClient");
vi.mock("../../api/horariosClient");
vi.mock("../../api/vinculoHorarioClient");

interface Paginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

function paginado<T>(itens: T[]): Paginado<T> {
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

const colaborador1: ColaboradorApi = {
  id: "c1111111-1111-1111-1111-111111111111",
  nome: "Ana Colaboradora (teste)",
  situacao: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const colaborador2: ColaboradorApi = {
  id: "c2222222-2222-2222-2222-222222222222",
  nome: "Bruno Colaborador (teste)",
  situacao: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const vinculo1: VinculoApi = {
  id: "v1111111-1111-1111-1111-111111111111",
  colaboradorId: colaborador1.id,
  empresaId: "e0000000-0000-0000-0000-000000000000",
  matricula: "MAT-0001",
  tipo: "clt",
  situacao: "ativo",
  dataAdmissao: "2025-01-01",
  dataDesligamento: null,
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const vinculo2: VinculoApi = {
  id: "v2222222-2222-2222-2222-222222222222",
  colaboradorId: colaborador2.id,
  empresaId: "e0000000-0000-0000-0000-000000000000",
  matricula: "MAT-0002",
  tipo: "clt",
  situacao: "ativo",
  dataAdmissao: "2025-01-01",
  dataDesligamento: null,
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const eventoOriginal: EventoPontoApi = {
  id: "p1111111-1111-1111-1111-111111111111",
  vinculoId: vinculo1.id,
  empresaId: vinculo1.empresaId,
  tipo: "entrada",
  momento: "2026-03-10T11:00:00.000Z",
  competencia: "2026-03",
  registradoPorUserId: "u0000000-0000-0000-0000-000000000000",
  registradoEm: "2026-03-10T11:05:00.000Z",
  efetivo: {
    tipo: "entrada",
    momento: "2026-03-10T11:00:00.000Z",
    anulado: false,
    totalAjustes: 0,
  },
};

const eventoAjustado: EventoPontoApi = {
  id: "p2222222-2222-2222-2222-222222222222",
  vinculoId: vinculo2.id,
  empresaId: vinculo2.empresaId,
  tipo: "saida",
  momento: "2026-03-11T20:00:00.000Z",
  competencia: "2026-03",
  registradoPorUserId: "u0000000-0000-0000-0000-000000000000",
  registradoEm: "2026-03-11T20:05:00.000Z",
  efetivo: {
    tipo: "saida",
    momento: "2026-03-11T18:00:00.000Z",
    anulado: false,
    totalAjustes: 1,
  },
};

const detalheOriginal: EventoPontoDetalhadoApi = {
  ...eventoOriginal,
  ajustes: [],
};

const detalheAjustado: EventoPontoDetalhadoApi = {
  ...eventoAjustado,
  ajustes: [
    {
      id: "a1111111-1111-1111-1111-111111111111",
      motivoCodigo: "erro_de_digitacao",
      anula: false,
      momentoCorrigido: "2026-03-11T18:00:00.000Z",
      tipoCorrigido: null,
      registradoPorUserId: "u0000000-0000-0000-0000-000000000000",
      registradoEm: "2026-03-11T21:00:00.000Z",
    },
  ],
};

const tabelaComercial: TabelaHorarioApi = {
  id: "th111111-1111-1111-1111-111111111111",
  empresaId: vinculo1.empresaId,
  nome: "Tabela Comercial (teste)",
  ativo: true,
  criadoPorUserId: "u0000000-0000-0000-0000-000000000000",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
  periodos: [{ dia: "segunda", inicio: "08:00", fim: "17:00" }],
};

const tabelaMeioPeriodo: TabelaHorarioApi = {
  id: "th222222-2222-2222-2222-222222222222",
  empresaId: vinculo1.empresaId,
  nome: "Tabela Meio Período (teste)",
  ativo: true,
  criadoPorUserId: "u0000000-0000-0000-0000-000000000000",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
  periodos: [{ dia: "segunda", inicio: "08:00", fim: "12:00" }],
};

/** Vigência aberta, cobre qualquer competência a partir de 2026-01. */
const vinculoHorarioAberto: VinculoHorarioApi = {
  id: "vh111111-1111-1111-1111-111111111111",
  colaboradorId: colaborador1.id,
  empresaId: vinculo1.empresaId,
  tabelaHorarioId: tabelaComercial.id,
  vigenciaInicio: "2026-01-01",
  vigenciaFim: null,
  criadoPorUserId: "u0000000-0000-0000-0000-000000000000",
  criadoEm: "2026-01-01T12:00:00.000Z",
  atualizadoEm: "2026-01-01T12:00:00.000Z",
};

/** Duas vigências que se sobrepõem à competência 2026-03 (troca no meio do mês). */
const vinculoHorarioAntesDaTroca: VinculoHorarioApi = {
  id: "vh222222-2222-2222-2222-222222222222",
  colaboradorId: colaborador1.id,
  empresaId: vinculo1.empresaId,
  tabelaHorarioId: tabelaComercial.id,
  vigenciaInicio: "2025-06-01",
  vigenciaFim: "2026-03-15",
  criadoPorUserId: "u0000000-0000-0000-0000-000000000000",
  criadoEm: "2025-06-01T12:00:00.000Z",
  atualizadoEm: "2026-03-15T12:00:00.000Z",
};

const vinculoHorarioDepoisDaTroca: VinculoHorarioApi = {
  id: "vh333333-3333-3333-3333-333333333333",
  colaboradorId: colaborador1.id,
  empresaId: vinculo1.empresaId,
  tabelaHorarioId: tabelaMeioPeriodo.id,
  vigenciaInicio: "2026-03-15",
  vigenciaFim: null,
  criadoPorUserId: "u0000000-0000-0000-0000-000000000000",
  criadoEm: "2026-03-15T12:00:00.000Z",
  atualizadoEm: "2026-03-15T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarColaboradores).mockResolvedValue(
    listagem([colaborador1, colaborador2]),
  );
  vi.mocked(listarVinculosDoColaborador).mockImplementation(async (id) =>
    id === colaborador1.id ? [vinculo1] : [vinculo2],
  );
  vi.mocked(listarPontos).mockResolvedValue(
    paginado([eventoOriginal, eventoAjustado]),
  );
  vi.mocked(buscarPonto).mockResolvedValue(detalheOriginal);
  vi.mocked(registrarPonto).mockResolvedValue(eventoOriginal);
  vi.mocked(registrarAjustePonto).mockResolvedValue(
    detalheAjustado.ajustes[0]!,
  );
  vi.mocked(listarVinculosHorario).mockResolvedValue(
    paginado([vinculoHorarioAberto]),
  );
  vi.mocked(buscarTabelaHorario).mockImplementation(async (id) => {
    if (id === tabelaComercial.id) return tabelaComercial;
    if (id === tabelaMeioPeriodo.id) return tabelaMeioPeriodo;
    throw new Error("tabela não encontrada (teste)");
  });
});

async function aguardarLista() {
  return screen.findByRole("table", { name: "Marcações de ponto" });
}

describe("VisaoPeriodoScreen (T113 — funcional)", () => {
  it("tem um único h1 e o aviso RH e DP", async () => {
    render(<VisaoPeriodoScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Visão do período" }),
    ).toHaveLength(1);
    expect(screen.getByText("RH e DP")).toBeInTheDocument();

    await waitFor(() => expect(listarPontos).toHaveBeenCalled());
  });

  it("lista marcações reais com colaborador, tipo, momento, competência e situação", async () => {
    render(<VisaoPeriodoScreen />);

    const tabela = await aguardarLista();
    const dentro = within(tabela);
    expect(dentro.getByText(/Ana Colaboradora \(teste\)/)).toBeInTheDocument();
    expect(dentro.getByText("Entrada")).toBeInTheDocument();
    // `2026-03-10T11:00:00.000Z` são 08:00 em America/Sao_Paulo (T154).
    expect(dentro.getByText("10/03/2026 às 08:00")).toBeInTheDocument();
    expect(dentro.getAllByText("03/2026").length).toBeGreaterThan(0);
    expect(dentro.getByText("Original")).toBeInTheDocument();
    expect(dentro.getByText("Ajustada")).toBeInTheDocument();
  });

  it("mostra o estado de carregamento antes dos dados", async () => {
    let resolver: (v: Paginado<EventoPontoApi>) => void;
    vi.mocked(listarPontos).mockReturnValueOnce(
      new Promise((resolve) => {
        resolver = resolve;
      }) as ReturnType<typeof listarPontos>,
    );

    render(<VisaoPeriodoScreen />);
    expect(screen.getByText("Carregando marcações…")).toBeInTheDocument();

    resolver!(paginado([eventoOriginal]));
    await aguardarLista();
  });

  it("mostra erro de carregamento e permite tentar novamente", async () => {
    vi.mocked(listarPontos).mockRejectedValueOnce(new Error("falha"));

    render(<VisaoPeriodoScreen />);
    await screen.findByRole("heading", {
      name: "Não foi possível carregar as marcações",
    });

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await aguardarLista();
  });

  it("mostra EmptyState quando não há marcações", async () => {
    vi.mocked(listarPontos).mockResolvedValue(paginado([]));

    render(<VisaoPeriodoScreen />);
    expect(
      await screen.findByRole("heading", {
        name: "Nenhuma marcação encontrada",
      }),
    ).toBeInTheDocument();
  });

  it("filtra por competência enviando o parâmetro à API", async () => {
    render(<VisaoPeriodoScreen />);
    await aguardarLista();

    fireEvent.change(screen.getByLabelText("Competência"), {
      target: { value: "2026-03" },
    });

    await waitFor(() =>
      expect(listarPontos).toHaveBeenLastCalledWith(
        expect.objectContaining({ competencia: "2026-03" }),
      ),
    );
  });

  it("filtra por vínculo e por tipo enviando os parâmetros à API", async () => {
    render(<VisaoPeriodoScreen />);
    await aguardarLista();

    fireEvent.change(screen.getByLabelText("Vínculo"), {
      target: { value: vinculo1.id },
    });
    await waitFor(() =>
      expect(listarPontos).toHaveBeenLastCalledWith(
        expect.objectContaining({ vinculoId: vinculo1.id }),
      ),
    );

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "saida" },
    });
    await waitFor(() =>
      expect(listarPontos).toHaveBeenLastCalledWith(
        expect.objectContaining({ tipo: "saida" }),
      ),
    );
  });

  it("abre o formulário de registro: múltiplos vínculos exigem seleção explícita", async () => {
    render(<VisaoPeriodoScreen />);
    await aguardarLista();

    fireEvent.click(screen.getByRole("button", { name: "Registrar marcação" }));

    const form = screen.getByRole("form", {
      name: "Formulário de nova marcação",
    });
    expect(form).toBeInTheDocument();
    expect(within(form).getByLabelText(/Vínculo/i)).toBeInTheDocument();
  });

  it("valida vínculo, tipo e momento obrigatórios", async () => {
    render(<VisaoPeriodoScreen />);
    await aguardarLista();
    fireEvent.click(screen.getByRole("button", { name: "Registrar marcação" }));

    fireEvent.click(
      within(
        screen.getByRole("form", { name: "Formulário de nova marcação" }),
      ).getByRole("button", { name: "Registrar marcação" }),
    );

    expect(await screen.findByText("Selecione o vínculo.")).toBeInTheDocument();
    expect(
      screen.getByText("Selecione o tipo de marcação."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Informe a data e hora da marcação."),
    ).toBeInTheDocument();
    expect(registrarPonto).not.toHaveBeenCalled();
  });

  it("registra marcação com sucesso e recarrega a lista", async () => {
    render(<VisaoPeriodoScreen />);
    await aguardarLista();
    const antes = vi.mocked(listarPontos).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Registrar marcação" }));
    const form = screen.getByRole("form", {
      name: "Formulário de nova marcação",
    });
    fireEvent.change(within(form).getByLabelText(/Vínculo/i), {
      target: { value: vinculo1.id },
    });
    fireEvent.change(within(form).getByLabelText(/Tipo de marcação/i), {
      target: { value: "entrada" },
    });
    fireEvent.change(within(form).getByLabelText(/Data e hora/i), {
      target: { value: "2026-03-12T08:00" },
    });
    fireEvent.click(
      within(form).getByRole("button", { name: "Registrar marcação" }),
    );

    await waitFor(() =>
      expect(registrarPonto).toHaveBeenCalledWith(
        expect.objectContaining({ vinculoId: vinculo1.id, tipo: "entrada" }),
      ),
    );
    const dto = vi.mocked(registrarPonto).mock.calls[0]![0];
    expect(dto.momento).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    await waitFor(() =>
      expect(vi.mocked(listarPontos).mock.calls.length).toBe(antes + 1),
    );
  });

  it("bloqueia registro quando não há vínculo ativo", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(listagem([]));

    render(<VisaoPeriodoScreen />);
    await aguardarLista();

    expect(
      screen.getByText(
        "Nenhum vínculo ativo disponível para registrar marcação.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar marcação" }),
    ).toBeDisabled();
  });

  it("resolve automaticamente o vínculo quando há só um ativo", async () => {
    vi.mocked(listarColaboradores).mockResolvedValue(listagem([colaborador1]));

    render(<VisaoPeriodoScreen />);
    await aguardarLista();
    fireEvent.click(screen.getByRole("button", { name: "Registrar marcação" }));
    const form = screen.getByRole("form", {
      name: "Formulário de nova marcação",
    });

    expect(within(form).queryByLabelText(/Vínculo/i)).not.toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText(/Tipo de marcação/i), {
      target: { value: "entrada" },
    });
    fireEvent.change(within(form).getByLabelText(/Data e hora/i), {
      target: { value: "2026-03-12T08:00" },
    });
    fireEvent.click(
      within(form).getByRole("button", { name: "Registrar marcação" }),
    );

    await waitFor(() =>
      expect(registrarPonto).toHaveBeenCalledWith(
        expect.objectContaining({ vinculoId: vinculo1.id }),
      ),
    );
  });

  it("abre o detalhe mostrando registro original, valor efetivo e histórico de ajustes", async () => {
    vi.mocked(buscarPonto).mockResolvedValueOnce(detalheAjustado);

    render(<VisaoPeriodoScreen />);
    await aguardarLista();

    const linha = screen.getByText("Ajustada").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

    expect(buscarPonto).toHaveBeenCalledWith(eventoAjustado.id);
    await screen.findByRole("heading", { name: "Detalhe da marcação" });

    expect(screen.getByText("Registro original")).toBeInTheDocument();
    // 20:00Z → 17:00 e 18:00Z → 15:00 em America/Sao_Paulo (T154).
    expect(screen.getByText("Saída · 11/03/2026 às 17:00")).toBeInTheDocument();
    expect(screen.getByText("Valor efetivo")).toBeInTheDocument();
    expect(screen.getByText("Saída · 11/03/2026 às 15:00")).toBeInTheDocument();

    const historico = screen.getByRole("table", {
      name: /Histórico de ajustes/,
    });
    expect(within(historico).getByText("Correção")).toBeInTheDocument();
    expect(
      within(historico).getByText("Erro de digitação"),
    ).toBeInTheDocument();
    // "Novo momento" (18:00Z) e "Registrado em" (21:00Z) em America/Sao_Paulo.
    expect(
      within(historico).getByText("11/03/2026 às 15:00"),
    ).toBeInTheDocument();
    expect(
      within(historico).getByText("11/03/2026 às 18:00"),
    ).toBeInTheDocument();
  });

  it("registra ajuste de correção pelo catálogo fechado e recarrega o detalhe", async () => {
    render(<VisaoPeriodoScreen />);
    await aguardarLista();

    const linha = screen.getByText("Original").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
    await screen.findByRole("form", {
      name: "Formulário de ajuste de marcação",
    });

    // catálogo fechado: exatamente os 4 motivos + placeholder
    const selectMotivo = screen.getByLabelText(/^Motivo/i);
    expect(within(selectMotivo).getAllByRole("option")).toHaveLength(5);

    fireEvent.change(selectMotivo, { target: { value: "erro_de_digitacao" } });
    fireEvent.change(screen.getByLabelText("Novo momento (opcional)"), {
      target: { value: "2026-03-10T09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ajuste" }));

    await waitFor(() =>
      expect(registrarAjustePonto).toHaveBeenCalledWith(
        eventoOriginal.id,
        expect.objectContaining({ motivoCodigo: "erro_de_digitacao" }),
      ),
    );
    // não envia anula em correção
    const dto = vi.mocked(registrarAjustePonto).mock.calls[0]![1];
    expect(dto.anula).toBeUndefined();
    expect(dto.momentoCorrigido).toBeTruthy();
  });

  it("exige um novo valor ao corrigir (sem momento nem tipo bloqueia)", async () => {
    render(<VisaoPeriodoScreen />);
    await aguardarLista();

    const linha = screen.getByText("Original").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
    await screen.findByRole("form", {
      name: "Formulário de ajuste de marcação",
    });

    fireEvent.change(screen.getByLabelText(/^Motivo/i), {
      target: { value: "erro_de_digitacao" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ajuste" }));

    expect(
      await screen.findByText(
        "Informe ao menos um novo valor (data/hora ou tipo) para corrigir.",
      ),
    ).toBeInTheDocument();
    expect(registrarAjustePonto).not.toHaveBeenCalled();
  });

  it("anula a marcação enviando anula:true, sem exigir novo valor", async () => {
    render(<VisaoPeriodoScreen />);
    await aguardarLista();

    const linha = screen.getByText("Original").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
    await screen.findByRole("form", {
      name: "Formulário de ajuste de marcação",
    });

    fireEvent.change(screen.getByLabelText(/Tipo de ajuste/i), {
      target: { value: "anular" },
    });
    fireEvent.change(screen.getByLabelText(/^Motivo/i), {
      target: { value: "registro_indevido" },
    });
    // ao anular, não há campos de correção
    expect(
      screen.queryByLabelText("Novo momento (opcional)"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Registrar ajuste" }));

    await waitFor(() =>
      expect(registrarAjustePonto).toHaveBeenCalledWith(eventoOriginal.id, {
        motivoCodigo: "registro_indevido",
        anula: true,
      }),
    );
  });

  it("preserva o registro original: detalhe anulado ainda mostra o original e não oferece novo ajuste", async () => {
    const detalheAnulado: EventoPontoDetalhadoApi = {
      ...detalheOriginal,
      efetivo: { ...detalheOriginal.efetivo, anulado: true, totalAjustes: 1 },
      ajustes: [
        {
          id: "a9999999-9999-9999-9999-999999999999",
          motivoCodigo: "registro_indevido",
          anula: true,
          momentoCorrigido: null,
          tipoCorrigido: null,
          registradoPorUserId: "u0000000-0000-0000-0000-000000000000",
          registradoEm: "2026-03-10T12:00:00.000Z",
        },
      ],
    };
    vi.mocked(buscarPonto).mockResolvedValueOnce(detalheAnulado);

    render(<VisaoPeriodoScreen />);
    await aguardarLista();

    const linha = screen.getByText("Original").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
    await screen.findByRole("heading", { name: "Detalhe da marcação" });

    // original preservado (11:00Z = 08:00 em America/Sao_Paulo — T154)
    expect(
      screen.getByText("Entrada · 10/03/2026 às 08:00"),
    ).toBeInTheDocument();
    // efetivo anulado, sem formulário de novo ajuste
    expect(
      screen.getByText(/anulação é terminal e não aceita novos ajustes/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("form", {
        name: "Formulário de ajuste de marcação",
      }),
    ).not.toBeInTheDocument();
  });

  it("mostra o erro da API ao falhar o ajuste (ex.: já anulado)", async () => {
    vi.mocked(registrarAjustePonto).mockRejectedValueOnce(
      new Error("Evento ja anulado nao aceita novo ajuste"),
    );

    render(<VisaoPeriodoScreen />);
    await aguardarLista();
    const linha = screen.getByText("Original").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
    await screen.findByRole("form", {
      name: "Formulário de ajuste de marcação",
    });

    fireEvent.change(screen.getByLabelText(/Tipo de ajuste/i), {
      target: { value: "anular" },
    });
    fireEvent.change(screen.getByLabelText(/^Motivo/i), {
      target: { value: "registro_indevido" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ajuste" }));

    expect(
      await screen.findByText("Evento ja anulado nao aceita novo ajuste"),
    ).toBeInTheDocument();
  });

  it("fecha o detalhe", async () => {
    render(<VisaoPeriodoScreen />);
    await aguardarLista();
    const linha = screen.getByText("Original").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
    await screen.findByRole("heading", { name: "Detalhe da marcação" });

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(
      screen.queryByRole("heading", { name: "Detalhe da marcação" }),
    ).not.toBeInTheDocument();
  });

  it("não exibe cálculo de jornada, saldo, Banco de Horas, DSR, AFD ou Folha", async () => {
    render(<VisaoPeriodoScreen />);
    await aguardarLista();
    fireEvent.click(screen.getByRole("button", { name: "Registrar marcação" }));

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "banco de horas",
      "saldo",
      "jornada prevista",
      "hora extra",
      "dsr",
      "afd",
      "fechamento",
      "espelho",
      "folha",
      "cpf",
      "senha",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("não deixa nenhuma data ISO chegar à tela (T154)", async () => {
    vi.mocked(buscarPonto).mockResolvedValueOnce(detalheAjustado);

    render(<VisaoPeriodoScreen />);
    await aguardarLista();
    expectSemIsoVisivel(document.body);

    // Detalhe com histórico de ajustes: momento, momentoCorrigido,
    // registradoEm e competência.
    const linha = screen.getByText("Ajustada").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
    await screen.findByText("Registro original");
    expectSemIsoVisivel(document.body);

    // Painel de horários de referência: competência no título e vigências.
    fireEvent.change(screen.getByLabelText("Vínculo"), {
      target: { value: vinculo1.id },
    });
    fireEvent.change(screen.getByLabelText("Competência"), {
      target: { value: "2026-03" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ver horários de referência" }),
    );
    await screen.findByText("Tabela Comercial (teste)");
    expectSemIsoVisivel(document.body);
  });

  describe("Ver horários de referência (T114 — somente leitura)", () => {
    async function selecionarVinculoECompetencia(
      vinculoId: string,
      competencia: string,
    ) {
      fireEvent.change(screen.getByLabelText("Vínculo"), {
        target: { value: vinculoId },
      });
      fireEvent.change(screen.getByLabelText("Competência"), {
        target: { value: competencia },
      });
      // Trocar os filtros recarrega a listagem de marcações (passa por
      // "carregando"), o que desabilita o botão momentaneamente — espera
      // assentar antes de agir sobre ele.
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Ver horários de referência" }),
        ).not.toBeDisabled(),
      );
    }

    it("o botão fica desabilitado sem vínculo específico e competência selecionados", async () => {
      render(<VisaoPeriodoScreen />);
      await aguardarLista();

      expect(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      ).toBeDisabled();
      expect(
        screen.getByText(/Selecione um vínculo específico e uma competência/i),
      ).toBeInTheDocument();

      // Só vínculo, sem competência: continua desabilitado (sem seleção
      // silenciosa de "hoje" nem de "o mais recente").
      fireEvent.change(screen.getByLabelText("Vínculo"), {
        target: { value: vinculo1.id },
      });
      await waitFor(() => expect(listarPontos).toHaveBeenCalledTimes(2));
      expect(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      ).toBeDisabled();

      // Vínculo + competência: habilita.
      fireEvent.change(screen.getByLabelText("Competência"), {
        target: { value: "2026-03" },
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Ver horários de referência" }),
        ).not.toBeDisabled(),
      );
    });

    it("relaciona o vínculo selecionado ao colaborador autorizado ao consultar", async () => {
      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");

      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );

      await waitFor(() =>
        expect(listarVinculosHorario).toHaveBeenCalledWith({
          colaboradorId: colaborador1.id,
          tamanhoPagina: 100,
        }),
      );
    });

    it("abre o painel e mostra a tabela de horário, vigência e períodos projetados", async () => {
      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );

      const tituloPainel = await screen.findByRole("heading", {
        name: /Horários de referência/,
      });
      // Competência no título do painel: "2026-03" vira "03/2026" (T154).
      expect(tituloPainel).toHaveTextContent("· 03/2026");
      expect(screen.getByText("Tabela Comercial (teste)")).toBeInTheDocument();
      // Data civil: 2026-01-01 continua sendo o dia 01, sem deslocar (T154).
      expect(
        screen.getByText("Vigência: 01/01/2026 – vigente"),
      ).toBeInTheDocument();

      const tabelaPeriodos = screen.getByRole("table", {
        name: "Períodos — Tabela Comercial (teste)",
      });
      expect(
        within(tabelaPeriodos).getByText("Segunda-feira"),
      ).toBeInTheDocument();
      expect(within(tabelaPeriodos).getByText("08:00")).toBeInTheDocument();
      expect(within(tabelaPeriodos).getByText("17:00")).toBeInTheDocument();

      // Referência única: sem nota de múltiplas vigências.
      expect(
        screen.queryByText(/Mais de uma tabela de horário vigorou/),
      ).not.toBeInTheDocument();
    });

    it("mostra o estado de carregamento do painel antes dos dados chegarem", async () => {
      let resolver: (v: Paginado<VinculoHorarioApi>) => void;
      vi.mocked(listarVinculosHorario).mockReturnValueOnce(
        new Promise((resolve) => {
          resolver = resolve;
        }) as ReturnType<typeof listarVinculosHorario>,
      );

      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );

      expect(
        screen.getByText("Carregando horários de referência…"),
      ).toBeInTheDocument();

      resolver!(paginado([vinculoHorarioAberto]));
      await screen.findByText("Tabela Comercial (teste)");
    });

    it("resposta atrasada de uma consulta anterior não sobrescreve o painel de outro vínculo/competência já aberto", async () => {
      let resolverA: (v: Paginado<VinculoHorarioApi>) => void;
      let resolverB: (v: Paginado<VinculoHorarioApi>) => void;
      vi.mocked(listarVinculosHorario)
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolverA = resolve;
          }) as ReturnType<typeof listarVinculosHorario>,
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolverB = resolve;
          }) as ReturnType<typeof listarVinculosHorario>,
        );

      render(<VisaoPeriodoScreen />);
      await aguardarLista();

      // Abre a referência do vínculo A (colaborador1) / 2026-03 — fica pendente.
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );
      await screen.findByRole("heading", {
        name: /Ana Colaboradora \(teste\)/,
      });

      // Troca para o vínculo B (colaborador2) / 2026-05 e reabre — segunda
      // consulta também fica pendente, sem que a primeira tenha respondido.
      await selecionarVinculoECompetencia(vinculo2.id, "2026-05");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );
      await screen.findByRole("heading", {
        name: /Bruno Colaborador \(teste\)/,
      });

      // A resposta atrasada de A chega DEPOIS de o painel já mostrar B — não
      // pode preencher o painel de B com os dados de A.
      resolverA!(paginado([vinculoHorarioAberto]));
      await Promise.resolve();
      await Promise.resolve();
      expect(
        screen.getByRole("heading", { name: /Bruno Colaborador \(teste\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Carregando horários de referência…"),
      ).toBeInTheDocument();

      // A resposta de B, quando chega, é exibida normalmente.
      resolverB!(paginado([vinculoHorarioAberto]));
      await screen.findByText("Tabela Comercial (teste)");
      expect(
        screen.getByRole("heading", { name: /Bruno Colaborador \(teste\)/ }),
      ).toBeInTheDocument();
    });

    it("mostra erro no painel e permite tentar novamente", async () => {
      vi.mocked(listarVinculosHorario).mockRejectedValueOnce(
        new Error("falha"),
      );

      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );

      expect(
        await screen.findByText(
          "Não foi possível carregar os horários de referência.",
        ),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
      await screen.findByText("Tabela Comercial (teste)");
    });

    it("indica claramente quando não há horário de referência aplicável à competência", async () => {
      // Vigência encerrada bem antes de março — não sobrepõe a competência.
      vi.mocked(listarVinculosHorario).mockResolvedValue(
        paginado([
          {
            ...vinculoHorarioAberto,
            vigenciaInicio: "2024-01-01",
            vigenciaFim: "2024-06-01",
          },
        ]),
      );

      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );

      expect(
        await screen.findByText(
          "Nenhum horário de referência aplicável a esta competência.",
        ),
      ).toBeInTheDocument();
    });

    it("mostra múltiplas vigências em ordem cronológica quando há troca dentro da competência", async () => {
      vi.mocked(listarVinculosHorario).mockResolvedValue(
        paginado([vinculoHorarioDepoisDaTroca, vinculoHorarioAntesDaTroca]),
      );

      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );

      await screen.findByText(/Mais de uma tabela de horário vigorou/);

      const titulos = screen
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent);
      const posicaoComercial = titulos.findIndex((t) =>
        t?.includes("Tabela Comercial (teste)"),
      );
      const posicaoMeioPeriodo = titulos.findIndex((t) =>
        t?.includes("Tabela Meio Período (teste)"),
      );
      expect(posicaoComercial).toBeGreaterThanOrEqual(0);
      expect(posicaoMeioPeriodo).toBeGreaterThan(posicaoComercial);

      expect(
        screen.getByText("Vigência: 01/06/2025 – 15/03/2026"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Vigência: 15/03/2026 – vigente"),
      ).toBeInTheDocument();
    });

    it("declara explicitamente que é referência de consulta, sem mutação", async () => {
      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );

      const aviso = await screen.findByText(
        /não corrige marcação, não calcula jornada, tolerância, horas extras, faltas ou DSR, não gera ajuste, não fecha período e não altera saldo, Banco de Horas ou Folha/,
      );
      expect(aviso).toBeInTheDocument();
    });

    it("painel é somente leitura: sem campos de entrada, só Fechar", async () => {
      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );

      const painel = (
        await screen.findByRole("heading", { name: /Horários de referência/ })
      ).closest("section")!;
      expect(within(painel).queryAllByRole("textbox")).toHaveLength(0);
      expect(within(painel).queryAllByRole("combobox")).toHaveLength(0);
      expect(within(painel).getAllByRole("button")).toHaveLength(1);
      expect(
        within(painel).getByRole("button", { name: "Fechar" }),
      ).toBeInTheDocument();
      expect(
        within(painel).queryByRole("button", { name: "Registrar marcação" }),
      ).not.toBeInTheDocument();
      expect(
        within(painel).queryByRole("button", { name: "Registrar ajuste" }),
      ).not.toBeInTheDocument();
    });

    it("fecha o painel de referência", async () => {
      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );
      await screen.findByRole("heading", { name: /Horários de referência/ });

      fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
      expect(
        screen.queryByRole("heading", { name: /Horários de referência/ }),
      ).not.toBeInTheDocument();
    });

    it("abrir o formulário de registro fecha o painel de referência aberto", async () => {
      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );
      await screen.findByRole("heading", { name: /Horários de referência/ });

      fireEvent.click(
        screen.getByRole("button", { name: "Registrar marcação" }),
      );
      expect(
        screen.queryByRole("heading", { name: /Horários de referência/ }),
      ).not.toBeInTheDocument();
    });

    it("abrir o painel de referência fecha um detalhe de marcação aberto", async () => {
      render(<VisaoPeriodoScreen />);
      await aguardarLista();
      const linha = screen.getByText("Original").closest("tr")!;
      fireEvent.click(
        within(linha).getByRole("button", { name: /Ver detalhes/ }),
      );
      await screen.findByRole("heading", { name: "Detalhe da marcação" });
      await screen.findByText("Registro original");

      await selecionarVinculoECompetencia(vinculo1.id, "2026-03");
      fireEvent.click(
        screen.getByRole("button", { name: "Ver horários de referência" }),
      );

      expect(
        screen.queryByRole("heading", { name: "Detalhe da marcação" }),
      ).not.toBeInTheDocument();
    });
  });
});
