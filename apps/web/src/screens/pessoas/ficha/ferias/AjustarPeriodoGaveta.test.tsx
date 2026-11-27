/**
 * T215 — "Ajustar período" (como a referência, 2026-11-26): a contagem de
 * férias recomeça numa data; a janela mostra os períodos de hoje e, com a
 * data, como vão ficar. Dados sintéticos; o servidor é simulado.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../api/colaboradoresClient";
import type {
  PeriodoAquisitivoApi,
  ReinicioApi,
  SimulacaoDeReinicioApi,
} from "../../../../api/ausenciasClient";
import { AjustarPeriodoGaveta } from "./AjustarPeriodoGaveta";

const COLABORADOR = "c0c0c0c0-0000-4000-8000-000000000001";

const periodo = (
  parcial: Partial<PeriodoAquisitivoApi>,
): PeriodoAquisitivoApi => ({
  inicio: "2026-02-16",
  fim: "2027-02-15",
  direito: 30,
  solicitados: 0,
  disponiveis: 30,
  prazoGozo: "2028-02-15",
  situacao: "em_aquisicao",
  encurtado: null,
  ...parcial,
});

const HOJE: SimulacaoDeReinicioApi = {
  periodos: [
    periodo({}),
    periodo({
      inicio: "2027-02-16",
      fim: "2028-02-15",
      prazoGozo: "2029-02-15",
    }),
  ],
  diasCalculados: null,
};

const COMO_VAI_FICAR: SimulacaoDeReinicioApi = {
  periodos: [
    periodo({
      fim: "2026-10-31",
      direito: 23,
      disponiveis: 23,
      prazoGozo: "2027-10-31",
      situacao: "disponivel",
      encurtado: { motivo: "ferias_coletivas", novoInicio: "2026-11-01" },
    }),
    periodo({
      inicio: "2026-11-01",
      fim: "2027-10-31",
      prazoGozo: "2028-10-31",
    }),
  ],
  diasCalculados: 23,
};

const REINICIO: ReinicioApi = {
  id: "r1r1r1r1-0000-4000-8000-000000000001",
  inicio: "2026-11-01",
  motivo: "ferias_coletivas",
  diasPeriodoAnterior: null,
  observacao: "coletiva sintética",
};

function servico() {
  return {
    simularReinicio: vi.fn(
      async (_id: string, proposta?: { inicio?: string }) =>
        proposta?.inicio ? COMO_VAI_FICAR : HOJE,
    ),
    registrarReinicio: vi.fn(async () => REINICIO),
    removerReinicio: vi.fn(async () => undefined),
  };
}

function montar(
  opcoes: {
    reinicios?: ReinicioApi[];
    s?: ReturnType<typeof servico>;
  } = {},
) {
  const s = opcoes.s ?? servico();
  const onFechar = vi.fn();
  const onAlterado = vi.fn();
  render(
    <AjustarPeriodoGaveta
      aberta
      colaboradorId={COLABORADOR}
      primeiroNome="Ana"
      dataAdmissao="2026-02-16"
      reinicios={opcoes.reinicios ?? []}
      servico={s}
      onFechar={onFechar}
      onAlterado={onAlterado}
    />,
  );
  return { s, onFechar, onAlterado };
}

const janela = () => screen.getByRole("dialog", { name: "Período aquisitivo" });
const data = () =>
  within(janela()).getByLabelText("Primeiro dia do novo período");
const salvar = () =>
  within(janela()).getByRole("button", { name: "Salvar reinício" });
const lista = () => within(janela()).getByRole("list", { name: /períodos/i });

describe("AjustarPeriodoGaveta (T215)", () => {
  it("textos da referência e os períodos de hoje", async () => {
    const { s } = montar();
    expect(
      within(janela()).getByText(
        "Quando a contagem de férias de Ana recomeça fora dos 12 meses.",
      ),
    ).toBeInTheDocument();
    for (const texto of [
      "Quando começa o novo período?",
      "Nas férias coletivas, é o primeiro dia da coletiva.",
      "Por que a contagem recomeça?",
      "Quantos dias de férias o período anterior deu?",
      "Em branco, o Evolli calcula pelos meses trabalhados: 2,5 dias por mês (15 dias ou mais contam como mês), e meio dia arredonda para cima.",
      "Observação interna",
    ]) {
      expect(within(janela()).getByText(texto), texto).toBeInTheDocument();
    }
    const motivos = within(janela()).getAllByRole("radio");
    expect(motivos.map((m) => m.textContent)).toEqual([
      "Férias coletivasMenos de 12 meses de casa: férias proporcionais e novo período (CLT, art. 140)",
      "Perda do direitoLicença remunerada ou paralisação acima de 30 dias, ou auxílio-doença acima de 6 meses (CLT, art. 133)",
      "Outro motivoAjuste combinado com a contabilidade",
    ]);
    // Férias coletivas vem marcada, como a referência.
    expect(motivos[0]).toHaveAttribute("aria-checked", "true");
    expect(
      within(janela()).getByPlaceholderText(
        "Ex.: coletiva de fim de ano, conforme a contabilidade",
      ),
    ).toHaveAttribute("maxlength", "300");
    await waitFor(() =>
      expect(within(janela()).getByText("Períodos hoje")).toBeInTheDocument(),
    );
    expect(s.simularReinicio).toHaveBeenCalledWith(COLABORADOR, {});
    expect(
      within(lista())
        .getAllByRole("listitem")
        .map((l) => l.textContent),
    ).toEqual([
      "16/02/2026 – 15/02/202730 dias · em aquisição",
      "16/02/2027 – 15/02/202830 dias · em aquisição",
    ]);
    expect(salvar()).toBeDisabled();
  });

  it("resposta antiga não apaga a mais nova", async () => {
    const s = servico();
    let soltarHoje: (v: SimulacaoDeReinicioApi) => void = () => undefined;
    s.simularReinicio.mockImplementationOnce(
      () =>
        new Promise<SimulacaoDeReinicioApi>((r) => {
          soltarHoje = r;
        }),
    );
    montar({ s });
    fireEvent.change(data(), { target: { value: "2026-11-01" } });
    await waitFor(() =>
      expect(
        within(janela()).getByText("Como os períodos vão ficar"),
      ).toBeInTheDocument(),
    );
    await act(async () => {
      soltarHoje(HOJE);
    });
    expect(
      within(lista())
        .getAllByRole("listitem")
        .map((l) => l.textContent),
    ).toEqual([
      "16/02/2026 – 31/10/202623 dias",
      "01/11/2026 – 31/10/202730 dias · em aquisição",
    ]);
  });

  it("com a data: como os períodos vão ficar e o calculado no campo de dias", async () => {
    const { s } = montar();
    fireEvent.change(data(), { target: { value: "2026-11-01" } });
    await waitFor(() =>
      expect(
        within(janela()).getByText("Como os períodos vão ficar"),
      ).toBeInTheDocument(),
    );
    expect(s.simularReinicio).toHaveBeenLastCalledWith(COLABORADOR, {
      inicio: "2026-11-01",
      motivo: "ferias_coletivas",
    });
    expect(
      within(lista())
        .getAllByRole("listitem")
        .map((l) => l.textContent),
    ).toEqual([
      "16/02/2026 – 31/10/202623 dias",
      "01/11/2026 – 31/10/202730 dias · em aquisição",
    ]);
    expect(
      within(janela()).getByLabelText(
        "Quantos dias de férias o período anterior deu?",
      ),
    ).toHaveAttribute("placeholder", "Calculado: 23");
    // Motivo e dias entram na simulação.
    fireEvent.click(
      within(janela()).getByRole("radio", { name: /Perda do direito/ }),
    );
    fireEvent.change(
      within(janela()).getByLabelText(
        "Quantos dias de férias o período anterior deu?",
      ),
      { target: { value: "10" } },
    );
    await waitFor(() =>
      expect(s.simularReinicio).toHaveBeenLastCalledWith(COLABORADOR, {
        inicio: "2026-11-01",
        motivo: "perda_direito",
        dias: 10,
      }),
    );
    expect(salvar()).toBeEnabled();
  });

  it("data na admissão ou antes: o aviso e sem salvar", async () => {
    montar();
    fireEvent.change(data(), { target: { value: "2026-02-16" } });
    expect(
      within(janela()).getByText("A data precisa ser depois da admissão."),
    ).toBeInTheDocument();
    expect(data()).toHaveAttribute("aria-invalid", "true");
    expect(salvar()).toBeDisabled();
    expect(within(janela()).getByText("Períodos hoje")).toBeInTheDocument();
  });

  it("dias acima de 30 não passam", async () => {
    montar();
    fireEvent.change(data(), { target: { value: "2026-11-01" } });
    const dias = within(janela()).getByLabelText(
      "Quantos dias de férias o período anterior deu?",
    );
    fireEvent.change(dias, { target: { value: "31" } });
    expect(
      within(janela()).getByText("Informe de 0 a 30 dias."),
    ).toBeInTheDocument();
    expect(salvar()).toBeDisabled();
  });

  it("salvar reinício: envia as respostas e avisa", async () => {
    const { s, onAlterado } = montar();
    fireEvent.change(data(), { target: { value: "2026-11-01" } });
    fireEvent.click(
      within(janela()).getByRole("radio", { name: /Outro motivo/ }),
    );
    fireEvent.change(
      within(janela()).getByLabelText(
        "Quantos dias de férias o período anterior deu?",
      ),
      { target: { value: "12" } },
    );
    fireEvent.change(within(janela()).getByLabelText("Observação interna"), {
      target: { value: "  combinado com a contabilidade  " },
    });
    await act(async () => {
      fireEvent.click(salvar());
    });
    expect(s.registrarReinicio).toHaveBeenCalledWith(COLABORADOR, {
      inicio: "2026-11-01",
      motivo: "outro",
      diasPeriodoAnterior: 12,
      observacao: "combinado com a contabilidade",
    });
    expect(onAlterado).toHaveBeenCalledWith(
      "Período aquisitivo ajustado. O saldo já foi recalculado.",
      true,
    );
  });

  it("salvar sem dias e sem observação não envia os campos vazios", async () => {
    const { s } = montar();
    fireEvent.change(data(), { target: { value: "2026-11-01" } });
    await act(async () => {
      fireEvent.click(salvar());
    });
    expect(s.registrarReinicio).toHaveBeenCalledWith(COLABORADOR, {
      inicio: "2026-11-01",
      motivo: "ferias_coletivas",
    });
  });

  it.each([
    ["ja_existe", "Já existe um reinício nessa data."],
    [
      "ferias_sem_periodo",
      "Há férias lançadas num período que deixaria de existir. Ajuste essas férias antes.",
    ],
    [
      "abaixo_das_ferias",
      "O período anterior ficaria com menos dias do que as férias já lançadas nele.",
    ],
    ["antes_da_admissao", "A data precisa ser depois da admissão."],
  ])("recusa do servidor %s: %s", async (motivo, texto) => {
    const s = servico();
    s.registrarReinicio.mockRejectedValueOnce(
      new ApiError(409, "x", { erros: [{ campo: "inicio", motivo }] }),
    );
    const { onAlterado } = montar({ s });
    fireEvent.change(data(), { target: { value: "2026-11-01" } });
    await act(async () => {
      fireEvent.click(salvar());
    });
    expect(within(janela()).getByRole("alert")).toHaveTextContent(texto);
    expect(onAlterado).not.toHaveBeenCalled();
  });

  it("reinícios registrados: lista e remove (a janela fica aberta)", async () => {
    const { s, onAlterado } = montar({ reinicios: [REINICIO] });
    expect(
      within(janela()).getByText("Reinícios registrados"),
    ).toBeInTheDocument();
    expect(
      within(janela()).getByText("Novo período em 01/11/2026"),
    ).toBeInTheDocument();
    expect(
      within(janela()).getByText("Férias coletivas · coletiva sintética"),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        within(janela()).getByRole("button", {
          name: "Remover reinício de 01/11/2026",
        }),
      );
    });
    expect(s.removerReinicio).toHaveBeenCalledWith(COLABORADOR, REINICIO.id);
    expect(onAlterado).toHaveBeenCalledWith(
      "Reinício removido. O saldo já foi recalculado.",
      false,
    );
  });

  it("remover recusado: o motivo aparece", async () => {
    const s = servico();
    s.removerReinicio.mockRejectedValueOnce(
      new ApiError(409, "x", {
        erros: [{ campo: "inicio", motivo: "ferias_sem_periodo" }],
      }),
    );
    montar({ reinicios: [REINICIO], s });
    await act(async () => {
      fireEvent.click(
        within(janela()).getByRole("button", {
          name: "Remover reinício de 01/11/2026",
        }),
      );
    });
    expect(within(janela()).getByRole("alert")).toHaveTextContent(
      "Há férias lançadas num período que deixaria de existir.",
    );
  });

  it("perda do direito: em branco o período anterior fica com 0 dias", async () => {
    montar();
    fireEvent.click(
      within(janela()).getByRole("radio", { name: /^Perda do direito/ }),
    );
    expect(
      within(janela()).getByText(
        "Em branco, o período anterior fica com 0 dias (perda do direito).",
      ),
    ).toBeInTheDocument();
    expect(
      within(janela()).queryByText(/calcula pelos meses trabalhados/),
    ).toBeNull();
  });
});
