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

vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/pontoClient");

interface Paginado<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

function paginado<T>(itens: T[]): Paginado<T> {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarColaboradores).mockResolvedValue(
    paginado([colaborador1, colaborador2]),
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
    expect(dentro.getByText("2026-03-10 11:00")).toBeInTheDocument();
    expect(dentro.getAllByText("2026-03").length).toBeGreaterThan(0);
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
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([]));

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
    vi.mocked(listarColaboradores).mockResolvedValue(paginado([colaborador1]));

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
    expect(screen.getByText(/Saída · 2026-03-11 20:00/)).toBeInTheDocument();
    expect(screen.getByText("Valor efetivo")).toBeInTheDocument();
    expect(screen.getByText(/Saída · 2026-03-11 18:00/)).toBeInTheDocument();

    const historico = screen.getByRole("table", {
      name: /Histórico de ajustes/,
    });
    expect(within(historico).getByText("Correção")).toBeInTheDocument();
    expect(
      within(historico).getByText("Erro de digitação"),
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

    // original preservado
    expect(screen.getByText(/Entrada · 2026-03-10 11:00/)).toBeInTheDocument();
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
});
