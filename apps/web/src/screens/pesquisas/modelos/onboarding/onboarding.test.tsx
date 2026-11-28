/**
 * T216 — Onboarding: o questionário (17 em 8 blocos), as regras da tela,
 * o assistente de 5 etapas (envio automático, perguntas, público, e-mail e
 * ativação), os resultados por rodada, os envios e a planilha.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PesquisaDetalhe } from "../../../../api/pesquisasClient";
import { AssistenteDoOnboarding } from "./AssistenteDoOnboarding";
import {
  HORARIOS,
  TOTAL_DE_PERGUNTAS,
  comTipo,
  minutosDoOnboarding,
  secoesDoOnboarding,
  tipoDaPergunta,
} from "./envio";
import type {
  ConfigOnboarding,
  EnviosDoOnboarding,
  OnboardingDetalhe,
  PreviaDoPublico,
  Publico,
  ResultadosDoOnboarding as Resultados,
} from "./cliente";
import { planilhaDoOnboarding } from "./exportacaoDoOnboarding";
import {
  CONFIG_PADRAO,
  configParaEnviar,
  contarPerguntas,
  errosDaConfiguracao,
  resumoDoEnvio,
  textoDaContagem,
  textoDoBotaoFinal,
} from "./regrasDoOnboarding";
import { ResultadosDoOnboarding } from "./ResultadosDoOnboarding";

const HOJE = "2026-11-27";

describe("T216 — questionário do onboarding", () => {
  it("17 perguntas em 8 blocos, 14 obrigatórias, cerca de 5 minutos", () => {
    const s = secoesDoOnboarding();
    expect(TOTAL_DE_PERGUNTAS).toBe(17);
    expect(s.map((x) => x.titulo)).toEqual([
      "Onboarding e treinamento",
      "Liderança",
      "Colegas",
      "Remuneração",
      "Ferramentas e feedback",
      "Rotina e crescimento",
      "Motivação e permanência",
      "Para fechar",
    ]);
    expect(s.map((x) => x.perguntas.length)).toEqual([2, 2, 1, 2, 2, 2, 4, 2]);
    const c = contarPerguntas(s);
    expect(c).toEqual({
      perguntas: 17,
      blocos: 8,
      obrigatorias: 14,
      minutos: 5,
    });
    expect(textoDaContagem(c)).toBe(
      "17 perguntas · 8 blocos · 14 obrigatórias · cerca de 5 minutos",
    );
    expect(minutosDoOnboarding(3)).toBe(3);
  });

  it("tipos: concordância e satisfação de 4 pontos (com os 4 rótulos), escolhas, nota e textos", () => {
    const p = secoesDoOnboarding().flatMap((x) => x.perguntas);
    const q = (chave: string) => p.find((x) => x.chave === chave)!;
    expect(tipoDaPergunta(q("q1"))).toBe("concord4");
    expect(q("q1").tipo).toBe("concordancia_4");
    expect(tipoDaPergunta(q("q7"))).toBe("satisf4");
    expect(q("q7").tipo).toBe("satisfacao_4");
    expect(tipoDaPergunta(q("q12"))).toBe("unica");
    expect(q("q12").config.outro).toBe(true);
    expect(q("q12").config.opcoes).toHaveLength(7);
    expect(q("q13").config.opcoes).toHaveLength(4);
    expect(tipoDaPergunta(q("q14"))).toBe("curta");
    expect(q("q14").obrigatoria).toBe(false);
    expect(q("q14").descricao).toMatch(/o RH saberá que esta resposta é sua/);
    expect(tipoDaPergunta(q("q15"))).toBe("nota");
    expect(tipoDaPergunta(q("q16"))).toBe("paragrafo");
    expect(tipoDaPergunta(comTipo(q("q1"), "multi"))).toBe("multi");
    expect(comTipo(q("q1"), "unica").config.opcoes).toHaveLength(2);
  });

  it("horários de 06:00 a 21:00, de 30 em 30 minutos", () => {
    expect(HORARIOS[0]).toBe("06:00");
    expect(HORARIOS.at(-1)).toBe("21:00");
    expect(HORARIOS).toHaveLength(31);
  });
});

describe("T216 — regras da tela do onboarding", () => {
  it("resumo do envio para os três modos", () => {
    expect(resumoDoEnvio(CONFIG_PADRAO)).toBe(
      "Automático · 30 e 60 dias após a admissão",
    );
    expect(resumoDoEnvio({ ...CONFIG_PADRAO, rodadas: [30, 60, 90] })).toBe(
      "Automático · 30, 60 e 90 dias após a admissão",
    );
    expect(
      resumoDoEnvio({
        ...CONFIG_PADRAO,
        modo: "agendar",
        agendadoPara: "2026-11-28",
      }),
    ).toBe("Agendado · 28/11/2026 às 09:00");
    expect(resumoDoEnvio({ ...CONFIG_PADRAO, modo: "agora" })).toBe(
      "Enviar agora · prazo de 7 dias",
    );
  });

  it("validação da 1ª etapa e o que vai para a API", () => {
    expect(errosDaConfiguracao("", CONFIG_PADRAO, HOJE)).toEqual({
      nome: "Dê um nome para a pesquisa.",
    });
    expect(
      errosDaConfiguracao("x", { ...CONFIG_PADRAO, rodadas: [] }, HOJE),
    ).toEqual({ rodadas: "Escolha pelo menos uma rodada." });
    expect(
      errosDaConfiguracao(
        "x",
        { ...CONFIG_PADRAO, modo: "agendar", agendadoPara: "2026-11-26" },
        HOJE,
      ).agendadoPara,
    ).toBeDefined();
    expect(
      configParaEnviar({ ...CONFIG_PADRAO, modo: "agora" }, "anonima"),
    ).toMatchObject({ rodadas: [], lembreteDias: null, agendadoPara: null });
    expect(textoDoBotaoFinal(CONFIG_PADRAO, 3)).toBe("Ativar automação");
    expect(textoDoBotaoFinal({ ...CONFIG_PADRAO, modo: "agora" }, 1)).toBe(
      "Enviar agora para 1 pessoa",
    );
    expect(textoDoBotaoFinal({ ...CONFIG_PADRAO, modo: "agendar" }, 2)).toBe(
      "Agendar para 2 pessoas",
    );
  });
});

function previa(publico: Publico = { tipo: "todos" }): PreviaDoPublico {
  const pessoas = [
    {
      colaboradorId: "c1",
      nome: "Ana Teste",
      cargo: "Analista",
      departamento: "Operações",
      unidade: null,
      temEmail: true,
      noPublico: true,
    },
    {
      colaboradorId: "c2",
      nome: "Bia Sem Email",
      cargo: null,
      departamento: null,
      unidade: null,
      temEmail: false,
      noPublico: true,
    },
  ];
  const dentro =
    publico.tipo === "pessoas"
      ? pessoas.filter((p) => publico.colaboradorIds.includes(p.colaboradorId))
      : pessoas;
  return {
    total: dentro.length,
    semEmail: dentro.filter((p) => !p.temEmail).length,
    proximas: { 30: 2, 60: 1, 90: 0 },
    pessoas,
  };
}

const detalhe = (extra: Partial<PesquisaDetalhe> = {}) =>
  ({
    id: "onb-1",
    nome: "Onboarding",
    modelo: "onboarding",
    identificacao: "confidencial",
    status: "rascunho",
    link: null,
    ...extra,
  }) as PesquisaDetalhe;

function onboardingDetalhe(): OnboardingDetalhe {
  return {
    pesquisaId: "onb-1",
    config: CONFIG_PADRAO,
    ativa: true,
    ativadaEm: HOJE,
    publico: { total: 2, semEmail: 1 },
    proximas: { 30: 2, 60: 1, 90: 0 },
    funil: {
      noPublico: 2,
      semEmail: 1,
      aguardandoEmail: 1,
      enviados: 0,
      responderam: 0,
      pulados: 0,
      agendados: 0,
    },
    proximoEnvio: null,
    link: "#/p/tokenDeTesteComTamanhoSuficiente",
  };
}

function montarAssistente() {
  const servico = {
    criarPesquisa: vi.fn(async (_e: unknown) => detalhe()),
    alterarPesquisa: vi.fn(async (_id: string, _e: unknown) => detalhe()),
  };
  const cliente = {
    salvar: vi.fn(async (_id: string, _c: ConfigOnboarding) =>
      onboardingDetalhe(),
    ),
    ativar: vi.fn(async (_id: string) => onboardingDetalhe()),
    previaDoPublico: vi.fn(async (p: Publico, _u: boolean) => previa(p)),
  };
  const listarGrupos = vi.fn(async () => ({
    departamento: [
      { id: "00000000-0000-4000-8000-000000000001", nome: "Operações" },
    ],
    cargo: [],
    unidade: [],
    centroCusto: [],
  }));
  const onVerEnvios = vi.fn();
  render(
    <AssistenteDoOnboarding
      servico={servico}
      cliente={cliente}
      listarGrupos={listarGrupos}
      empresa="Empresa Sintética"
      hoje={HOJE}
      onVoltar={() => {}}
      onVerEnvios={onVerEnvios}
    />,
  );
  return { servico, cliente, onVerEnvios };
}

const proximo = (r: RegExp) =>
  fireEvent.click(screen.getByRole("button", { name: r }));

describe("T216 — assistente do onboarding", () => {
  it("padrões: CPF confidencial, automático aos 30 e 60 dias, 09:00, 7 dias e lembrete 3", async () => {
    montarAssistente();
    expect(
      screen.getByRole("heading", { name: "Nova pesquisa de Onboarding" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue(
      "Onboarding · 30 e 60 dias",
    );
    expect(screen.getByRole("radio", { name: /Confidencial/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Automatizar/ })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /30 dias após a admissão/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /60 dias após a admissão/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /90 dias após a admissão/ }),
    ).not.toBeChecked();
    expect(
      await screen.findByText("2 pessoas nos próximos 30 dias"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Horário do envio")).toHaveValue("09:00");
    expect(screen.getByLabelText("Prazo para responder")).toHaveValue("7");
    expect(screen.getByLabelText("Lembrete")).toHaveValue("3");
    expect(
      screen.getByRole("switch", { name: /Só em dias úteis/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: /Incluir quem já passou da data/ }),
    ).not.toBeChecked();
    expect(
      screen.getByText("Automático · 30 e 60 dias após a admissão"),
    ).toBeInTheDocument();
  });

  it("sem rodada não avança; anônima desliga o lembrete", async () => {
    const { servico } = montarAssistente();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /30 dias após a admissão/ }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /60 dias após a admissão/ }),
    );
    proximo(/Próximo: Perguntas/);
    expect(
      await screen.findByText("Escolha pelo menos uma rodada."),
    ).toBeInTheDocument();
    expect(servico.criarPesquisa).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: /Anônima/ }));
    expect(screen.getByLabelText("Lembrete")).toBeDisabled();
    expect(screen.getByText("Na anônima não há lembrete.")).toBeInTheDocument();
  });

  it("percorre as 5 etapas: edita pergunta, escolhe pessoas, e-mail personalizado e ativa", async () => {
    const { servico, cliente, onVerEnvios } = montarAssistente();
    proximo(/Próximo: Perguntas/);
    await waitFor(() => expect(servico.criarPesquisa).toHaveBeenCalled());
    expect(cliente.salvar).toHaveBeenCalledWith(
      "onb-1",
      expect.objectContaining({ modo: "automatizar", rodadas: [30, 60] }),
    );
    // Perguntas: 17, editar a primeira e tornar opcional.
    expect(
      await screen.findByText(
        "17 perguntas · 8 blocos · 14 obrigatórias · cerca de 5 minutos",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]!);
    const editor = screen.getByRole("group", { name: "Editar pergunta" });
    fireEvent.change(within(editor).getByLabelText("Texto da pergunta"), {
      target: { value: "A integração foi útil." },
    });
    fireEvent.click(
      within(editor).getByRole("switch", { name: /Obrigatória/ }),
    );
    fireEvent.click(within(editor).getByRole("button", { name: "Salvar" }));
    expect(
      screen.getByText(
        "17 perguntas · 8 blocos · 13 obrigatórias · cerca de 5 minutos",
      ),
    ).toBeInTheDocument();
    proximo(/Próximo: Quem recebe/);
    await waitFor(() => expect(servico.alterarPesquisa).toHaveBeenCalled());
    const entrada = servico.alterarPesquisa.mock.calls.at(-1)![1] as {
      secoes: { perguntas: { texto: string; obrigatoria: boolean }[] }[];
    };
    expect(entrada.secoes[0]!.perguntas[0]).toMatchObject({
      texto: "A integração foi útil.",
      obrigatoria: false,
    });
    // Quem recebe: escolher pessoas, com o filtro "Sem e-mail".
    fireEvent.click(
      await screen.findByRole("radio", { name: /Escolher pessoas/ }),
    );
    proximo(/Próximo: E-mail/);
    expect(
      await screen.findByText("Escolha pelo menos uma pessoa."),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Escolher Ana Teste" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sem e-mail" }));
    expect(
      screen.queryByRole("checkbox", { name: "Escolher Ana Teste" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Escolher Bia Sem Email" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("1 colaborador está no público hoje"),
    ).toBeInTheDocument();
    proximo(/Próximo: E-mail/);
    // E-mail: personalizado exige os três textos.
    fireEvent.click(
      await screen.findByRole("radio", { name: /Personalizado/ }),
    );
    proximo(/Próximo: Enviar/);
    expect(
      await screen.findByText(/Preencha assunto, título e mensagem/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Assunto"), {
      target: { value: "Seus primeiros dias" },
    });
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Conte para a gente" },
    });
    fireEvent.change(screen.getByLabelText("Mensagem"), {
      target: { value: "Leva 5 minutos." },
    });
    expect(screen.getByLabelText("Prévia do e-mail")).toHaveTextContent(
      "Assunto: Seus primeiros dias",
    );
    proximo(/Próximo: Enviar/);
    // Revisão e ativação.
    expect(await screen.findByText("Revisar e enviar")).toBeInTheDocument();
    expect(screen.getByText(/1 pessoa escolhida/)).toBeInTheDocument();
    proximo(/Ativar automação/);
    await waitFor(() => expect(cliente.ativar).toHaveBeenCalledWith("onb-1"));
    expect(cliente.salvar.mock.calls.at(-1)![1]).toMatchObject({
      publico: { tipo: "pessoas", colaboradorIds: ["c1"] },
      email: { modelo: "personalizado", assunto: "Seus primeiros dias" },
    });
    expect(
      await screen.findByText(/os convites ficam aguardando e-mail/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver envios" }));
    expect(onVerEnvios).toHaveBeenCalledWith("onb-1");
  });

  it("agendar: dia e hora; enviar agora: só prazo e lembrete", async () => {
    montarAssistente();
    fireEvent.click(screen.getByRole("radio", { name: /Agendar/ }));
    expect(screen.getByLabelText("Data do envio")).toHaveValue("2026-11-28");
    expect(
      screen.getByText("Agendado · 28/11/2026 às 09:00"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Enviar agora/ }));
    expect(screen.queryByLabelText("Data do envio")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Prazo para responder")).toBeInTheDocument();
    expect(
      screen.getByText("Enviar agora · prazo de 7 dias"),
    ).toBeInTheDocument();
  });
});

const SECOES = secoesDoOnboarding();
const opcao = (chave: string, i: number) =>
  SECOES.flatMap((x) => x.perguntas).find((p) => p.chave === chave)!.config
    .opcoes![i]!.id;

function resultados(extra: Partial<Resultados> = {}): Resultados {
  const bloco = (id: string, titulo: string, indice: number) => ({
    id,
    titulo,
    indice,
    faixa:
      indice >= 85
        ? ("forte" as const)
        : indice >= 70
          ? ("saudavel" as const)
          : ("atencao" as const),
    perguntas: [],
  });
  return {
    pesquisaId: "onb-1",
    identificacao: "identificada",
    respostas: 7,
    filtro: null,
    rodadas: [
      {
        rodada: 30,
        respostas: 4,
        visivel: true,
        faltam: 0,
        indice: 80,
        faixa: "saudavel",
        blocos: [
          bloco("b1", "Onboarding e treinamento", 78),
          bloco("b3", "Colegas", 88),
        ],
        intencao: {
          opcoes: [
            { opcaoId: opcao("q13", 0), quantidade: 3, percentual: 75 },
            { opcaoId: opcao("q13", 1), quantidade: 1, percentual: 25 },
          ],
          querContinuar: 100,
        },
        motivos: {
          opcoes: [
            { opcaoId: opcao("q12", 0), quantidade: 4, percentual: 100 },
          ],
          outros: [],
        },
        recomendacao: {
          respostas: 4,
          media: 8.5,
          indice: 50,
          promotores: 2,
          neutros: 2,
          detratores: 0,
        },
      },
      {
        rodada: 60,
        respostas: 3,
        visivel: true,
        faltam: 0,
        indice: 75,
        faixa: "saudavel",
        blocos: [
          bloco("b1", "Onboarding e treinamento", 71),
          bloco("b3", "Colegas", 90),
        ],
        intencao: null,
        motivos: null,
        recomendacao: null,
      },
    ],
    comparacoes: [
      {
        de: 30,
        para: 60,
        blocos: [
          { id: "b1", antes: 78, depois: 71, mudou: -7 },
          { id: "b3", antes: 88, depois: 90, mudou: 2 },
        ],
        geral: { antes: 80, depois: 75, mudou: -5 },
      },
    ],
    peso: { suficiente: false, blocos: [] },
    fluxo: {
      de: 30,
      para: 60,
      pessoas: 3,
      visivel: true,
      fluxos: [{ de: opcao("q13", 0), para: opcao("q13", 1), quantidade: 3 }],
    },
    contatos: ["ana@example.test"],
    melhorar: ["Mais treino no primeiro dia"],
    gosta: [],
    funil: {
      noPublico: 9,
      semEmail: 1,
      aguardandoEmail: 4,
      enviados: 0,
      responderam: 3,
      pulados: 1,
      agendados: 0,
    },
    grupos: {},
    ...extra,
  };
}

function envios(): EnviosDoOnboarding {
  return {
    identificacao: "identificada",
    horario: "09:00",
    itens: [
      {
        id: "e1",
        colaboradorId: "c1",
        nome: "Ana Teste",
        rodada: 30,
        dataPrevista: "2026-12-10",
        prazo: "2026-12-17",
        situacao: "agendado",
        enviadoEm: null,
        lembreteEm: null,
      },
      {
        id: "e2",
        colaboradorId: "c2",
        nome: "Bia Sem Email",
        rodada: 30,
        dataPrevista: "2026-11-20",
        prazo: "2026-11-27",
        situacao: "sem_email",
        enviadoEm: null,
        lembreteEm: null,
      },
      {
        id: "e3",
        colaboradorId: "c3",
        nome: "Caio Teste",
        rodada: 60,
        dataPrevista: "2026-11-25",
        prazo: "2026-12-02",
        situacao: "aguardando_email",
        enviadoEm: null,
        lembreteEm: null,
      },
    ],
  };
}

describe("T216 — resultados do onboarding", () => {
  const montar = (r = resultados()) => {
    const cliente = {
      resultados: vi.fn(async () => r),
      envios: vi.fn(async () => envios()),
      pular: vi.fn(async () => undefined),
    };
    render(
      <ResultadosDoOnboarding
        pesquisaId="onb-1"
        nome="Onboarding"
        secoes={SECOES}
        cliente={cliente}
        hoje={HOJE}
      />,
    );
    return cliente;
  };

  it("índice por rodada, blocos com o que mudou, intenção, motivo, recomendação e contatos", async () => {
    montar();
    const r30 = await screen.findByRole("region", { name: "Rodada 30 dias" });
    expect(r30).toHaveTextContent("80");
    expect(r30).toHaveTextContent("Saudável");
    const blocos = screen.getByRole("region", { name: "Média de cada bloco" });
    expect(
      within(blocos).getByRole("row", { name: /Onboarding e treinamento/ }),
    ).toHaveTextContent("7871−7");
    expect(
      within(blocos).getByRole("row", { name: /Colegas/ }),
    ).toHaveTextContent("+2");
    expect(blocos).toHaveTextContent(
      "Quer continuar na empresa nos próximos 6 meses: 100% aos 30 dias.",
    );
    const intencao = screen.getByRole("region", { name: "Intenção de ficar" });
    expect(intencao).toHaveTextContent("Quer ficar: 75% (3)");
    expect(intencao).toHaveTextContent(
      "Quer ficar → Fica, mas pensa em opções: 3 pessoas",
    );
    expect(
      screen.getByRole("region", { name: "Principal motivo para ficar" }),
    ).toHaveTextContent("Remuneração ou comissão: 100%");
    expect(
      screen.getByRole("region", { name: "Recomendação" }),
    ).toHaveTextContent("30 dias: 50");
    expect(
      screen.getByRole("region", { name: "Peso de cada bloco" }),
    ).toHaveTextContent("20 respostas ou mais");
    expect(screen.getByRole("region", { name: "Contatos" })).toHaveTextContent(
      "ana@example.test",
    );
    expect(
      screen.getByRole("region", { name: "Funil dos convites" }),
    ).toHaveTextContent("Aguardando e-mail4");
  });

  it("rodada com menos de 3 respostas não mostra números", async () => {
    const r = resultados();
    montar({
      ...r,
      rodadas: [
        {
          ...r.rodadas[0]!,
          respostas: 2,
          visivel: false,
          faltam: 1,
          indice: null,
          faixa: null,
          blocos: [],
        },
      ],
      comparacoes: [],
    });
    expect(
      await screen.findByText(/Esta rodada tem 2 respostas.*Faltam 1/),
    ).toBeInTheDocument();
  });

  it("envios: filtros, próximo envio e pular só o agendado", async () => {
    const cliente = montar();
    fireEvent.click(await screen.findByRole("tab", { name: "Envios (3)" }));
    expect(
      screen.getByText("Próximo envio: 10/12/2026 às 09:00 · Ana Teste."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Pular envio/ })).toHaveLength(
      1,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sem e-mail" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Pular envio de Ana Teste" }),
    );
    await waitFor(() =>
      expect(cliente.pular).toHaveBeenCalledWith("onb-1", "e1"),
    );
  });

  it("sem respostas: próximo convite e o atalho aos envios", async () => {
    montar({ ...resultados(), respostas: 0 });
    expect(
      await screen.findByText(
        /O próximo convite sai em 10\/12\/2026, às 09:00/,
      ),
    ).toBeInTheDocument();
  });

  it("planilha com as abas do padrão e sem CPF", () => {
    const texto = new TextDecoder().decode(
      planilhaDoOnboarding("Onboarding", SECOES, resultados(), envios()),
    );
    for (const aba of [
      "Resumo",
      "Por rodada",
      "Blocos",
      "Intenção e motivos",
      "Recomendação",
      "Peso dos blocos",
      "Envios",
      "Comentários",
      "Metodologia",
    ]) {
      expect(texto).toContain(aba);
    }
    expect(texto).toContain("Aguardando e-mail");
    expect(texto).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });
});
