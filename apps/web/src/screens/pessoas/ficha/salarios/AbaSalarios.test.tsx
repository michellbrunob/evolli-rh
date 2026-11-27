/**
 * T215 — aba Salários da ficha: Salário atual (bruto, líquido estimado,
 * vigente desde, gráfico), Resumo (aumento acumulado, média por reajuste,
 * reajustes, tempo no salário atual) e Linha do tempo salarial (Nova
 * alteração, ⋯ Editar/Excluir, Registrar reajuste). Dados sintéticos.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../api/colaboradoresClient";
import type {
  AlteracaoSalarialApi,
  HistoricoSalarialApi,
} from "../../../../api/salariosClient";
import { AbaSalarios, type ServicoDeSalarios } from "./AbaSalarios";

const HOJE = "2026-11-24";

function alt(
  parcial: Partial<AlteracaoSalarialApi> & { id: string },
): AlteracaoSalarialApi {
  return {
    origem: "alteracao",
    vigenciaInicio: "2026-11-16",
    vigenciaFim: null,
    salarioBruto: "1621.00",
    cargo: null,
    modeloContrato: null,
    vigente: true,
    ...parcial,
  };
}

function historico(alteracoes: AlteracaoSalarialApi[]): HistoricoSalarialApi {
  return {
    colaboradorId: "c1",
    empresaId: "e1",
    vinculo: {
      id: "v1",
      tipo: "clt",
      situacao: "ativo",
      dataAdmissao: "2024-01-05",
    },
    dependentesIrrf: 0,
    pensaoAlimenticiaPercentual: null,
    alteracoes,
  };
}

const SO_ADMISSAO = historico([
  alt({
    id: "adm",
    origem: "admissao",
    vigenciaInicio: "2026-11-16",
    salarioBruto: "1621.00",
  }),
]);

const COM_REAJUSTES = historico([
  alt({
    id: "c",
    vigenciaInicio: "2026-01-01",
    salarioBruto: "3000.00",
    cargo: "Coordenadora",
    modeloContrato: "CLT",
  }),
  alt({
    id: "b",
    vigenciaInicio: "2025-03-01",
    vigenciaFim: "2025-12-31",
    salarioBruto: "2500.00",
    vigente: false,
  }),
  alt({
    id: "adm",
    origem: "admissao",
    vigenciaInicio: "2024-01-05",
    vigenciaFim: "2025-02-28",
    salarioBruto: "2000.00",
    vigente: false,
  }),
]);

function servico(
  inicial: HistoricoSalarialApi | Error,
  extra: Partial<ServicoDeSalarios> = {},
): ServicoDeSalarios {
  return {
    consultar: vi.fn(() =>
      inicial instanceof Error
        ? Promise.reject(inicial)
        : Promise.resolve(inicial),
    ),
    registrar: vi.fn(),
    atualizar: vi.fn(),
    remover: vi.fn(),
    ...extra,
  };
}

function montar(
  s: ServicoDeSalarios,
  podeEditar = true,
  cargoAtual: string | null = null,
) {
  return render(
    <AbaSalarios
      colaboradorId="c1"
      deQuem="da Ana"
      podeEditar={podeEditar}
      hoje={HOJE}
      servico={s}
      cargoAtual={cargoAtual}
    />,
  );
}

const cartao = (nome: string) => screen.getByRole("region", { name: nome });

describe("T215 — aba Salários", () => {
  it("só a admissão: salário atual, líquido estimado, vigente desde e sem reajustes", async () => {
    montar(servico(SO_ADMISSAO));
    const atual = await screen.findByRole("region", { name: "Salário atual" });
    expect(
      within(atual).getByText("Remuneração bruta mensal vigente"),
    ).toBeTruthy();
    expect(within(atual).getByText("1.621,00")).toBeTruthy();
    expect(within(atual).getByText("/mês")).toBeTruthy();
    expect(within(atual).getByText("Salário inicial")).toBeTruthy();
    expect(within(atual).getByText("Definido na admissão")).toBeTruthy();
    expect(within(atual).getByText("R$ 1.499,42")).toBeTruthy();
    expect(within(atual).getByText("16/11/2026")).toBeTruthy();
    expect(
      within(atual).getByText("Sem reajustes desde a admissão"),
    ).toBeTruthy();
    expect(within(atual).getByText("nov/26")).toBeTruthy();
    expect(within(atual).getByText("hoje")).toBeTruthy();

    const resumo = cartao("Resumo");
    expect(within(resumo).getByText("Desde o primeiro registro")).toBeTruthy();
    expect(
      within(resumo).getByText("Aparece após a primeira alteração"),
    ).toBeTruthy();
    const linha = (rotulo: string) =>
      within(resumo).getByText(rotulo).closest("div")!;
    expect(within(linha("Reajustes")).getByText("0")).toBeTruthy();
    expect(
      within(linha("Tempo no salário atual")).getByText("0m"),
    ).toBeTruthy();
    expect(within(linha("Média por reajuste")).getByText("—")).toBeTruthy();
  });

  it("linha do tempo: período, valor, cargo, contrato, Vigente/Admissão e o convite ao próximo reajuste", async () => {
    montar(servico(SO_ADMISSAO));
    const tempo = await screen.findByRole("region", {
      name: "Linha do tempo salarial",
    });
    expect(
      within(tempo).getByText("Alterações de salário, cargo e contrato"),
    ).toBeTruthy();
    const [item] = within(tempo).getAllByRole("listitem");
    expect(within(item!).getByText("16/11/2026")).toBeTruthy();
    expect(within(item!).getByText("até hoje")).toBeTruthy();
    expect(within(item!).getByText("R$ 1.621,00")).toBeTruthy();
    expect(within(item!).getByText("Salário inicial")).toBeTruthy();
    expect(within(item!).getByText("Não informado")).toBeTruthy();
    expect(within(item!).getByText("CLT · Menos de 1 mês")).toBeTruthy();
    expect(within(item!).getByText("Vigente")).toBeTruthy();
    expect(within(item!).getByText("Admissão")).toBeTruthy();
    expect(within(tempo).getByText("Próximo reajuste")).toBeTruthy();
    expect(
      within(tempo).getByText(
        "Registre reajustes e promoções para acompanhar a evolução da Ana.",
      ),
    ).toBeTruthy();
    expect(
      within(tempo).getByRole("button", { name: "Registrar reajuste" }),
    ).toBeTruthy();
  });

  it("com reajustes: percentuais, acumulado, média, tempo no salário e períodos fechados", async () => {
    montar(servico(COM_REAJUSTES));
    const atual = await screen.findByRole("region", { name: "Salário atual" });
    expect(within(atual).getByText("3.000,00")).toBeTruthy();
    expect(within(atual).getByText("Reajuste")).toBeTruthy();
    expect(within(atual).getByText("+20,0% sobre o anterior")).toBeTruthy();
    expect(
      within(atual).getByText("2 reajustes desde a admissão"),
    ).toBeTruthy();

    const resumo = cartao("Resumo");
    const linha = (rotulo: string) =>
      within(resumo).getByText(rotulo).closest("div")!;
    expect(within(linha("Aumento acumulado")).getByText("+50,0%")).toBeTruthy();
    expect(
      within(linha("Média por reajuste")).getByText("+22,5%"),
    ).toBeTruthy();
    expect(within(linha("Reajustes")).getByText("2")).toBeTruthy();
    expect(
      within(linha("Tempo no salário atual")).getByText("10m"),
    ).toBeTruthy();

    const itens = within(cartao("Linha do tempo salarial")).getAllByRole(
      "listitem",
    );
    expect(within(itens[0]!).getByText("+20,0%")).toBeTruthy();
    expect(within(itens[0]!).getByText("Coordenadora")).toBeTruthy();
    expect(within(itens[1]!).getByText("até 31/12/2025")).toBeTruthy();
    expect(within(itens[1]!).getByText("+25,0%")).toBeTruthy();
    // 01/03/2025 a 31/12/2025: 10 meses (o último dia conta).
    expect(within(itens[1]!).getByText("CLT · 10 meses")).toBeTruthy();
    expect(within(itens[2]!).getByText("CLT · 1 ano e 1 mês")).toBeTruthy();
    expect(within(itens[1]!).queryByText("Vigente")).toBeNull();
  });

  it("percentual em centavos, meio para cima: 2.000 → 2.045 é +2,3%", async () => {
    montar(
      servico(
        historico([
          alt({
            id: "b",
            vigenciaInicio: "2026-03-01",
            salarioBruto: "2045.00",
          }),
          alt({
            id: "adm",
            origem: "admissao",
            vigenciaInicio: "2024-01-05",
            vigenciaFim: "2026-02-28",
            salarioBruto: "2000.00",
            vigente: false,
          }),
        ]),
      ),
    );
    const atual = await screen.findByRole("region", { name: "Salário atual" });
    expect(within(atual).getByText("+2,3% sobre o anterior")).toBeTruthy();
    const resumo = cartao("Resumo");
    const linha = (rotulo: string) =>
      within(resumo).getByText(rotulo).closest("div")!;
    expect(within(linha("Aumento acumulado")).getByText("+2,3%")).toBeTruthy();
    expect(within(linha("Média por reajuste")).getByText("+2,3%")).toBeTruthy();
  });

  it("variação que arredonda a zero aparece como 0,0%, sem sinal", async () => {
    montar(
      servico(
        historico([
          alt({
            id: "b",
            vigenciaInicio: "2026-03-01",
            salarioBruto: "2000.01",
          }),
          alt({
            id: "adm",
            origem: "admissao",
            vigenciaInicio: "2024-01-05",
            vigenciaFim: "2026-02-28",
            salarioBruto: "2000.00",
            vigente: false,
          }),
        ]),
      ),
    );
    const atual = await screen.findByRole("region", { name: "Salário atual" });
    expect(within(atual).getByText("0,0% sobre o anterior")).toBeTruthy();
  });

  it("redução e troca só de cargo são Alteração, não Reajuste (nem na contagem)", async () => {
    montar(
      servico(
        historico([
          alt({
            id: "c",
            vigenciaInicio: "2026-06-01",
            salarioBruto: "1800.00",
            cargo: "Analista",
          }),
          alt({
            id: "b",
            vigenciaInicio: "2025-03-01",
            vigenciaFim: "2026-05-31",
            salarioBruto: "2000.00",
            cargo: "Assistente Sênior",
            vigente: false,
          }),
          alt({
            id: "adm",
            origem: "admissao",
            vigenciaInicio: "2024-01-05",
            vigenciaFim: "2025-02-28",
            salarioBruto: "2000.00",
            cargo: "Assistente",
            vigente: false,
          }),
        ]),
      ),
    );
    const atual = await screen.findByRole("region", { name: "Salário atual" });
    expect(within(atual).getByText("Alteração")).toBeTruthy();
    expect(within(atual).queryByText("Reajuste")).toBeNull();
    expect(within(atual).getByText("-10,0% sobre o anterior")).toBeTruthy();
    expect(
      within(atual).getByText("Sem reajustes desde a admissão"),
    ).toBeTruthy();
    const resumo = cartao("Resumo");
    const linha = (rotulo: string) =>
      within(resumo).getByText(rotulo).closest("div")!;
    expect(within(linha("Reajustes")).getByText("0")).toBeTruthy();
    expect(within(linha("Média por reajuste")).getByText("—")).toBeTruthy();
    expect(within(linha("Aumento acumulado")).getByText("-10,0%")).toBeTruthy();
  });

  it("admissão futura: sem Vigente, a partir da data e sem duração", async () => {
    montar(
      servico(
        historico([
          alt({
            id: "adm",
            origem: "admissao",
            vigenciaInicio: "2026-12-01",
            salarioBruto: "3000.00",
            vigente: false,
          }),
        ]),
      ),
    );
    const atual = await screen.findByRole("region", { name: "Salário atual" });
    expect(within(atual).getByText("A partir de")).toBeTruthy();
    expect(within(atual).queryByText("Vigente desde")).toBeNull();
    const [item] = within(cartao("Linha do tempo salarial")).getAllByRole(
      "listitem",
    );
    expect(within(item!).getByText("a partir de 01/12/2026")).toBeTruthy();
    expect(within(item!).queryByText("até hoje")).toBeNull();
    expect(within(item!).queryByText("Vigente")).toBeNull();
    expect(within(item!).getByText("CLT")).toBeTruthy();
    const resumo = cartao("Resumo");
    expect(
      within(
        within(resumo).getByText("Tempo no salário atual").closest("div")!,
      ).getByText("—"),
    ).toBeTruthy();
  });

  it("desligado: só leitura — nada de Nova alteração, ⋯ ou Registrar reajuste", async () => {
    const encerrado = {
      ...COM_REAJUSTES,
      vinculo: { ...COM_REAJUSTES.vinculo, situacao: "encerrado" },
    };
    montar(servico(encerrado));
    await screen.findByRole("region", { name: "Salário atual" });
    expect(screen.queryByRole("button", { name: "Nova alteração" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Registrar reajuste" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Ações do registro/ }),
    ).toBeNull();
    expect(
      screen.getByText("Só consulta: o vínculo foi encerrado."),
    ).toBeTruthy();
  });

  it("desligado sem salário: o estado vazio não oferece Nova alteração", async () => {
    montar(
      servico({
        ...historico([]),
        vinculo: { ...historico([]).vinculo, situacao: "encerrado" },
      }),
    );
    expect(await screen.findByText("Nenhum salário registrado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nova alteração" })).toBeNull();
  });

  it.each([
    [
      409,
      "Não dá para excluir: o vínculo foi encerrado e a linha do tempo ficou só para consulta.",
    ],
    [
      404,
      "Este registro já tinha sido excluído. A linha do tempo foi atualizada.",
    ],
    [500, "Não foi possível excluir. Tente de novo."],
  ])("excluir recusado com %i: %s", async (status, texto) => {
    const remover = vi.fn(() => Promise.reject(new ApiError(status, "x")));
    const s = servico(COM_REAJUSTES, { remover });
    montar(s);
    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Ações do registro de 01/01/2026",
      }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    const confirmacao = await screen.findByRole("dialog", {
      name: "Excluir alteração salarial?",
    });
    fireEvent.click(
      within(confirmacao).getByRole("button", { name: "Excluir" }),
    );
    expect(await within(confirmacao).findByText(texto)).toBeTruthy();
    // 409 e 404: a linha do tempo é lida de novo (o estado mudou no servidor).
    await waitFor(() =>
      expect(s.consultar).toHaveBeenCalledTimes(status === 500 ? 1 : 2),
    );
  });

  it("Nova alteração: registra com o que foi digitado e mostra a linha do tempo devolvida", async () => {
    const registrar = vi.fn(() => Promise.resolve(COM_REAJUSTES));
    montar(servico(SO_ADMISSAO, { registrar }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Nova alteração" }),
    );
    const gaveta = await screen.findByRole("dialog", {
      name: "Adicionar alteração salarial",
    });
    expect(
      within(gaveta).getByText(
        "Informe a data em que o salário passou a valer. Pode ser uma data passada: o sistema organiza os períodos automaticamente.",
      ),
    ).toBeTruthy();
    const modelo = within(gaveta).getByLabelText(
      "Modelo de contrato",
    ) as HTMLInputElement;
    expect(modelo.value).toBe("CLT");
    expect(
      within(gaveta).getByPlaceholderText("Cargo nesse período"),
    ).toBeTruthy();
    fireEvent.change(within(gaveta).getByLabelText("Data de início"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(within(gaveta).getByLabelText("Salário"), {
      target: { value: "300000" },
    });
    expect(
      (within(gaveta).getByLabelText("Salário") as HTMLInputElement).value,
    ).toBe("3.000,00");
    fireEvent.change(within(gaveta).getByLabelText("Cargo"), {
      target: { value: "Coordenadora" },
    });
    fireEvent.click(
      within(gaveta).getByRole("button", { name: "Registrar alteração" }),
    );
    await waitFor(() =>
      expect(registrar).toHaveBeenCalledWith("c1", {
        vigenciaInicio: "2026-01-01",
        salarioBruto: "3000.00",
        cargo: "Coordenadora",
        modeloContrato: "CLT",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(cartao("Salário atual")).getByText("3.000,00")).toBeTruthy();
  });

  it.each([
    [422, "futura", "A data não pode ser depois de hoje."],
    [
      422,
      "fora_de_ordem",
      "A data não pode ser anterior à admissão (05/01/2024).",
    ],
    [409, "em_uso", "Já existe um período começando nesta data."],
  ])(
    "recusa %i %s: mensagem no campo da data, gaveta aberta",
    async (status, motivo, texto) => {
      const registrar = vi.fn(() =>
        Promise.reject(
          new ApiError(status, "x", {
            erros: [{ campo: "vigenciaInicio", motivo }],
          }),
        ),
      );
      montar(servico(SO_ADMISSAO, { registrar }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Nova alteração" }),
      );
      const gaveta = await screen.findByRole("dialog");
      fireEvent.change(within(gaveta).getByLabelText("Data de início"), {
        target: { value: "2026-01-01" },
      });
      fireEvent.change(within(gaveta).getByLabelText("Salário"), {
        target: { value: "200000" },
      });
      fireEvent.click(
        within(gaveta).getByRole("button", { name: "Registrar alteração" }),
      );
      expect(await within(gaveta).findByText(texto)).toBeTruthy();
      expect(
        within(gaveta)
          .getByLabelText("Data de início")
          .getAttribute("aria-invalid"),
      ).toBe("true");
    },
  );

  it("Nova alteração: o cargo vem preenchido com o cargo atual (sem ele, o do último registro)", async () => {
    const { unmount } = montar(servico(SO_ADMISSAO), true, "Analista de RH");
    fireEvent.click(
      await screen.findByRole("button", { name: "Nova alteração" }),
    );
    let gaveta = await screen.findByRole("dialog", {
      name: "Adicionar alteração salarial",
    });
    expect(
      (within(gaveta).getByLabelText("Cargo") as HTMLInputElement).value,
    ).toBe("Analista de RH");
    // Só o cargo preenchido não é mudança: Escape fecha sem perguntar.
    fireEvent.keyDown(gaveta, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    unmount();

    montar(servico(COM_REAJUSTES));
    fireEvent.click(
      await screen.findByRole("button", { name: "Nova alteração" }),
    );
    gaveta = await screen.findByRole("dialog", {
      name: "Adicionar alteração salarial",
    });
    expect(
      (within(gaveta).getByLabelText("Cargo") as HTMLInputElement).value,
    ).toBe("Coordenadora");
  });

  it("sem data ou sem salário, o botão de registrar fica desabilitado", async () => {
    montar(servico(SO_ADMISSAO));
    fireEvent.click(
      await screen.findByRole("button", { name: "Nova alteração" }),
    );
    const gaveta = await screen.findByRole("dialog");
    const botao = within(gaveta).getByRole("button", {
      name: "Registrar alteração",
    });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(gaveta).getByLabelText("Data de início"), {
      target: { value: "2026-01-01" },
    });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
  });

  it("⋯ Editar: gaveta preenchida; na linha da admissão a data não muda", async () => {
    const atualizar = vi.fn(() => Promise.resolve(SO_ADMISSAO));
    montar(servico(SO_ADMISSAO, { atualizar }));
    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Ações do registro de 16/11/2026",
      }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    const gaveta = await screen.findByRole("dialog", {
      name: "Editar alteração salarial",
    });
    const data = within(gaveta).getByLabelText(
      "Data de início",
    ) as HTMLInputElement;
    expect(data.value).toBe("2026-11-16");
    expect(data.disabled).toBe(true);
    expect(
      (within(gaveta).getByLabelText("Salário") as HTMLInputElement).value,
    ).toBe("1.621,00");
    fireEvent.change(within(gaveta).getByLabelText("Salário"), {
      target: { value: "170000" },
    });
    fireEvent.click(
      within(gaveta).getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(atualizar).toHaveBeenCalledWith("c1", "adm", {
        vigenciaInicio: "2026-11-16",
        salarioBruto: "1700.00",
        cargo: null,
        modeloContrato: "CLT",
      }),
    );
  });

  it("⋯ Excluir: desabilitado na admissão; nos outros, pede confirmação e remove", async () => {
    const remover = vi.fn(() =>
      Promise.resolve(
        historico([
          alt({
            id: "adm",
            origem: "admissao",
            vigenciaInicio: "2024-01-05",
            salarioBruto: "2000.00",
          }),
        ]),
      ),
    );
    montar(servico(COM_REAJUSTES, { remover }));
    fireEvent.pointerDown(
      await screen.findByRole("button", {
        name: "Ações do registro de 05/01/2024",
      }),
      { button: 0, ctrlKey: false },
    );
    const desabilitado = await screen.findByRole("menuitem", {
      name: "Excluir",
    });
    expect(desabilitado.getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(desabilitado, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menuitem")).toBeNull());

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Ações do registro de 01/01/2026" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    const confirmacao = await screen.findByRole("dialog", {
      name: "Excluir alteração salarial?",
    });
    fireEvent.click(
      within(confirmacao).getByRole("button", { name: "Excluir" }),
    );
    await waitFor(() => expect(remover).toHaveBeenCalledWith("c1", "c"));
    await waitFor(() =>
      expect(
        within(cartao("Salário atual")).getByText("2.000,00"),
      ).toBeTruthy(),
    );
  });

  it("sem permissão de edição: nada de Nova alteração, ⋯ ou Registrar reajuste", async () => {
    montar(servico(SO_ADMISSAO), false);
    await screen.findByRole("region", { name: "Salário atual" });
    expect(screen.queryByRole("button", { name: "Nova alteração" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Registrar reajuste" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Ações do registro/ }),
    ).toBeNull();
  });

  it("sem salário registrado: estado vazio com Nova alteração", async () => {
    montar(servico(historico([])));
    expect(await screen.findByText("Nenhum salário registrado")).toBeTruthy();
    expect(
      screen.getByText("Registre o salário para acompanhar a evolução da Ana."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nova alteração" }));
    const gaveta = await screen.findByRole("dialog");
    const data = within(gaveta).getByLabelText(
      "Data de início",
    ) as HTMLInputElement;
    expect(data.value).toBe("2024-01-05");
    expect(data.disabled).toBe(true);
    expect(
      within(gaveta).getByText("O primeiro salário vale desde a admissão."),
    ).toBeTruthy();
  });

  it.each([
    [403, "Você não tem permissão para ver os salários."],
    [500, "Não foi possível carregar os salários."],
  ])("falha %i ao carregar: %s", async (status, texto) => {
    montar(servico(new ApiError(status, "x")));
    expect(await screen.findByText(texto)).toBeTruthy();
  });

  it("falha ao carregar: Tentar de novo lê outra vez", async () => {
    const consultar = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, "x"))
      .mockResolvedValueOnce(SO_ADMISSAO);
    montar(servico(SO_ADMISSAO, { consultar }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Tentar de novo" }),
    );
    expect(
      await screen.findByRole("region", { name: "Salário atual" }),
    ).toBeTruthy();
    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it("voltar à aba mostra na hora o que já foi lido, e relê em silêncio", async () => {
    const s = servico(SO_ADMISSAO);
    const primeira = montar(s);
    await screen.findByRole("region", { name: "Salário atual" });
    primeira.unmount();
    montar(s);
    // Sem esperar: a memória já tem a linha do tempo.
    expect(
      screen.getByRole("region", { name: "Salário atual" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(s.consultar).toHaveBeenCalledTimes(2));
  });
});
