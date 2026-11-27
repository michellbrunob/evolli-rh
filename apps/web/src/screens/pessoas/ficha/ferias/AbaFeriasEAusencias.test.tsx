/**
 * T215 — aba Férias e ausências da ficha: Saldo de férias (pela regra do
 * vínculo), Próxima ausência e Histórico de ausências por ano, com
 * registrar, aprovar, recusar, cancelar e o anexo (atestado ou documento).
 * Dados sintéticos.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../api/colaboradoresClient";
import type {
  AusenciaApi,
  FeriasDoColaboradorApi,
} from "../../../../api/ausenciasClient";
import type { ServicoDeAusencias } from "../../ferias/tiposAusencia";
import { AbaFeriasEAusencias } from "./AbaFeriasEAusencias";

const PESSOA = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Ana Teste Lima",
  cargo: "Analista",
};

function ausencia(parcial: Partial<AusenciaApi> = {}): AusenciaApi {
  return {
    id: "a-1",
    colaborador: { ...PESSOA, foto: null },
    tipo: "ferias",
    motivoAfastamento: null,
    inicio: "2026-12-07",
    fim: "2026-12-26",
    dias: 20,
    diasUteis: 13,
    diasVendidos: 0,
    periodoAquisitivo: { inicio: "2025-01-05", fim: "2026-01-04" },
    status: "aprovada",
    observacao: null,
    registradoEm: "2026-11-20T12:00:00.000Z",
    decididoEm: "2026-11-20T12:00:00.000Z",
    anexo: null,
    ...parcial,
  };
}

function ferias(
  parcial: Partial<FeriasDoColaboradorApi> = {},
): FeriasDoColaboradorApi {
  return {
    regraDeFerias: "calculada",
    vinculo: { tipo: "clt", dataAdmissao: "2025-01-05" },
    periodos: [
      {
        inicio: "2025-01-05",
        fim: "2026-01-04",
        direito: 30,
        solicitados: 20,
        disponiveis: 10,
        prazoGozo: "2027-01-04",
        situacao: "disponivel",
        encurtado: null,
      },
      {
        inicio: "2026-01-05",
        fim: "2027-01-04",
        direito: 30,
        solicitados: 0,
        disponiveis: 30,
        prazoGozo: "2028-01-04",
        situacao: "em_aquisicao",
        encurtado: null,
      },
    ],
    periodoAtual: 0,
    reinicios: [],
    proximaAusencia: ausencia(),
    historico: [
      ausencia(),
      ausencia({
        id: "a-2",
        tipo: "licenca_medica",
        inicio: "2025-08-04",
        fim: "2025-08-06",
        dias: 3,
        diasUteis: 3,
        periodoAquisitivo: null,
        anexo: {
          formato: "pdf",
          tamanhoBytes: 120 * 1024,
          enviadoEm: "2025-08-04T12:00:00.000Z",
        },
      }),
      ausencia({
        id: "a-3",
        tipo: "day_off",
        inicio: "2026-03-02",
        fim: "2026-03-02",
        dias: 1,
        diasUteis: 1,
        periodoAquisitivo: null,
        status: "aguardando_rh",
      }),
    ],
    ...parcial,
  };
}

function servico(extra: Partial<ServicoDeAusencias> = {}): ServicoDeAusencias {
  return {
    listar: vi.fn(),
    registrar: vi.fn(async () => ausencia({ id: "a-nova" })),
    simular: vi.fn(async () => ({
      dias: 1,
      diasUteis: 1,
      volta: "2026-12-02",
      periodo: null,
      saldoAntes: null,
      saldoDepois: null,
      maxVendaveis: null,
      prazoAbono: null,
      regraDeFerias: "calculada" as const,
    })),
    aprovar: vi.fn(async (id: string) => ausencia({ id, status: "aprovada" })),
    recusar: vi.fn(async (id: string) => ausencia({ id, status: "recusada" })),
    cancelar: vi.fn(async (id: string) =>
      ausencia({ id, status: "cancelada" }),
    ),
    alterar: vi.fn(async (id: string) => ausencia({ id })),
    simularReinicio: vi.fn(async () => ({
      periodos: [],
      diasCalculados: null,
    })),
    registrarReinicio: vi.fn(async () => ({
      id: "r-1",
      inicio: "2026-11-01",
      motivo: "ferias_coletivas" as const,
      diasPeriodoAnterior: null,
      observacao: null,
    })),
    removerReinicio: vi.fn(async () => undefined),
    excluir: vi.fn(async () => undefined),
    buscarPessoas: vi.fn(async () => [PESSOA]),
    enviarAnexo: vi.fn(async () => undefined),
    removerAnexo: vi.fn(async () => undefined),
    baixarAnexo: vi.fn(async () => ({
      blob: new Blob(["pdf"], { type: "application/pdf" }),
      nome: "atestado.pdf",
    })),
    ...extra,
  };
}

function montar(
  dados: FeriasDoColaboradorApi | Error = ferias(),
  opcoes: { podeEditar?: boolean; s?: ServicoDeAusencias } = {},
) {
  const consultar = vi.fn(async () => {
    if (dados instanceof Error) throw dados;
    return dados;
  });
  const s = opcoes.s ?? servico();
  render(
    <AbaFeriasEAusencias
      pessoa={PESSOA}
      quem="a Ana"
      deQuem="da Ana"
      podeEditar={opcoes.podeEditar ?? true}
      servico={s}
      consultar={consultar}
      hoje="2026-11-24"
    />,
  );
  return { consultar, s };
}

describe("T215 — aba Férias e ausências da ficha", () => {
  it("saldo disponível, como a referência: período no subtítulo, prazo, números, dias e Agendar férias", async () => {
    montar();
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(
      within(saldo).getByText("Período aquisitivo 05/01/2025 – 04/01/2026"),
    ).toBeInTheDocument();
    expect(within(saldo).getByText("10")).toBeInTheDocument();
    expect(within(saldo).getByText("dias disponíveis")).toBeInTheDocument();
    // Hoje 24/11/2026, prazo 04/01/2027: vence em 1 mês.
    expect(within(saldo).getByText("Vence em 1 mês")).toBeInTheDocument();
    expect(
      within(saldo).getByText("prazo para gozo: 04/01/2027"),
    ).toBeInTheDocument();
    const linha = (rotulo: string) =>
      within(saldo).getByText(rotulo, { selector: "dt" }).closest("div")!;
    expect(within(linha("Direito")).getByText("30 dias")).toBeInTheDocument();
    expect(
      within(linha("Solicitados")).getByText("20 dias"),
    ).toBeInTheDocument();
    expect(
      within(linha("Disponíveis")).getByText("10 dias"),
    ).toBeInTheDocument();
    // Um quadradinho por dia do direito; os solicitados marcados.
    expect(saldo.querySelectorAll(".ferias-ficha__dia")).toHaveLength(30);
    expect(
      saldo.querySelectorAll(".ferias-ficha__dia--solicitado"),
    ).toHaveLength(20);
    expect(
      within(saldo).getByText("Solicitados", { selector: "span" }),
    ).toBeInTheDocument();
    expect(
      within(saldo).getByText("Disponíveis para agendar"),
    ).toBeInTheDocument();
    // Sem a etiqueta de situação; o período em aquisição não aparece.
    expect(within(saldo).queryByText("Disponível")).toBeNull();
    expect(within(saldo).queryByText("Em aquisição")).toBeNull();
    expect(within(saldo).queryByText("05/01/2026 – 04/01/2027")).toBeNull();

    fireEvent.click(
      within(saldo).getByRole("button", { name: "Agendar férias" }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Registrar ausência",
    });
    expect(
      within(janela).getByRole("radio", { name: "Férias" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("Agendar férias só para quem edita e com dias a tirar", async () => {
    montar(ferias(), { podeEditar: false });
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(
      within(saldo).queryByRole("button", { name: "Agendar férias" }),
    ).toBeNull();
  });

  it("primeiro período em andamento: só quando começa o direito, sem número nem etiqueta", async () => {
    const base = ferias();
    montar(ferias({ periodos: [base.periodos[1]!], periodoAtual: 0 }));
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(
      within(saldo).getByText("Primeiro período aquisitivo em andamento"),
    ).toBeInTheDocument();
    expect(
      within(saldo).getByText(
        "O direito às primeiras férias começa em 05/01/2027.",
      ),
    ).toBeInTheDocument();
    expect(
      within(saldo).getByText(
        "Ausências, folgas e day offs continuam sendo registrados normalmente.",
      ),
    ).toBeInTheDocument();
    expect(within(saldo).queryByText("dias disponíveis")).toBeNull();
    expect(within(saldo).queryByText("Em aquisição")).toBeNull();
    expect(
      within(saldo).queryByRole("button", { name: "Agendar férias" }),
    ).toBeNull();
  });

  it("período seguinte em andamento (o anterior já tirado): as próximas férias", async () => {
    const base = ferias();
    montar(
      ferias({
        periodos: [
          { ...base.periodos[0]!, solicitados: 30, disponiveis: 0 },
          base.periodos[1]!,
        ],
        periodoAtual: 1,
      }),
    );
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(
      within(saldo).getByText("Período aquisitivo em andamento"),
    ).toBeInTheDocument();
    expect(
      within(saldo).getByText(
        "O direito às próximas férias começa em 05/01/2027.",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ["2026-12-10", "Vence em 16 dias"],
    ["2026-11-25", "Vence em 1 dia"],
    ["2026-11-24", "Vence hoje"],
    ["2027-05-30", "Vence em 6 meses"],
  ])("prazo %s: %s", async (prazoGozo, texto) => {
    const base = ferias();
    montar(
      ferias({
        periodos: [{ ...base.periodos[0]!, prazoGozo }, base.periodos[1]!],
      }),
    );
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(within(saldo).getByText(texto)).toBeInTheDocument();
  });

  it("vencimento: amarelo longe do prazo, vermelho perto (como a referência)", async () => {
    const base = ferias();
    montar(
      ferias({
        periodos: [
          { ...base.periodos[0]!, prazoGozo: "2027-10-31" },
          base.periodos[1]!,
        ],
      }),
    );
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(
      within(saldo).getByText("Vence em 11 meses").closest(".evolli-badge"),
    ).toHaveClass("evolli-badge--warning");
  });

  it("vencimento perto (1 mês): vermelho", async () => {
    montar();
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(
      within(saldo).getByText("Vence em 1 mês").closest(".evolli-badge"),
    ).toHaveClass("evolli-badge--danger");
  });

  it("período encurtado por reinício: a nota no cartão", async () => {
    const base = ferias();
    montar(
      ferias({
        periodos: [
          {
            ...base.periodos[0]!,
            fim: "2025-10-31",
            encurtado: { motivo: "ferias_coletivas", novoInicio: "2025-11-01" },
          },
          base.periodos[1]!,
        ],
      }),
    );
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(
      within(saldo).getByText(
        (_, el) =>
          el?.classList.contains("ferias-ficha__nota") === true &&
          el.textContent ===
            "Período encurtado: férias coletivas · novo período a partir de 01/11/2025.",
      ),
    ).toBeInTheDocument();
  });

  it("Ajustar período: abre a janela; ao salvar, avisa e recarrega", async () => {
    const { consultar, s } = montar();
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    fireEvent.click(
      within(saldo).getByRole("button", { name: "Ajustar período" }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Período aquisitivo",
    });
    fireEvent.change(
      within(janela).getByLabelText("Primeiro dia do novo período"),
      { target: { value: "2026-11-01" } },
    );
    await act(async () => {
      fireEvent.click(
        within(janela).getByRole("button", { name: "Salvar reinício" }),
      );
    });
    expect(s.registrarReinicio).toHaveBeenCalledWith(PESSOA.id, {
      inicio: "2026-11-01",
      motivo: "ferias_coletivas",
    });
    expect(
      await screen.findByText(
        "Período aquisitivo ajustado. O saldo já foi recalculado.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Período aquisitivo" }),
      ).toBeNull(),
    );
  });

  it("Ajustar período só para quem edita e com saldo calculado", async () => {
    montar(ferias(), { podeEditar: false });
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(
      within(saldo).queryByRole("button", { name: "Ajustar período" }),
    ).toBeNull();
  });

  it("PJ (sem férias): sem Ajustar período", async () => {
    montar(
      ferias({
        regraDeFerias: "sem_ferias",
        vinculo: { tipo: "pj", dataAdmissao: "2025-01-05" },
        periodos: [],
        periodoAtual: null,
      }),
    );
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(
      within(saldo).queryByRole("button", { name: "Ajustar período" }),
    ).toBeNull();
  });

  it("período vencido: a etiqueta Vencido e o prazo que passou", async () => {
    const base = ferias();
    montar(
      ferias({
        periodos: [
          {
            ...base.periodos[0]!,
            prazoGozo: "2026-10-01",
            situacao: "vencido",
          },
          base.periodos[1]!,
        ],
      }),
    );
    const saldo = await screen.findByRole("region", {
      name: "Saldo de férias",
    });
    expect(within(saldo).getByText("Vencido")).toBeInTheDocument();
    expect(
      within(saldo).getByText("prazo para gozo: 01/10/2026"),
    ).toBeInTheDocument();
    // CLT art. 137: o período vencido ainda se agenda, pago em dobro.
    expect(
      within(saldo).getByText(
        "Período vencido: a CLT manda conceder estas férias, com pagamento em dobro (art. 137).",
      ),
    ).toBeInTheDocument();
    expect(
      within(saldo).getByRole("button", { name: "Agendar férias" }),
    ).toBeInTheDocument();
  });

  it("ajuste sugerido no histórico: a sugestão aparece e o ⋯ tem Responder", async () => {
    const base = ferias();
    montar(
      ferias({
        historico: [
          ausencia({
            id: "a-9",
            tipo: "day_off",
            inicio: "2026-12-14",
            fim: "2026-12-14",
            dias: 1,
            diasUteis: 1,
            diasVendidos: 1,
            periodoAquisitivo: null,
            status: "ajuste_sugerido",
            sugestao: { inicio: "2026-12-15", fim: "2026-12-16" },
          }),
          ...base.historico,
        ],
      }),
    );
    const hist = await screen.findByRole("region", {
      name: "Histórico de ausências",
    });
    expect(
      within(hist).getByText("Sugerido: 15/12 – 16/12/2026"),
    ).toBeInTheDocument();
    expect(within(hist).getByText(/\+ 1 vendido$/)).toBeInTheDocument();
    fireEvent.pointerDown(
      within(hist).getByRole("button", {
        name: "Ações de Day off aniversário de 14/12/2026",
      }),
      { button: 0, ctrlKey: false },
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu).getByRole("menuitem", { name: "Responder" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["sem_ferias", "pj", "Contrato PJ: não tem férias."],
    [
      "sem_regra",
      "aprendiz",
      "Contrato Aprendiz: o saldo de férias não é calculado.",
    ],
  ] as const)(
    "regra %s (%s): diz por quê, sem saldo",
    async (regra, tipo, texto) => {
      montar(
        ferias({
          regraDeFerias: regra,
          vinculo: { tipo, dataAdmissao: "2025-01-05" },
          periodos: [],
          periodoAtual: null,
        }),
      );
      const saldo = await screen.findByRole("region", {
        name: "Saldo de férias",
      });
      expect(within(saldo).getByText(texto)).toBeInTheDocument();
      expect(
        within(saldo).getByText(
          "Ausências, folgas e day offs continuam sendo registrados normalmente.",
        ),
      ).toBeInTheDocument();
    },
  );

  it("próxima ausência: data, tipo, período e status", async () => {
    montar();
    const proxima = await screen.findByRole("region", {
      name: "Próxima ausência",
    });
    // Como a referência: o status no subtítulo; no corpo, o tipo, as datas
    // e os dias úteis.
    expect(within(proxima).getByText("Aprovada")).toBeInTheDocument();
    expect(within(proxima).getByText("07")).toBeInTheDocument();
    expect(within(proxima).getByText("dez")).toBeInTheDocument();
    expect(within(proxima).getByText("Férias")).toBeInTheDocument();
    expect(within(proxima).getByText("07/12 – 26/12/2026")).toBeInTheDocument();
    expect(within(proxima).getByText("13 dias úteis")).toBeInTheDocument();
  });

  it("próxima ausência vazia: o texto diz o que o sistema faz hoje", async () => {
    montar(ferias({ proximaAusencia: null }));
    const proxima = await screen.findByRole("region", {
      name: "Próxima ausência",
    });
    expect(
      within(proxima).getByText("Nada agendado por enquanto"),
    ).toBeInTheDocument();
    expect(
      within(proxima).getByText("Nenhuma ausência agendada"),
    ).toBeInTheDocument();
    expect(
      within(proxima).getByText(
        "Quando houver férias ou outra ausência agendada, ela aparece aqui.",
      ),
    ).toBeInTheDocument();
  });

  it("histórico: por ano, do mais novo; tipo, datas, dias, dias úteis, status e anexo", async () => {
    montar();
    const hist = await screen.findByRole("region", {
      name: "Histórico de ausências",
    });
    expect(
      within(hist).getByText(
        "3 registros · férias, licenças, faltas e day offs",
      ),
    ).toBeInTheDocument();
    const anos = within(hist).getAllByRole("heading", { level: 4 });
    expect(anos.map((a) => a.textContent)).toEqual(["2026", "2025"]);
    // Cada ano com a sua contagem, à direita da linha.
    expect(within(hist).getByText("2 registros")).toBeInTheDocument();
    expect(within(hist).getByText("1 registro")).toBeInTheDocument();
    const itens = within(hist).getAllByRole("listitem");
    expect(itens).toHaveLength(3);
    expect(within(itens[0]!).getByText("Férias")).toBeInTheDocument();
    // A próxima ausência é dita na própria linha.
    expect(within(itens[0]!).getByText("Próxima ausência")).toBeInTheDocument();
    expect(
      within(itens[0]!).getByText("07/12 – 26/12/2026"),
    ).toBeInTheDocument();
    expect(within(itens[0]!).getByText("13 dias úteis")).toBeInTheDocument();
    expect(within(itens[1]!).getAllByText("Day off aniversário")).toHaveLength(
      2,
    );
    expect(within(itens[1]!).getByText("02/03/2026")).toBeInTheDocument();
    expect(within(itens[1]!).getByText("1 dia útil")).toBeInTheDocument();
    expect(within(itens[1]!).getByText("Pendente")).toBeInTheDocument();
    expect(
      within(itens[2]!).getByRole("button", {
        name: "Baixar anexo de Licença médica de 04/08/2025 (PDF, 120 KB)",
      }),
    ).toBeInTheDocument();
    expect(
      within(hist).getByText(
        "Dias úteis: de segunda a sexta, sem os feriados nacionais de data fixa. Feriados móveis (como Carnaval e Corpus Christi), estaduais e municipais ainda não entram no cálculo.",
      ),
    ).toBeInTheDocument();
  });

  it("histórico vazio: o texto da referência e Registrar ausência", async () => {
    montar(ferias({ historico: [], proximaAusencia: null }));
    const hist = await screen.findByRole("region", {
      name: "Histórico de ausências",
    });
    expect(
      within(hist).getByText("Nenhum registro até agora"),
    ).toBeInTheDocument();
    expect(
      within(hist).getByText("Nenhuma ausência registrada"),
    ).toBeInTheDocument();
    expect(
      within(hist).getByText(
        "Férias, licenças, faltas e day offs da Ana vão aparecer aqui, organizados por ano.",
      ),
    ).toBeInTheDocument();
    expect(
      within(hist).getAllByRole("button", { name: "Registrar ausência" }),
    ).not.toHaveLength(0);
  });

  it("pendente: ⋯ com Responder, Editar e Excluir; Responder aprova, avisa e relê", async () => {
    const { consultar, s } = montar();
    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Ações de Day off aniversário de 02/03/2026",
      }),
      { button: 0, ctrlKey: false },
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual([
      "Responder",
      "Editar",
      "Anexar atestado ou documento",
      "Excluir",
    ]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Responder" }));
    const janela = await screen.findByRole("dialog", {
      name: "Responder solicitação",
    });
    await act(async () => {
      fireEvent.click(
        within(janela).getByRole("button", { name: "Aprovar pedido" }),
      );
    });
    expect(s.aprovar).toHaveBeenCalledWith("a-3", undefined);
    expect(await screen.findByText("Ausência aprovada.")).toBeInTheDocument();
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
  });

  it("aprovada: ⋯ sem Responder e sem Cancelar (como a referência)", async () => {
    montar();
    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Ações de Férias de 07/12/2026",
      }),
      { button: 0, ctrlKey: false },
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Editar", "Anexar atestado ou documento", "Excluir"]);
  });

  it("anexar pela linha: escolhe o arquivo e envia", async () => {
    const { s } = montar();
    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Ações de Férias de 07/12/2026",
      }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "Anexar atestado ou documento",
      }),
    );
    const arquivo = new File(["abc"], "atestado.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("Arquivo do anexo da ausência"), {
      target: { files: [arquivo] },
    });
    await waitFor(() =>
      expect(s.enviarAnexo).toHaveBeenCalledWith("a-1", arquivo),
    );
    expect(await screen.findByText("Anexo enviado.")).toBeInTheDocument();
  });

  it("anexo recusado pelo servidor: diz o motivo", async () => {
    const s = servico({
      enviarAnexo: vi.fn(async () => {
        throw new ApiError(422, "x", { codigo: "anexo_com_macro" });
      }),
    });
    montar(ferias(), { s });
    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Ações de Férias de 07/12/2026",
      }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "Anexar atestado ou documento",
      }),
    );
    fireEvent.change(screen.getByLabelText("Arquivo do anexo da ausência"), {
      target: {
        files: [new File(["abc"], "a.docx", { type: "application/msword" })],
      },
    });
    expect(
      await screen.findByText(
        "O anexo não foi enviado: documentos com macro não são aceitos.",
      ),
    ).toBeInTheDocument();
  });

  it("baixar e remover o anexo (com confirmação)", async () => {
    const { s } = montar();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Baixar anexo de Licença médica de 04/08/2025 (PDF, 120 KB)",
      }),
    );
    await waitFor(() => expect(s.baixarAnexo).toHaveBeenCalledWith("a-2"));
    fireEvent.pointerDown(
      screen.getByRole("button", {
        name: "Ações de Licença médica de 04/08/2025",
      }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Remover anexo" }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Remover o anexo?",
    });
    fireEvent.click(within(janela).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(s.removerAnexo).toHaveBeenCalledWith("a-2"));
  });

  it("sem permissão de edição: sem Registrar ausência e sem ações; baixar segue", async () => {
    montar(ferias(), { podeEditar: false });
    await screen.findByRole("region", { name: "Histórico de ausências" });
    expect(
      screen.queryByRole("button", { name: "Registrar ausência" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Ações de/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Baixar anexo de Licença médica/ }),
    ).toBeInTheDocument();
  });

  it.each([
    [403, "Você não tem permissão para ver as férias e ausências."],
    [500, "Não foi possível carregar as férias e ausências."],
  ])("falha %i ao carregar: %s", async (status, texto) => {
    montar(new ApiError(status, "x"));
    expect(await screen.findByText(texto)).toBeInTheDocument();
  });

  it("⋯ Editar: a mesma janela, como 'Editar ausência', com a pessoa fixa e as respostas; salvar altera e relê", async () => {
    const { s, consultar } = montar();
    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Ações de Férias de 07/12/2026",
      }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    const gaveta = await screen.findByRole("dialog", {
      name: "Editar ausência",
    });
    expect(within(gaveta).getByText("Ana Teste Lima")).toBeInTheDocument();
    // A pessoa não muda na edição.
    expect(within(gaveta).queryByRole("button", { name: "Trocar" })).toBeNull();
    expect(
      within(gaveta).getByRole("radio", { name: "Férias" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      (within(gaveta).getByLabelText("Primeiro dia") as HTMLInputElement).value,
    ).toBe("2026-12-07");
    expect(
      (within(gaveta).getByLabelText("Último dia") as HTMLInputElement).value,
    ).toBe("2026-12-26");
    expect(
      within(gaveta).getByRole("radio", { name: /^Sim, já aprovada/ }),
    ).toHaveAttribute("aria-checked", "true");
    // Sem mudança, nada a salvar; mudando o fim, salva.
    const salvar = within(gaveta).getByRole("button", {
      name: "Salvar alterações",
    });
    expect(salvar).toBeDisabled();
    fireEvent.change(within(gaveta).getByLabelText("Último dia"), {
      target: { value: "2026-12-20" },
    });
    // A simulação da edição não conta a própria ausência.
    await waitFor(() =>
      expect(s.simular).toHaveBeenCalledWith(
        expect.objectContaining({ fim: "2026-12-20", ignorar: "a-1" }),
        expect.anything(),
      ),
    );
    fireEvent.click(salvar);
    await waitFor(() =>
      expect(s.alterar).toHaveBeenCalledWith("a-1", {
        tipo: "ferias",
        inicio: "2026-12-07",
        fim: "2026-12-20",
        periodoAquisitivoInicio: "2025-01-05",
        aprovada: true,
      }),
    );
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Ausência alterada.")).toBeInTheDocument();
  });

  it("⋯ Excluir: confirma com o tipo, o nome e a data; Cancelar não exclui; Excluir exclui e relê", async () => {
    const { s, consultar } = montar();
    const abrir = async () => {
      fireEvent.pointerDown(
        await screen.findByRole("button", {
          name: "Ações de Férias de 07/12/2026",
        }),
        { button: 0, ctrlKey: false },
      );
      fireEvent.click(await screen.findByRole("menuitem", { name: "Excluir" }));
      return screen.findByRole("dialog", { name: "Excluir esta ausência?" });
    };
    let janela = await abrir();
    expect(
      within(janela).getByText(
        "As férias de Ana Teste Lima (07/12 – 26/12/2026) serão removidas do histórico e do calendário. Essa ação não pode ser desfeita.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(janela).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(s.excluir).not.toHaveBeenCalled();

    janela = await abrir();
    fireEvent.click(within(janela).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(s.excluir).toHaveBeenCalledWith("a-1"));
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Ausência excluída.")).toBeInTheDocument();
  });

  it("cancelada: só sai (Excluir), não se edita", async () => {
    montar(
      ferias({
        proximaAusencia: null,
        historico: [
          ausencia({
            id: "a-9",
            status: "cancelada",
            inicio: "2027-01-05",
            fim: "2027-01-10",
          }),
        ],
      }),
    );
    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Ações de Férias de 05/01/2027",
      }),
      { button: 0, ctrlKey: false },
    );
    expect(
      await screen.findByRole("menuitem", { name: "Excluir" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Editar" })).toBeNull();
  });

  it("registrar: abre a gaveta com a pessoa já escolhida e, ao registrar, relê", async () => {
    const { consultar } = montar(
      ferias({ historico: [], proximaAusencia: null }),
    );
    const [botao] = await screen.findAllByRole("button", {
      name: "Registrar ausência",
    });
    fireEvent.click(botao!);
    const gaveta = await screen.findByRole("dialog", {
      name: "Registrar ausência",
    });
    expect(within(gaveta).getByText("Ana Teste Lima")).toBeInTheDocument();
    expect(consultar).toHaveBeenCalledTimes(1);
  });

  it("voltar à aba mostra na hora o que já foi lido, e relê em silêncio", async () => {
    const primeira = montar();
    await screen.findByRole("region", { name: "Saldo de férias" });
    const consultar = primeira.consultar;
    cleanup();
    render(
      <AbaFeriasEAusencias
        pessoa={PESSOA}
        quem="a Ana"
        deQuem="da Ana"
        podeEditar
        servico={servico()}
        consultar={consultar}
        hoje="2026-11-24"
      />,
    );
    expect(
      screen.getByRole("region", { name: "Saldo de férias" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
  });
});
