/**
 * T215 — módulo Férias e ausências na lista de Colaboradores, no desenho da
 * referência: quatro cartões, busca e filtros (Período, Tipo, Status), a
 * engrenagem das políticas, "Registrar ausência", a tabela com as ações e a
 * gaveta de cinco perguntas, com o resumo calculado pelo servidor.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartoesDeAusencias, FeriasEAusenciasAba } from "./FeriasEAusenciasAba";
import { RegistrarAusenciaGaveta } from "./RegistrarAusenciaGaveta";
import type {
  AusenciaApi,
  IndicadoresDeAusencias,
  ServicoDeAusencias,
} from "./tiposAusencia";

const MARIA = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Maria Teste Santos",
  cargo: "Analista de RH",
};

const INDICADORES: IndicadoresDeAusencias = {
  emFeriasAgora: 2,
  licencasEAfastamentos: 1,
  faltasEsteMes: 3,
  proximasFerias: 4,
  pendentes: 1,
  ausentesHoje: 2,
};

function ausencia(parcial: Partial<AusenciaApi> = {}): AusenciaApi {
  return {
    id: "a-1",
    colaborador: { ...MARIA, foto: null },
    tipo: "ferias",
    motivoAfastamento: null,
    inicio: "2027-01-05",
    fim: "2027-01-24",
    dias: 20,
    diasUteis: 14,
    diasVendidos: 0,
    periodoAquisitivo: { inicio: "2026-01-01", fim: "2026-12-31" },
    status: "aguardando_rh",
    observacao: null,
    registradoEm: "2026-11-23T12:00:00.000Z",
    decididoEm: null,
    ...parcial,
  };
}

function servicoFalso(itens: AusenciaApi[] = [ausencia()]): ServicoDeAusencias {
  return {
    listar: vi.fn(async () => ({
      itens,
      pagina: 1,
      tamanhoPagina: 20,
      total: itens.length,
      indicadores: INDICADORES,
    })),
    registrar: vi.fn(async (nova) =>
      ausencia({
        id: "a-nova",
        tipo: nova.tipo,
        inicio: nova.inicio,
        fim: nova.fim ?? null,
        status: nova.aprovada ? "aprovada" : "aguardando_rh",
      }),
    ),
    simular: vi.fn(async (c) => ({
      dias: 20,
      diasUteis: 14,
      volta: "2027-01-25",
      periodo:
        c.tipo === "ferias"
          ? { inicio: "2026-01-01", fim: "2026-12-31" }
          : null,
      saldoAntes: c.tipo === "ferias" ? 30 : null,
      saldoDepois: c.tipo === "ferias" ? 10 - (c.diasVendidos ?? 0) : null,
      maxVendaveis: 10,
      prazoAbono: "2026-12-16",
    })),
    aprovar: vi.fn(async (id) => ausencia({ id, status: "aprovada" })),
    recusar: vi.fn(async (id) => ausencia({ id, status: "recusada" })),
    cancelar: vi.fn(async (id) => ausencia({ id, status: "cancelada" })),
    alterar: vi.fn(async (id) => ausencia({ id })),
    excluir: vi.fn(async () => undefined),
    buscarPessoas: vi.fn(async () => [MARIA]),
  };
}

let servico: ServicoDeAusencias;
beforeEach(() => {
  servico = servicoFalso();
});

describe("T215 — Férias e ausências: como a referência (2026-11-26)", () => {
  it("cartões no singular com 1", () => {
    render(
      <CartoesDeAusencias
        indicadores={{
          ...INDICADORES,
          emFeriasAgora: 1,
          faltasEsteMes: 1,
        }}
      />,
    );
    expect(
      within(screen.getByRole("group", { name: "Em férias agora" })).getByText(
        "pessoa",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Faltas este mês" })).getByText(
        "registrada",
      ),
    ).toBeInTheDocument();
  });

  it("linha: foto (iniciais), ponto do tipo, datas curtas e dias úteis; Pendente; N registros", async () => {
    servico = servicoFalso([
      ausencia(),
      ausencia({
        id: "a-2",
        tipo: "day_off",
        inicio: "2026-11-30",
        fim: "2026-11-30",
        dias: 1,
        diasUteis: 1,
        status: "aprovada",
      }),
      ausencia({
        id: "a-3",
        tipo: "falta_sem_justificativa",
        inicio: "2026-12-31",
        fim: "2027-01-04",
        dias: 5,
        diasUteis: 2,
        status: "aprovada",
      }),
    ]);
    render(<FeriasEAusenciasAba servico={servico} podeRegistrar podeDecidir />);
    const tabela = await screen.findByRole("table", {
      name: "Férias e ausências",
    });
    const [, ferias, dayOff, falta] = within(tabela).getAllByRole("row");
    expect(ferias!.querySelector(".ausencias__avatar")).toHaveTextContent("MS");
    expect(ferias!.querySelector(".ausencias__ponto")).not.toBeNull();
    expect(ferias).toHaveTextContent("05/01 – 24/01/2027");
    expect(ferias).toHaveTextContent("14 dias úteis");
    expect(ferias).toHaveTextContent("Pendente");
    expect(dayOff).toHaveTextContent("Day off aniversário");
    expect(dayOff).toHaveTextContent("30/11/2026");
    expect(dayOff).toHaveTextContent("1 dia útil");
    expect(falta).toHaveTextContent("Falta injustificada");
    // Anos diferentes: as duas datas completas.
    expect(falta).toHaveTextContent("31/12/2026 – 04/01/2027");
    expect(screen.getByText("3 registros")).toBeInTheDocument();
  });
});

describe("T215 — Férias e ausências: cartões", () => {
  it("os quatro cartões, com os números do servidor", () => {
    render(<CartoesDeAusencias indicadores={INDICADORES} />);
    const esperado = [
      ["Em férias agora", "2", "pessoas"],
      ["Licenças e afastamentos", "1", "em andamento"],
      ["Faltas este mês", "3", "registradas"],
      ["Próximas férias", "4", "nos próximos 30 dias"],
    ] as const;
    for (const [titulo, numero, sufixo] of esperado) {
      const cartao = screen.getByRole("group", { name: titulo });
      expect(within(cartao).getByText(numero)).toBeInTheDocument();
      expect(within(cartao).getByText(sufixo)).toBeInTheDocument();
    }
  });
});

describe("T215 — Férias e ausências: lista", () => {
  function montar(
    props: Partial<Parameters<typeof FeriasEAusenciasAba>[0]> = {},
  ) {
    const onIndicadores = vi.fn();
    const onPoliticas = vi.fn();
    render(
      <FeriasEAusenciasAba
        servico={servico}
        podeRegistrar
        podeDecidir
        onIndicadores={onIndicadores}
        onPoliticas={onPoliticas}
        {...props}
      />,
    );
    return { onIndicadores, onPoliticas };
  }

  it("barra: busca, Período, Tipo, Status, engrenagem e Registrar ausência", async () => {
    const { onIndicadores, onPoliticas } = montar();
    await screen.findByRole("table", { name: "Férias e ausências" });
    expect(onIndicadores).toHaveBeenCalledWith(INDICADORES);
    expect(
      screen.getByRole("searchbox", { name: "Buscar colaborador" }),
    ).toBeInTheDocument();
    for (const nome of ["Período: Todos", "Tipo: Todos", "Status: Todos"]) {
      expect(screen.getByRole("button", { name: nome })).toBeInTheDocument();
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Políticas de férias" }),
    );
    expect(onPoliticas).toHaveBeenCalledTimes(1);
    expect(
      screen.getAllByRole("button", { name: "Registrar ausência" }).length,
    ).toBeGreaterThan(0);
  });

  it.each([
    ["Período: Todos", "Em férias agora", { periodo: "em_ferias_agora" }],
    ["Tipo: Todos", "Licenças", { tipo: "licencas" }],
    ["Status: Todos", "Aguardando você", { status: "aguardando_voce" }],
  ] as const)(
    "o filtro %s → %s consulta o servidor",
    async (botao, opcao, consulta) => {
      montar();
      await screen.findByRole("table", { name: "Férias e ausências" });
      fireEvent.keyDown(screen.getByRole("button", { name: botao }), {
        key: "Enter",
      });
      fireEvent.click(
        await screen.findByRole("menuitemradio", { name: opcao }),
      );
      await waitFor(() =>
        expect(vi.mocked(servico.listar).mock.calls.at(-1)![0]).toMatchObject({
          ...consulta,
          pagina: 1,
        }),
      );
    },
  );

  it("busca por colaborador, pouco depois de digitar", async () => {
    montar();
    await screen.findByRole("table", { name: "Férias e ausências" });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar colaborador" }),
      { target: { value: "maria" } },
    );
    await waitFor(() =>
      expect(vi.mocked(servico.listar).mock.calls.at(-1)![0]).toMatchObject({
        busca: "maria",
      }),
    );
  });

  it("tabela: Colaborador, Tipo, Período, Status e Ações; aprovar relê", async () => {
    montar();
    const tabela = await screen.findByRole("table", {
      name: "Férias e ausências",
    });
    expect(
      within(tabela)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual(["Colaborador", "Tipo", "Período", "Status", "Ações"]);
    const [, linha] = within(tabela).getAllByRole("row");
    expect(linha).toHaveTextContent("Maria Teste Santos");
    expect(linha).toHaveTextContent("Analista de RH");
    expect(linha).toHaveTextContent("Férias");
    expect(linha).toHaveTextContent("05/01 – 24/01/2027");
    expect(linha).toHaveTextContent("14 dias úteis");
    expect(linha).toHaveTextContent("Pendente");
    fireEvent.keyDown(
      within(linha!).getByRole("button", {
        name: "Ações da ausência de Maria Teste Santos",
      }),
      { key: "Enter" },
    );
    const menu = await screen.findByRole("menu");
    // Como a referência: o pendente se responde, edita ou exclui.
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Responder", "Editar", "Excluir"]);
    const leituras = vi.mocked(servico.listar).mock.calls.length;
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Responder" }));
    const janela = await screen.findByRole("dialog", {
      name: "Responder solicitação",
    });
    fireEvent.click(
      within(janela).getByRole("button", { name: "Aprovar pedido" }),
    );
    await waitFor(() =>
      expect(servico.aprovar).toHaveBeenCalledWith("a-1", undefined),
    );
    await waitFor(() =>
      expect(vi.mocked(servico.listar).mock.calls.length).toBeGreaterThan(
        leituras,
      ),
    );
  });

  it("aprovada: Editar e Excluir (sem Responder nem Cancelar); excluir confirma", async () => {
    servico = servicoFalso([ausencia({ status: "aprovada" })]);
    montar();
    const tabela = await screen.findByRole("table", {
      name: "Férias e ausências",
    });
    fireEvent.keyDown(
      within(tabela).getByRole("button", { name: /^Ações da ausência/ }),
      { key: "Enter" },
    );
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Editar", "Excluir"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Excluir" }));
    const confirma = await screen.findByRole("dialog", {
      name: "Excluir esta ausência?",
    });
    expect(confirma).toHaveTextContent(
      "As férias de Maria Teste Santos (05/01 – 24/01/2027) serão removidas do histórico e do calendário. Essa ação não pode ser desfeita.",
    );
    fireEvent.click(within(confirma).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(servico.excluir).toHaveBeenCalledWith("a-1"));
    expect(await screen.findByText("Ausência excluída.")).toBeInTheDocument();
  });

  it("sem permissão de decidir: sem o ⋯", async () => {
    render(
      <FeriasEAusenciasAba
        servico={servico}
        podeRegistrar={false}
        podeDecidir={false}
      />,
    );
    const tabela = await screen.findByRole("table", {
      name: "Férias e ausências",
    });
    expect(
      within(tabela).queryByRole("button", { name: /^Ações da ausência/ }),
    ).toBeNull();
  });

  it("vazio: título, texto e o botão de registrar", async () => {
    servico = servicoFalso([]);
    montar();
    expect(
      await screen.findByText("Nenhuma ausência registrada"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Férias, licenças e faltas do time aparecem aqui assim que forem registradas.",
      ),
    ).toBeInTheDocument();
  });
});

describe("T215 — Registrar ausência (gaveta)", () => {
  function montarGaveta() {
    const onRegistrada = vi.fn();
    const onFechar = vi.fn();
    render(
      <RegistrarAusenciaGaveta
        aberta
        servico={servico}
        onFechar={onFechar}
        onRegistrada={onRegistrada}
      />,
    );
    return { onRegistrada, onFechar };
  }

  async function escolherMaria() {
    fireEvent.click(
      screen.getByRole("button", { name: "Escolher colaborador" }),
    );
    fireEvent.change(
      await screen.findByRole("searchbox", {
        name: "Buscar por nome ou cargo",
      }),
      { target: { value: "mar" } },
    );
    fireEvent.click(
      await screen.findByRole("option", { name: /Maria Teste Santos/ }),
    );
  }

  it("as cinco perguntas, os nove tipos e o botão travado até completar", () => {
    montarGaveta();
    const gaveta = screen.getByRole("dialog", { name: "Registrar ausência" });
    expect(
      within(gaveta).getByText("Responda as perguntas abaixo."),
    ).toBeInTheDocument();
    for (const pergunta of [
      "Quem vai se ausentar?",
      "Qual o tipo de ausência?",
      "Quando?",
      "Essa ausência já está aprovada?",
      "Quer deixar uma observação?",
    ]) {
      expect(within(gaveta).getByText(pergunta)).toBeInTheDocument();
    }
    expect(
      within(gaveta)
        .getAllByRole("radio")
        .slice(0, 9)
        .map((r) => r.textContent),
    ).toEqual([
      "Férias",
      "Licença médica",
      "Licença maternidade",
      "Licença paternidade",
      "Afastamento",
      "Falta justificada",
      "Falta sem justificativa",
      "Day off",
      "Home office",
    ]);
    expect(
      within(gaveta).getByRole("button", { name: "Registrar ausência" }),
    ).toBeDisabled();
  });

  async function feriasDaMaria(inicio: string, fim: string) {
    await escolherMaria();
    fireEvent.click(screen.getByRole("radio", { name: "Férias" }));
    fireEvent.change(screen.getByLabelText("Primeiro dia"), {
      target: { value: inicio },
    });
    fireEvent.change(screen.getByLabelText("Último dia"), {
      target: { value: fim },
    });
  }

  it("Regras da CLT: os avisos do servidor aparecem e não travam o registro", async () => {
    const simular = vi.mocked(servico.simular);
    simular.mockImplementation(async () => ({
      dias: 3,
      diasUteis: 1,
      volta: "2026-12-07",
      periodo: { inicio: "2025-01-05", fim: "2026-01-04" },
      saldoAntes: 30,
      saldoDepois: 27,
      maxVendaveis: 10,
      prazoAbono: "2025-12-20",
      avisosClt: [
        {
          regra: "inicio_antes_de_descanso" as const,
          antesDe: "domingo" as const,
          dia: "2026-12-06",
        },
        { regra: "minimo_5" as const, dias: 3 },
        { regra: "ate_3_periodos" as const, ordem: 4 },
        { regra: "um_com_14" as const },
        {
          regra: "inicio_antes_de_descanso" as const,
          antesDe: "feriado" as const,
          dia: "2026-12-25",
        },
      ],
      periodosDisponiveis: [
        { inicio: "2025-01-05", fim: "2026-01-04", disponiveis: 30 },
      ],
    }));
    montarGaveta();
    await feriasDaMaria("2026-12-04", "2026-12-06");
    const regras = await screen.findByRole("note", { name: "Regras da CLT" });
    expect(
      within(regras)
        .getAllByRole("listitem")
        .map((l) => l.textContent),
    ).toEqual([
      "Início em 04/12, nos 2 dias antes de domingo (CLT art. 134, § 3º).",
      "3 dias corridos; a lei pede pelo menos 5 por período (CLT art. 134, § 1º).",
      "Seria o 4º período de férias deste período aquisitivo; a lei permite até 3 (CLT art. 134, § 1º).",
      "Nenhum período chegaria a 14 dias; a lei pede um com pelo menos 14 (CLT art. 134, § 1º).",
      "Início em 04/12, nos 2 dias antes do feriado de 25/12 (CLT art. 134, § 3º).",
    ]);
    // Com um período só, não há o que trocar.
    expect(screen.queryByRole("button", { name: "trocar" })).toBeNull();
  });

  it("trocar: escolhe outro período com saldo e a simulação desconta dele", async () => {
    const simular = vi.mocked(servico.simular);
    simular.mockImplementation(async (c) => ({
      dias: 20,
      diasUteis: 14,
      volta: "2027-01-25",
      periodo:
        c.periodoAquisitivoInicio === "2025-01-05"
          ? { inicio: "2025-01-05", fim: "2026-01-04" }
          : { inicio: "2024-01-05", fim: "2025-01-04" },
      saldoAntes: 30,
      saldoDepois: 10,
      maxVendaveis: 10,
      prazoAbono: "2025-12-20",
      avisosClt: [],
      periodosDisponiveis: [
        { inicio: "2024-01-05", fim: "2025-01-04", disponiveis: 12 },
        { inicio: "2025-01-05", fim: "2026-01-04", disponiveis: 30 },
      ],
    }));
    montarGaveta();
    await feriasDaMaria("2027-01-05", "2027-01-24");
    expect(
      await screen.findByText("Desconta do período 2025 (automático)"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "Regras da CLT" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "trocar" }));
    const escolha = screen.getByRole("radiogroup", {
      name: "De que período descontar",
    });
    expect(
      within(escolha)
        .getAllByRole("radio")
        .map((r) => r.textContent),
    ).toEqual([
      "Período 2025 · 05/01/2024 – 04/01/2025 · 12 dias",
      "Período 2026 · 05/01/2025 – 04/01/2026 · 30 dias",
    ]);
    fireEvent.click(
      within(escolha).getByRole("radio", { name: /^Período 2026/ }),
    );
    await waitFor(() =>
      expect(simular).toHaveBeenLastCalledWith(
        expect.objectContaining({ periodoAquisitivoInicio: "2025-01-05" }),
        expect.anything(),
      ),
    );
    expect(
      await screen.findByText("Desconta do período 2026 (escolhido)"),
    ).toBeInTheDocument();
  });

  it("férias: o resumo do servidor, a venda de dias e o registro", async () => {
    const { onRegistrada } = montarGaveta();
    await escolherMaria();
    expect(screen.getByText("Maria Teste Santos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Férias" }));
    fireEvent.change(screen.getByLabelText("Primeiro dia"), {
      target: { value: "2027-01-05" },
    });
    fireEvent.change(screen.getByLabelText("Último dia"), {
      target: { value: "2027-01-24" },
    });
    expect(
      await screen.findByText("20 dias de férias (14 dias úteis)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Volta ao trabalho em 25/01/2027 · restam 10 dias de saldo",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Desconta do período 2026 (automático)"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("switch", { name: "Vender dias destas férias?" }),
    );
    fireEvent.change(screen.getByLabelText("Dias vendidos"), {
      target: { value: "10" },
    });
    expect(
      await screen.findByText(
        "20 dias de férias (14 dias úteis) + 10 vendidos",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pela CLT, dá para vender até 10 dias deste período (1/3 do direito).",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Ainda não/ }));
    fireEvent.change(screen.getByLabelText("Observação"), {
      target: { value: "viagem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausência" }));
    await waitFor(() =>
      expect(servico.registrar).toHaveBeenCalledWith({
        colaboradorId: MARIA.id,
        tipo: "ferias",
        inicio: "2027-01-05",
        fim: "2027-01-24",
        diasVendidos: 10,
        periodoAquisitivoInicio: "2026-01-01",
        aprovada: false,
        observacao: "viagem",
      }),
    );
    await waitFor(() => expect(onRegistrada).toHaveBeenCalled());
  });

  it("afastamento: motivo, sem data de volta e sem a pergunta de aprovação", async () => {
    montarGaveta();
    await escolherMaria();
    fireEvent.click(screen.getByRole("radio", { name: "Afastamento" }));
    expect(
      screen.getByText("Qual o motivo do afastamento?"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Essa ausência já está aprovada?")).toBeNull();
    fireEvent.click(
      screen.getByRole("radio", { name: /^Acidente de trabalho/ }),
    );
    fireEvent.change(screen.getByLabelText("Primeiro dia"), {
      target: { value: "2026-11-20" },
    });
    expect(
      screen.getByRole("radio", { name: /^Sem data de volta/ }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausência" }));
    await waitFor(() =>
      expect(servico.registrar).toHaveBeenCalledWith({
        colaboradorId: MARIA.id,
        tipo: "afastamento",
        motivoAfastamento: "acidente_trabalho",
        inicio: "2026-11-20",
        aprovada: true,
      }),
    );
  });

  it("sobreposição recusada pelo servidor: diz o motivo e não fecha", async () => {
    vi.mocked(servico.registrar).mockRejectedValueOnce(
      Object.assign(new Error("Erro na requisição."), {
        status: 409,
        erros: [{ campo: "inicio", motivo: "sobreposicao" }],
      }),
    );
    const { onRegistrada } = montarGaveta();
    await escolherMaria();
    fireEvent.click(screen.getByRole("radio", { name: "Day off" }));
    fireEvent.change(screen.getByLabelText("Primeiro dia"), {
      target: { value: "2026-12-01" },
    });
    fireEvent.change(screen.getByLabelText("Último dia"), {
      target: { value: "2026-12-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausência" }));
    expect(
      await screen.findByText("Já existe uma ausência de Maria nessas datas."),
    ).toBeInTheDocument();
    expect(onRegistrada).not.toHaveBeenCalled();
  });
});

describe("T215 — Registrar ausência: anexo e regra de férias do vínculo", () => {
  const PESSOA = { id: MARIA.id, nome: MARIA.nome, cargo: MARIA.cargo };

  function montar(
    extra: Partial<{
      regraDeFerias: "calculada" | "sem_ferias" | "sem_regra";
    }> = {},
  ) {
    const onRegistrada = vi.fn();
    render(
      <RegistrarAusenciaGaveta
        aberta
        servico={servico}
        onFechar={vi.fn()}
        onRegistrada={onRegistrada}
        pessoaInicial={PESSOA}
        {...(extra.regraDeFerias ? { regraDeFerias: extra.regraDeFerias } : {})}
      />,
    );
    return { onRegistrada };
  }

  function preencherLicenca() {
    fireEvent.click(screen.getByRole("radio", { name: "Licença médica" }));
    fireEvent.change(screen.getByLabelText("Primeiro dia"), {
      target: { value: "2027-01-05" },
    });
    fireEvent.change(screen.getByLabelText("Último dia"), {
      target: { value: "2027-01-07" },
    });
  }

  const arquivo = (
    nome = "atestado.pdf",
    tamanho = 3,
    tipo = "application/pdf",
  ) => new File([new Uint8Array(tamanho)], nome, { type: tipo });

  it("anexar: o arquivo escolhido aparece, e vai depois do registro", async () => {
    const enviarAnexo = vi.fn(async () => undefined);
    servico = { ...servico, enviarAnexo };
    const { onRegistrada } = montar();
    preencherLicenca();
    expect(
      screen.getByRole("button", { name: "Anexar atestado ou documento" }),
    ).toBeInTheDocument();
    const campo = screen.getByLabelText("Arquivo do atestado ou documento");
    expect(campo.getAttribute("accept")).toBe(
      ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.heic,.heif",
    );
    const escolhido = arquivo();
    fireEvent.change(campo, { target: { files: [escolhido] } });
    expect(screen.getByText("atestado.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausência" }));
    await waitFor(() =>
      expect(enviarAnexo).toHaveBeenCalledWith("a-nova", escolhido),
    );
    await waitFor(() => expect(onRegistrada).toHaveBeenCalled());
    expect(onRegistrada.mock.calls[0]![1]).toBeUndefined();
  });

  it("tirar o arquivo antes de registrar: nada é anexado", async () => {
    const enviarAnexo = vi.fn(async () => undefined);
    servico = { ...servico, enviarAnexo };
    montar();
    preencherLicenca();
    fireEvent.change(
      screen.getByLabelText("Arquivo do atestado ou documento"),
      {
        target: { files: [arquivo()] },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tirar o arquivo atestado.pdf" }),
    );
    expect(screen.queryByText("atestado.pdf")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausência" }));
    await waitFor(() => expect(servico.registrar).toHaveBeenCalled());
    expect(enviarAnexo).not.toHaveBeenCalled();
  });

  it.each([
    [
      "formato fora da lista",
      arquivo("foto.gif", 3, "image/gif"),
      "Use PDF, JPG, PNG, WEBP, HEIC, DOC ou DOCX.",
    ],
    [
      "maior que 10 MB",
      arquivo("grande.pdf", 10 * 1024 * 1024 + 1),
      "O arquivo passa de 10 MB.",
    ],
  ])("%s: recusado na hora, sem anexar", (_r, escolhido, texto) => {
    servico = { ...servico, enviarAnexo: vi.fn(async () => undefined) };
    montar();
    preencherLicenca();
    fireEvent.change(
      screen.getByLabelText("Arquivo do atestado ou documento"),
      {
        target: { files: [escolhido] },
      },
    );
    expect(screen.getByText(texto)).toBeInTheDocument();
    expect(screen.queryByText(escolhido.name)).not.toBeInTheDocument();
  });

  it("o anexo falha depois do registro: a ausência fica, e o aviso diz o que fazer", async () => {
    servico = {
      ...servico,
      enviarAnexo: vi.fn(async () => {
        throw Object.assign(new Error("x"), {
          status: 422,
          codigo: "anexo_reprovado_antivirus",
        });
      }),
    };
    const { onRegistrada } = montar();
    preencherLicenca();
    fireEvent.change(
      screen.getByLabelText("Arquivo do atestado ou documento"),
      {
        target: { files: [arquivo()] },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausência" }));
    await waitFor(() => expect(onRegistrada).toHaveBeenCalled());
    expect(onRegistrada.mock.calls[0]![1]).toBe(
      "Ausência registrada, mas o anexo não foi enviado: o antivírus recusou o arquivo. Anexe outro arquivo pelo histórico.",
    );
  });

  it("PJ e Freelancer (sem férias): a opção Férias fica indisponível", () => {
    montar({ regraDeFerias: "sem_ferias" });
    const ferias = screen.getByRole("radio", { name: "Férias" });
    expect(ferias).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(ferias);
    expect(ferias).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByText("Este contrato não tem férias (PJ e Freelancer)."),
    ).toBeInTheDocument();
  });

  it("sem regra automática (Aprendiz): avisa que o saldo não é calculado e não oferece venda", async () => {
    servico = {
      ...servico,
      simular: vi.fn(async () => ({
        dias: 20,
        diasUteis: 14,
        volta: "2027-01-25",
        periodo: null,
        saldoAntes: null,
        saldoDepois: null,
        maxVendaveis: null,
        prazoAbono: null,
        regraDeFerias: "sem_regra" as const,
      })),
    };
    montar();
    fireEvent.click(screen.getByRole("radio", { name: "Férias" }));
    fireEvent.change(screen.getByLabelText("Primeiro dia"), {
      target: { value: "2027-01-05" },
    });
    fireEvent.change(screen.getByLabelText("Último dia"), {
      target: { value: "2027-01-24" },
    });
    expect(
      await screen.findByText(
        "Contrato sem regra automática de férias: o saldo não é calculado. Confira os dias antes de registrar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Vender dias destas férias?" }),
    ).not.toBeInTheDocument();
  });
});

describe("T215 — resumo da gaveta no singular", () => {
  it("1 dia de day off (1 dia útil)", async () => {
    servico = {
      ...servicoFalso(),
      simular: vi.fn(async () => ({
        dias: 1,
        diasUteis: 1,
        volta: "2026-12-16",
        periodo: null,
        saldoAntes: null,
        saldoDepois: null,
        maxVendaveis: null,
        prazoAbono: null,
      })),
    };
    render(
      <RegistrarAusenciaGaveta
        aberta
        servico={servico}
        onFechar={vi.fn()}
        onRegistrada={vi.fn()}
        pessoaInicial={{ id: MARIA.id, nome: MARIA.nome, cargo: MARIA.cargo }}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Day off" }));
    fireEvent.change(screen.getByLabelText("Primeiro dia"), {
      target: { value: "2026-12-15" },
    });
    fireEvent.change(screen.getByLabelText("Último dia"), {
      target: { value: "2026-12-15" },
    });
    expect(
      await screen.findByText("1 dia de day off (1 dia útil)"),
    ).toBeInTheDocument();
  });
});
