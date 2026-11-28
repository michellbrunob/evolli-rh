/**
 * T216 — Onboarding: o questionário (17 em 8 blocos), as regras da tela,
 * o assistente de 5 etapas (envio automático, perguntas, público, e-mail e
 * ativação), os resultados por rodada, os envios e a planilha; o rascunho
 * gravado ao abrir e retomado, a lista para escolher pessoas, o e-mail com
 * a empresa ativa, "Ver como", logo e cores e o teste antes de enviar.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PesquisaDetalhe } from "../../../../api/pesquisasClient";
import { lembrarRascunho, memoriaDoRascunho } from "../../rascunhosLocais";
import { AssistenteDoOnboarding, naEmpresa } from "./AssistenteDoOnboarding";
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
  corDoTextoSobre,
  errosDaConfiguracao,
  fundoClaro,
  resumoDoEnvio,
  siglaDaEmpresa,
  textoDaContagem,
  textoDasProximas,
  textoDoBotaoFinal,
} from "./regrasDoOnboarding";
import { ResultadosDoOnboarding } from "./ResultadosDoOnboarding";

const HOJE = "2026-11-27";

afterEach(() => localStorage.clear());

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

function montarAssistente(
  extra: {
    base?: PesquisaDetalhe;
    gravada?: ConfigOnboarding;
    empresa?: string | null;
  } = {},
) {
  const servico = {
    criarPesquisa: vi.fn(async (_e: unknown) => detalhe()),
    alterarPesquisa: vi.fn(async (id: string, _e: unknown) => detalhe({ id })),
  };
  const cliente = {
    salvar: vi.fn(async (_id: string, _c: ConfigOnboarding) =>
      onboardingDetalhe(),
    ),
    ativar: vi.fn(async (_id: string) => onboardingDetalhe()),
    previaDoPublico: vi.fn(async (p: Publico, _u: boolean) => previa(p)),
    obter: vi.fn(async (_id: string) => ({
      ...onboardingDetalhe(),
      config: extra.gravada ?? CONFIG_PADRAO,
    })),
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
  const onRascunhoCriado = vi.fn();
  const onAbrirPrevia = vi.fn();
  render(
    <AssistenteDoOnboarding
      servico={servico}
      cliente={cliente}
      listarGrupos={listarGrupos}
      {...(extra.base ? { base: extra.base } : {})}
      empresa={
        extra.empresa === undefined ? "Empresa Sintética" : extra.empresa
      }
      hoje={HOJE}
      onRascunhoCriado={onRascunhoCriado}
      onAbrirPrevia={onAbrirPrevia}
      onVoltar={() => {}}
      onVerEnvios={onVerEnvios}
    />,
  );
  return { servico, cliente, onVerEnvios, onRascunhoCriado, onAbrirPrevia };
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
    // O rascunho nasceu ao abrir; com erro, não é regravado.
    await waitFor(() => expect(servico.criarPesquisa).toHaveBeenCalledTimes(1));
    expect(servico.alterarPesquisa).not.toHaveBeenCalled();
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

describe("T216 — anônima sem lembrete (provas extras)", () => {
  it("o que vai para a API na anônima nunca leva lembrete, em nenhum modo", () => {
    for (const modo of ["agora", "agendar", "automatizar"] as const) {
      expect(
        configParaEnviar({ ...CONFIG_PADRAO, modo, lembreteDias: 5 }, "anonima")
          .lembreteDias,
      ).toBeNull();
    }
    expect(
      configParaEnviar({ ...CONFIG_PADRAO, lembreteDias: 5 }, "confidencial")
        .lembreteDias,
    ).toBe(5);
  });

  it("o assistente grava a anônima sem lembrete", async () => {
    const { cliente, servico } = montarAssistente();
    fireEvent.click(screen.getByRole("radio", { name: /Anônima/ }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo: Perguntas/ }));
    await waitFor(() => expect(servico.alterarPesquisa).toHaveBeenCalled());
    await waitFor(() =>
      expect(cliente.salvar.mock.calls.at(-1)![1].lembreteDias).toBeNull(),
    );
  });
});

describe("T216 — rascunho do onboarding (R3)", () => {
  it("grava ao abrir; cada etapa regrava o mesmo rascunho e guarda onde parou", async () => {
    const { servico, cliente, onRascunhoCriado } = montarAssistente();
    await waitFor(() => expect(onRascunhoCriado).toHaveBeenCalledWith("onb-1"));
    expect(servico.criarPesquisa).toHaveBeenCalledTimes(1);
    expect(cliente.salvar).toHaveBeenCalledWith(
      "onb-1",
      expect.objectContaining({ modo: "automatizar" }),
    );
    expect(await screen.findByText(/Rascunho salvo às/)).toBeInTheDocument();
    expect(memoriaDoRascunho("onb-1")?.etapa).toBe(1);
    proximo(/Próximo: Perguntas/);
    await screen.findByText(/17 perguntas · 8 blocos/);
    expect(servico.alterarPesquisa).toHaveBeenCalledWith(
      "onb-1",
      expect.anything(),
    );
    expect(memoriaDoRascunho("onb-1")?.etapa).toBe(2);
    expect(servico.criarPesquisa).toHaveBeenCalledTimes(1);
    expect(onRascunhoCriado).toHaveBeenCalledTimes(1);
  });

  it("reabre o rascunho na etapa em que parou, com o que foi gravado", async () => {
    lembrarRascunho("onb-9", {
      etapa: 4,
      totalDeEtapas: 5,
      salvoEm: "2026-11-27T15:00:00.000Z",
    });
    const { servico, cliente, onRascunhoCriado } = montarAssistente({
      base: detalhe({
        id: "onb-9",
        nome: "Onboarding retomado",
        identificacao: "identificada",
        boasVindas: "Bem-vinda!",
        secoes: secoesDoOnboarding(),
      }),
      gravada: {
        ...CONFIG_PADRAO,
        email: {
          modelo: "personalizado",
          assunto: "Assunto gravado",
          titulo: "Título gravado",
          mensagem: "Mensagem gravada.",
          corPrincipal: "#7c3aed",
          corFundo: null,
        },
      },
    });
    expect(
      await screen.findByRole("radio", { name: /Personalizado/ }),
    ).toBeChecked();
    expect(cliente.obter).toHaveBeenCalledWith("onb-9");
    expect(screen.getByLabelText("Prévia do e-mail")).toHaveTextContent(
      "Assunto: Assunto gravado",
    );
    proximo(/Próximo: Enviar/);
    expect(await screen.findByText("Revisar e enviar")).toBeInTheDocument();
    expect(
      screen.getByText(/Onboarding retomado · Identificada/),
    ).toBeInTheDocument();
    expect(servico.alterarPesquisa).toHaveBeenCalledWith(
      "onb-9",
      expect.objectContaining({
        nome: "Onboarding retomado",
        boasVindas: "Bem-vinda!",
        identificacao: "identificada",
      }),
    );
    expect(cliente.salvar).toHaveBeenLastCalledWith(
      "onb-9",
      expect.objectContaining({
        email: expect.objectContaining({ corPrincipal: "#7c3aed" }),
      }),
    );
    expect(servico.criarPesquisa).not.toHaveBeenCalled();
    expect(onRascunhoCriado).not.toHaveBeenCalled();
  });
});

describe("T216 — escolher pessoas sem ninguém marcado (R3)", () => {
  it("a lista aparece e dá para marcar; a prévia vazia não vai para a API", async () => {
    const { cliente } = montarAssistente();
    proximo(/Próximo: Perguntas/);
    await screen.findByText(/17 perguntas · 8 blocos/);
    proximo(/Próximo: Quem recebe/);
    fireEvent.click(
      await screen.findByRole("radio", { name: /Escolher pessoas/ }),
    );
    expect(
      await screen.findByRole("checkbox", { name: "Escolher Ana Teste" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Escolher Bia Sem Email" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 pessoas no público")).toBeInTheDocument();
    for (const [publico] of cliente.previaDoPublico.mock.calls) {
      expect(
        publico.tipo === "pessoas" && publico.colaboradorIds.length === 0,
      ).toBe(false);
    }
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Escolher Ana Teste" }),
    );
    await waitFor(() =>
      expect(cliente.previaDoPublico).toHaveBeenLastCalledWith(
        { tipo: "pessoas", colaboradorIds: ["c1"] },
        true,
      ),
    );
    expect(await screen.findByText("1 pessoa no público")).toBeInTheDocument();
  });

  it("rascunho reaberto com pessoas escolhidas: a lista vem de todos os ativos", async () => {
    lembrarRascunho("onb-9", {
      etapa: 3,
      totalDeEtapas: 5,
      salvoEm: "2026-11-27T15:00:00.000Z",
    });
    const { cliente } = montarAssistente({
      base: detalhe({ id: "onb-9", secoes: secoesDoOnboarding() }),
      gravada: {
        ...CONFIG_PADRAO,
        publico: { tipo: "pessoas", colaboradorIds: ["c2"] },
      },
    });
    expect(
      await screen.findByRole("checkbox", { name: "Escolher Bia Sem Email" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Escolher Ana Teste" }),
    ).not.toBeChecked();
    expect(cliente.previaDoPublico).toHaveBeenCalledWith(
      { tipo: "todos" },
      true,
    );
  });
});

describe("T216 — e-mail e envio do onboarding (R3)", () => {
  async function irAoEmail(extra: Parameters<typeof montarAssistente>[0] = {}) {
    const m = montarAssistente(extra);
    proximo(/Próximo: Perguntas/);
    await screen.findByText(/17 perguntas · 8 blocos/);
    proximo(/Próximo: Quem recebe/);
    await screen.findByRole("radio", { name: /Escolher pessoas/ });
    proximo(/Próximo: E-mail/);
    await screen.findByRole("radio", { name: /Personalizado/ });
    return m;
  }

  it("rodadas de 60 e 90 dias dizem o marco que a pessoa atinge", async () => {
    montarAssistente();
    expect(
      await screen.findByText(
        "1 pessoa chega aos 60 dias de casa nos próximos 30 dias",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "0 pessoas chegam aos 90 dias de casa nos próximos 30 dias",
      ),
    ).toBeInTheDocument();
    expect(textoDasProximas(30, 1)).toBe("1 pessoa nos próximos 30 dias");
    expect(textoDasProximas(90, 2)).toBe(
      "2 pessoas chegam aos 90 dias de casa nos próximos 30 dias",
    );
  });

  it("sem e-mail no cadastro: o atalho para completar o cadastro", async () => {
    montarAssistente();
    proximo(/Próximo: Perguntas/);
    await screen.findByText(/17 perguntas · 8 blocos/);
    proximo(/Próximo: Quem recebe/);
    const link = await screen.findByRole("link", {
      name: "Completar cadastro",
    });
    expect(link).toHaveAttribute("href", "#/pessoas/colaboradores");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("prévia com a empresa ativa, para quem e 'Ver como'; teste preparado e desligado", async () => {
    await irAoEmail();
    const previa = screen.getByRole("group", { name: "Prévia do e-mail" });
    expect(previa).toHaveTextContent("De: Empresa Sintética");
    expect(previa).toHaveTextContent("Para: Ana Teste");
    expect(previa).toHaveTextContent(
      "Assunto: Como estão seus primeiros dias na Empresa Sintética?",
    );
    expect(previa).toHaveTextContent("Olá, Ana,");
    expect(
      within(previa).getByLabelText("Sigla de Empresa Sintética"),
    ).toHaveTextContent("ES");
    fireEvent.change(screen.getByLabelText("Ver como"), {
      target: { value: "c2" },
    });
    expect(previa).toHaveTextContent("Para: Bia Sem Email");
    expect(previa).toHaveTextContent("Olá, Bia,");
    const teste = screen.getByRole("button", { name: "Enviar teste para mim" });
    expect(teste).toBeDisabled();
    expect(teste).toHaveAccessibleDescription(
      /O envio de e-mail entra na próxima etapa do Evolli/,
    );
    expect(screen.getByText(/remetente Empresa Sintética/)).toBeInTheDocument();
  });

  it("sem o nome da empresa: textos neutros, nunca 'na a empresa'", async () => {
    await irAoEmail({ empresa: null });
    const previa = screen.getByRole("group", { name: "Prévia do e-mail" });
    expect(previa).toHaveTextContent("De: Empresa");
    expect(previa).toHaveTextContent(
      "Assunto: Como estão seus primeiros dias na empresa?",
    );
    expect(previa).not.toHaveTextContent("na a empresa");
    expect(naEmpresa("Alfa")).toBe("na Alfa");
    expect(naEmpresa("  ")).toBe("na empresa");
    expect(naEmpresa(null)).toBe("na empresa");
  });

  it("personalizado: abas Texto e Logo e cores; a cor vai para a prévia e para a API", async () => {
    const { cliente } = await irAoEmail();
    fireEvent.click(screen.getByRole("radio", { name: /Personalizado/ }));
    expect(screen.getByRole("tab", { name: "Texto" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.change(screen.getByLabelText("Assunto"), {
      target: { value: "Assunto" },
    });
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Título" },
    });
    fireEvent.change(screen.getByLabelText("Mensagem"), {
      target: { value: "Mensagem." },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Logo e cores" }));
    expect(screen.queryByLabelText("Assunto")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar logo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Roxo" }));
    const botao = within(
      screen.getByRole("group", { name: "Prévia do e-mail" }),
    ).getByText("Responder pesquisa →");
    expect(botao).toHaveStyle({ background: "#7c3aed", color: "#ffffff" });
    fireEvent.change(screen.getByLabelText("Código da cor"), {
      target: { value: "#12" },
    });
    expect(screen.getByText("Use o formato #RRGGBB.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Código da cor"), {
      target: { value: "#FFD60A" },
    });
    expect(botao).toHaveStyle({ color: "#000000" });
    fireEvent.click(screen.getByRole("radio", { name: "Areia" }));
    expect(screen.getByRole("group", { name: "Prévia do e-mail" })).toHaveStyle(
      {
        background: "#fff7ed",
      },
    );
    proximo(/Próximo: Enviar/);
    await screen.findByText("Revisar e enviar");
    expect(cliente.salvar.mock.calls.at(-1)![1].email).toMatchObject({
      modelo: "personalizado",
      corPrincipal: "#ffd60a",
      corFundo: "#fff7ed",
    });
  });

  it("teste antes de enviar: abre a prévia do rascunho; o envio de teste fica desligado", async () => {
    const { onAbrirPrevia } = await irAoEmail();
    proximo(/Próximo: Enviar/);
    const cartao = await screen.findByRole("region", {
      name: "Teste antes de enviar",
    });
    fireEvent.click(
      within(cartao).getByRole("button", { name: "Abrir prévia" }),
    );
    expect(onAbrirPrevia).toHaveBeenCalledWith("onb-1");
    expect(
      within(cartao).getByRole("button", { name: "Enviar teste para mim" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Remetente Empresa Sintética · Padrão/),
    ).toBeInTheDocument();
  });

  it("cores: contraste do texto, fundo só claro e a sigla da empresa", () => {
    expect(corDoTextoSobre("#111827")).toBe("#ffffff");
    expect(corDoTextoSobre("#ffd60a")).toBe("#000000");
    expect(fundoClaro("#fff7ed")).toBe(true);
    expect(fundoClaro("#808080")).toBe(false);
    expect(fundoClaro("#fff")).toBe(false);
    expect(siglaDaEmpresa("Empresa Sintética Ltda")).toBe("ES");
    expect(siglaDaEmpresa("alfa")).toBe("A");
    expect(siglaDaEmpresa(null)).toBe("RH");
  });
});
