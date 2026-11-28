/**
 * T216 — telas da NR-1 e da saúde financeira: questionário fixo no
 * assistente, resultados, plano de ação, conformidade, resultado
 * individual, planilha e a escala com o rótulo de cada ponto.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { configure } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  AcompanhamentoNr1,
  DimensaoNr1Resultado,
  NivelNr1,
  ResultadoDoModelo,
  ResultadoIsfb,
  ServicoDosModelos,
} from "../../../api/modelosDePesquisaClient";
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
} from "../../../api/pesquisasClient";
import { CampoDaPergunta } from "../../publico/CampoDaPergunta";
import { DETALHE, RESPOSTA_DETALHE, servicoFalso } from "../dadosDeTeste";
import { modeloDaGaleria, secoesDoModelo } from "../modelosDePesquisa";
import { ResultadosDaPesquisa } from "../ResultadosDaPesquisa";
import { DIMENSOES_NR1 } from "./copsoq/definicao";
import { abasDaPlanilhaIsfb, abasDaPlanilhaNr1 } from "./exportacao";
import { leituraAutomatica } from "./isfb/VisaoGeralIsfb";
import {
  QuestionarioFixo,
  comAutopercepcao,
  resumoDoQuestionarioFixo,
  seloDaPerguntaFixa,
} from "./QuestionarioFixo";
import { IndividualDoModeloTela, PainelDoModelo } from "./registro";

// As análises carregam em duas etapas (sem e com o recorte): folga na suíte cheia.
configure({ asyncUtilTimeout: 4000 });

const NIVEIS_DE_TESTE: Record<string, NivelNr1> = {
  exigencias_quantitativas: "critico",
  ritmo_trabalho: "alto",
  apoio_social_colegas: "alto",
  burnout: "medio",
};

function dimensao(id: string): DimensaoNr1Resultado {
  const d = DIMENSOES_NR1.find((x) => x.id === id)!;
  const nivel = NIVEIS_DE_TESTE[id] ?? "baixo";
  const risco = nivel === "critico" ? 3 : nivel === "alto" ? 2 : 0;
  return {
    id,
    dominio: d.dominio,
    tipo: d.tipo,
    pessoas: 4,
    escore: nivel === "critico" ? 4.25 : 3,
    tercil: nivel === "critico" ? 3 : 2,
    faixa: risco ? "risco" : "intermediario",
    distribuicao: { risco, intermediario: 4 - risco, favoravel: 0 },
    percentuais: {
      risco: risco * 25,
      intermediario: (4 - risco) * 25,
      favoravel: 0,
    },
    severidade: nivel === "critico" ? 4 : 3,
    prevalencia: nivel === "critico" ? 4 : nivel === "alto" ? 3 : 1,
    nivel,
    regraDeProtecao: false,
  };
}

const DIMENSOES = DIMENSOES_NR1.map((d) => dimensao(d.id));
const PRIORIDADES = [
  "exigencias_quantitativas",
  "apoio_social_colegas",
  "ritmo_trabalho",
  "burnout",
  ...DIMENSOES_NR1.map((d) => d.id).filter((id) => !(id in NIVEIS_DE_TESTE)),
];

const RESULTADO_NR1: ResultadoDoModelo = {
  modelo: "copsoq",
  respostas: 4,
  visivel: true,
  minimoPorGrupo: 3,
  recortes: ["departamento"],
  nr1: {
    respostas: 4,
    dimensoes: DIMENSOES,
    prioridades: PRIORIDADES,
    niveis: { critico: 1, alto: 2, medio: 1, baixo: 25 },
    precisamDeAcao: 3,
    matriz: [
      [[], [], [], ["exigencias_quantitativas"]],
      [[], [], ["apoio_social_colegas", "ritmo_trabalho"], []],
      [[], [], [], []],
      [["burnout"], [], [], []],
    ],
    dominios: [
      {
        id: "exigencias_laborais",
        dimensoes: 4,
        precisamDeAcao: 2,
        percentualEmRisco: 31.3,
      },
    ],
    saude: [
      {
        id: "burnout",
        pessoasEmRisco: 1,
        pessoas: 4,
        percentualEmRisco: 25,
        nivel: "medio",
      },
    ],
    ofensivos: {
      pessoas: 4,
      relataram: null,
      percentual: null,
      tipos: [
        {
          id: "Q73",
          raramente: null,
          asVezes: 0,
          frequentementeOuSempre: 0,
          relataram: null,
        },
      ],
    },
    pressao: 3.31,
    recursos: 2.9,
  },
  isfb: null,
  campo: null,
  grupos: null,
  semGrupo: 0,
};

const ACOMPANHAMENTO: AcompanhamentoNr1 = {
  etapas: [
    {
      id: "mapear",
      itens: [],
      evidencias: null,
      concluidaEm: null,
      concluida: true,
      automatica: true,
    },
    {
      id: "plano",
      itens: [],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: true,
    },
    {
      id: "comunicar",
      itens: [false, false, false],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: false,
    },
    {
      id: "validar",
      itens: [false, false, false],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: false,
    },
    {
      id: "treinar",
      itens: [false, false, false],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: false,
    },
    {
      id: "implementar",
      itens: [false, false, false],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: false,
    },
    {
      id: "revisar",
      itens: [false, false],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: false,
    },
  ],
  plano: [],
  profissionalSst: { nome: null, registro: null },
  atualizadoEm: null,
  concluidas: 1,
  proxima: "plano",
  revisarEm: "2027-11",
};

const ISFB: ResultadoIsfb = {
  pessoas: 3,
  isfb: 53,
  faixa: "baixa",
  diferencaDoBrasil: -3.7,
  mediaDoBrasil: 56.7,
  dimensoes: [
    { id: "seguranca", nota: 51, faixa: "baixa", pessoas: 3 },
    { id: "habilidade", nota: 52, faixa: "baixa", pessoas: 3 },
    { id: "comportamento", nota: 60, faixa: "ok", pessoas: 3 },
    { id: "liberdade", nota: 54, faixa: "baixa", pessoas: 3 },
    { id: "autopercepcao", nota: 80, faixa: "boa", pessoas: 1 },
  ],
  distribuicao: Array.from({ length: 20 }, (_, i) =>
    i === 10 ? 2 : i === 1 ? 1 : 0,
  ),
  saude: {
    baixa: { quantidade: 2, percentual: 66.7 },
    no_limite: { quantidade: 0, percentual: 0 },
    saudavel: { quantidade: 1, percentual: 33.3 },
  },
  sinais: {
    gasta_mais: { quantidade: 1, percentual: 33.3 },
    estresse: { quantidade: 2, percentual: 66.7 },
    apertado: { quantidade: 1, percentual: 33.3 },
    sem_reserva: { quantidade: 1, percentual: 33.3 },
  },
  sinaisAcumulados: [1, 1, 0, 0, 1],
  perfis: {
    estaveis: { quantidade: 2, percentual: 66.7 },
    confortaveis_sem_metodo: { quantidade: 0, percentual: 0 },
    apertados_organizados: { quantidade: 0, percentual: 0 },
    em_risco: { quantidade: 1, percentual: 33.3 },
  },
  pontoDoTime: { seguranca: 51, capacidade: 56 },
  perguntas: [
    {
      id: "Q2",
      respostas: 3,
      favoravel: 33.3,
      desfavoravel: 66.7,
      pontos: [1, 1, 0, 0, 1],
    },
  ],
  produtos: { poupanca: { quantidade: 2, percentual: 66.7 } },
  base: {
    semReserva: { quantidade: 1, percentual: 33.3 },
    comPrevidencia: { quantidade: 0, percentual: 0 },
    doisOuMaisFinanciamentos: { quantidade: 1, percentual: 33.3 },
    produtosPorPessoa: 4,
  },
  creditoReserva: {
    creditoSemReserva: 1,
    creditoComReserva: 1,
    semCreditoSemReserva: 0,
    semCreditoComReserva: 1,
  },
  temas: [{ id: "reserva", quantidade: 1, percentual: 33.3 }],
  aberturas: {
    sabem_que_precisam: { quantidade: 1, percentual: 100 },
    ponto_cego: { quantidade: 0, percentual: 0 },
    bem_e_atentos: { quantidade: 0, percentual: 0 },
    bem_mas_desatentos: { quantidade: 0, percentual: 0 },
  },
  comAutopercepcao: 1,
  porRenda: [
    {
      id: "ate_1_5",
      respostas: 1,
      visivel: false,
      oculto: "minimo",
      saude: null,
    },
  ],
};

const RESULTADO_ISFB: ResultadoDoModelo = {
  ...RESULTADO_NR1,
  modelo: "isfb",
  respostas: 3,
  nr1: null,
  isfb: ISFB,
};

function servicoDosModelos(
  extra: Partial<ServicoDosModelos> = {},
): ServicoDosModelos {
  return {
    resultadoDoModelo: vi.fn(() => Promise.resolve(RESULTADO_NR1)),
    individualDoModelo: vi.fn(() => Promise.reject(new Error("sem"))),
    acompanhamentoNr1: vi.fn(() => Promise.resolve(ACOMPANHAMENTO)),
    gravarAcompanhamentoNr1: vi.fn((_id, e) =>
      Promise.resolve({
        ...ACOMPANHAMENTO,
        plano: e.plano,
        concluidas: e.plano.length ? 2 : 1,
      }),
    ),
    ...extra,
  };
}

const NR1: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "copsoq",
  identificacao: "anonima",
  separarPor: ["departamento"],
};
const SAUDE_FIN: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "isfb",
  identificacao: "anonima",
  separarPor: ["departamento"],
};

describe("questionário fixo no assistente", () => {
  it("NR-1: 8 domínios sem edição, 5 escalas e o selo da escala de cada item", () => {
    const secoes = secoesDoModelo(modeloDaGaleria("copsoq"));
    render(
      <QuestionarioFixo
        modelo="copsoq"
        secoes={secoes}
        travado={false}
        onMudar={vi.fn()}
      />,
    );
    const cartao = screen.getByRole("region", { name: "Perguntas" });
    expect(within(cartao).getByText("76")).toBeInTheDocument();
    expect(cartao.querySelectorAll("details")).toHaveLength(8);
    expect(
      within(cartao).getByText(/não podem ser editadas/),
    ).toBeInTheDocument();
    expect(
      within(cartao).queryByRole("button", { name: /Adicionar/ }),
    ).toBeNull();
    const q64 = secoes[6]!.perguntas[0]!;
    expect(seloDaPerguntaFixa("copsoq", q64)).toBe("Saúde");
    expect(resumoDoQuestionarioFixo("copsoq", secoes)).toBe(
      "76 perguntas fixas em 8 domínios",
    );
  });

  it("saúde financeira: o interruptor tira e volta a autopercepção", () => {
    const secoes = secoesDoModelo(modeloDaGaleria("isfb"));
    const onMudar = vi.fn();
    render(
      <QuestionarioFixo
        modelo="isfb"
        secoes={secoes}
        travado={false}
        onMudar={onMudar}
      />,
    );
    expect(screen.getByText("18 de 18")).toBeInTheDocument();
    const interruptor = screen.getByRole("switch", {
      name: "Incluir autopercepção",
    });
    expect(interruptor).toHaveAttribute("aria-checked", "true");
    fireEvent.click(interruptor);
    const sem = onMudar.mock.calls[0]![0];
    expect(sem.map((s: { id: string }) => s.id)).not.toContain("autopercepcao");
    expect(resumoDoQuestionarioFixo("isfb", sem)).toBe(
      "15 perguntas do índice",
    );
    expect(comAutopercepcao(sem, true).map((s) => s.id)).toContain(
      "autopercepcao",
    );
    expect(seloDaPerguntaFixa("isfb", secoes[0]!.perguntas[1]!)).toBe(
      "Nada → Totalmente · invertida",
    );
    expect(seloDaPerguntaFixa("isfb", secoes[0]!.perguntas[0]!)).toBe(
      "5 opções",
    );
  });
});

describe("resultados da NR-1", () => {
  it("abas próprias e a visão geral com níveis, matriz e prioridades", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() => Promise.resolve(NR1)),
    });
    render(
      <ResultadosDaPesquisa
        servico={servico}
        servicoDosModelos={servicoDosModelos()}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    const abas = await screen.findAllByRole("tab");
    expect(abas.map((a) => a.textContent)).toEqual([
      "Visão geral",
      "Por grupo",
      "Plano de ação",
      "Conformidade NR-1",
      expect.stringMatching(/^Respostas/),
    ]);
    expect(
      await screen.findByText("de 29 dimensões precisam de ação"),
    ).toBeInTheDocument();
    const matriz = screen.getByRole("table", { name: /Matriz de risco/ });
    expect(
      within(matriz).getAllByText("Exigências Quantitativas").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("1 de 3 em risco alto ou crítico"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima dimensão" }));
    expect(
      screen.getByText("2 de 3 em risco alto ou crítico"),
    ).toBeInTheDocument();
    // Sigilo: menos de 3 pessoas.
    expect(screen.getAllByText(/menos de 3 pessoas/).length).toBeGreaterThan(0);
    expect(screen.getByText("1 de 7 etapas")).toBeInTheDocument();
    // Ranking: alto e crítico por padrão; "Todas" mostra as 29.
    const ranking = screen.getByRole("region", {
      name: "Ranking de prioridades",
    });
    expect(within(ranking).getAllByRole("row")).toHaveLength(4);
    fireEvent.click(within(ranking).getByRole("button", { name: /Todas/ }));
    expect(within(ranking).getAllByRole("row")).toHaveLength(30);
  });

  it("plano de ação: o RH escreve a medida e salva", async () => {
    const sm = servicoDosModelos();
    render(
      <PainelDoModelo detalhe={NR1} aba="plano" podeEditar servico={sm} />,
    );
    expect(
      await screen.findByRole("region", {
        name: "Medidas de Exigências Quantitativas",
      }),
    ).toBeInTheDocument();
    const salvar = screen.getByRole("button", { name: "Salvar plano" });
    expect(salvar).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar medida" }));
    fireEvent.change(screen.getByLabelText("O que fazer"), {
      target: { value: "Rever a carga" },
    });
    fireEvent.change(screen.getByLabelText("Controle"), {
      target: { value: "eliminacao" },
    });
    fireEvent.click(salvar);
    await waitFor(() =>
      expect(sm.gravarAcompanhamentoNr1).toHaveBeenCalledTimes(1),
    );
    const [, entrada] = vi.mocked(sm.gravarAcompanhamentoNr1).mock.calls[0]!;
    expect(entrada.plano).toEqual([
      expect.objectContaining({
        dimensaoId: "exigencias_quantitativas",
        titulo: "Rever a carga",
        controle: "eliminacao",
        situacao: "planejada",
      }),
    ]);
    // Sem permissão de edição, nada se edita.
  });

  it("plano sem permissão: só leitura", async () => {
    render(
      <PainelDoModelo
        detalhe={NR1}
        aba="plano"
        podeEditar={false}
        servico={servicoDosModelos()}
      />,
    );
    await screen.findByRole("region", { name: /Medidas de/ });
    expect(
      screen.queryByRole("button", { name: "+ Adicionar medida" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar plano" })).toBeNull();
  });

  it("conformidade: concluir exige um item marcado e grava a etapa", async () => {
    const sm = servicoDosModelos();
    render(
      <PainelDoModelo
        detalhe={NR1}
        aba="conformidade"
        podeEditar
        servico={sm}
      />,
    );
    expect(
      await screen.findByRole("img", { name: "1 de 7 etapas concluídas" }),
    ).toBeInTheDocument();
    const comunicar = screen
      .getByText("Comunicar os resultados às pessoas")
      .closest("li")!;
    const concluir = within(comunicar).getByRole("button", {
      name: "Concluir etapa",
    });
    expect(concluir).toBeDisabled();
    fireEvent.click(
      within(comunicar).getByLabelText(
        "Registrar a ata com a lista de presença",
      ),
    );
    expect(concluir).toBeEnabled();
    fireEvent.click(concluir);
    await waitFor(() =>
      expect(sm.gravarAcompanhamentoNr1).toHaveBeenCalledTimes(1),
    );
    const [, entrada] = vi.mocked(sm.gravarAcompanhamentoNr1).mock.calls[0]!;
    expect(entrada.etapas.find((e) => e.id === "comunicar")).toEqual({
      id: "comunicar",
      itens: [false, false, true],
      evidencias: null,
      concluida: true,
    });
    expect(entrada.etapas.map((e) => e.id)).not.toContain("mapear");
    expect(screen.getByText("Prevista para 11/2027")).toBeInTheDocument();
  });

  it("confidencial abaixo do mínimo: nada aparece", async () => {
    const sm = servicoDosModelos({
      resultadoDoModelo: vi.fn(() =>
        Promise.resolve({ ...RESULTADO_NR1, visivel: false, nr1: null }),
      ),
    });
    render(
      <PainelDoModelo
        detalhe={{ ...NR1, identificacao: "confidencial", respostas: 2 }}
        aba="geral"
        podeEditar
        servico={sm}
      />,
    );
    expect(
      await screen.findByText("Poucas respostas para mostrar"),
    ).toBeInTheDocument();
  });

  it("por grupo: pede o recorte e oculta grupo abaixo do mínimo", async () => {
    const sm = servicoDosModelos({
      resultadoDoModelo: vi.fn((_id, campo) =>
        Promise.resolve({
          ...RESULTADO_NR1,
          campo: campo ?? null,
          grupos: campo
            ? [
                {
                  id: "g1",
                  nome: "Comercial",
                  respostas: 3,
                  visivel: true,
                  oculto: null,
                  nr1: {
                    pressao: 3.6,
                    recursos: 2.5,
                    destaque: true,
                    niveis: { critico: 1, alto: 0, medio: 0, baixo: 28 },
                    precisamDeAcao: 1,
                    dimensoes: [],
                  },
                  isfb: null,
                },
                {
                  id: "g2",
                  nome: "Financeiro",
                  respostas: 1,
                  visivel: false,
                  oculto: "minimo" as const,
                  nr1: null,
                  isfb: null,
                },
              ]
            : null,
        }),
      ),
    });
    render(
      <PainelDoModelo detalhe={NR1} aba="analises" podeEditar servico={sm} />,
    );
    expect(
      await screen.findByText("Mais pressão e menos recursos"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Oculto · menos de 3 respostas"),
    ).toBeInTheDocument();
    expect(sm.resultadoDoModelo).toHaveBeenLastCalledWith(
      "p-1",
      "departamento",
    );
  });
});

describe("resultados da saúde financeira", () => {
  it("nota do time, faixa, sinais e perfis", async () => {
    const sm = servicoDosModelos({
      resultadoDoModelo: vi.fn(() => Promise.resolve(RESULTADO_ISFB)),
    });
    render(
      <PainelDoModelo
        detalhe={SAUDE_FIN}
        aba="geral"
        podeEditar
        servico={sm}
      />,
    );
    expect(
      (await screen.findAllByText("Baixa · 50 a 56")).length,
    ).toBeGreaterThan(1);
    expect(screen.getByText("Brasil 56,7 · −3,7")).toBeInTheDocument();
    expect(
      screen.getByText("67% dizem que dinheiro gera estresse em casa"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Oculto · menos de 3 respostas"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Nota do time: 53 de 100/ }),
    ).toBeInTheDocument();
  });

  it("análises: sinais acumulados, crédito × reserva e abertura a apoio", async () => {
    const sm = servicoDosModelos({
      resultadoDoModelo: vi.fn(() => Promise.resolve(RESULTADO_ISFB)),
    });
    render(
      <PainelDoModelo
        detalhe={SAUDE_FIN}
        aba="analises"
        podeEditar
        servico={sm}
      />,
    );
    expect(
      await screen.findByText("1 pessoa com 3 ou 4 sinais"),
    ).toBeInTheDocument();
    expect(screen.getByText("Risco de dívida cara")).toBeInTheDocument();
    expect(screen.getByText("Sabem que precisam")).toBeInTheDocument();
  });

  it("leitura automática por regras", () => {
    expect(leituraAutomatica(ISFB)).toEqual({
      urgente: "67% dizem que dinheiro gera estresse em casa.",
      atencao: "Segurança é a dimensão mais baixa (51 de 100).",
      pontoForte: "Comportamento é a dimensão mais alta (60 de 100).",
    });
  });

  it("resultado individual da resposta", async () => {
    const sm = servicoDosModelos({
      individualDoModelo: vi.fn(() =>
        Promise.resolve({
          modelo: "isfb" as const,
          respostaId: "r-1",
          nr1: null,
          isfb: {
            isfb: 96,
            faixa: "otima" as const,
            saude: "saudavel" as const,
            dimensoes: {
              seguranca: 96,
              habilidade: 96,
              comportamento: 96,
              liberdade: 94,
            },
            autopercepcao: null,
            baseBaixa: false,
            perfil: "estaveis" as const,
            sinais: [],
            abertura: null,
            produtos: [],
            pontos: {},
            renda: 6,
            isfbDoTime: 53,
            mediaDoBrasil: 56.7,
            dimensoesDoTime: { seguranca: 51 },
          },
        }),
      ),
    });
    render(
      <IndividualDoModeloTela pesquisaId="p-1" respostaId="r-1" servico={sm} />,
    );
    expect(await screen.findByText("Ótima · 83 a 100")).toBeInTheDocument();
    expect(
      screen.getByText(/\+39,3 pontos em relação à média do Brasil/),
    ).toBeInTheDocument();
    expect(screen.getByText("Estáveis")).toBeInTheDocument();
  });
});

describe("planilha", () => {
  const RESPOSTA: RespostaDetalhe = {
    ...RESPOSTA_DETALHE,
    nome: null,
    numero: 2,
    valores: [{ perguntaId: "Q1", valor: 4, mediaTime: null }],
  };

  it("NR-1: abas, resultados por dimensão e respostas numeradas", () => {
    const abas = abasDaPlanilhaNr1({
      detalhe: { ...NR1, secoes: secoesDoModelo(modeloDaGaleria("copsoq")) },
      empresa: "Empresa Sintética",
      resultado: RESULTADO_NR1,
      acompanhamento: {
        ...ACOMPANHAMENTO,
        plano: [
          {
            id: "m1",
            dimensaoId: "burnout",
            titulo: "Pausas",
            descricao: null,
            controle: "protecao",
            responsavel: null,
            prazo: "2027-01-31",
            indicador: null,
            situacao: "planejada",
          },
        ],
      },
      respostas: [RESPOSTA],
    });
    expect(abas.map((a) => a.nome)).toEqual([
      "Resumo",
      "Matriz Psicossocial",
      "Domínios",
      "Destaques",
      "Plano de ação",
      "Metodologia e NR-1",
      "Respostas Individuais",
    ]);
    const linha = abas[0]!.linhas.find(
      (l) => l[1] === "Exigências Quantitativas",
    )!;
    expect(linha[3]).toBe("Risco");
    expect(linha[9]).toBe("Crítico");
    expect(linha[10]).toEqual({ numero: 0.75, formato: "percentual" });
    expect(abas[4]!.linhas[1]).toEqual([
      "Burnout (Esgotamento)",
      "Pausas",
      "",
      "Proteção individual e coletiva",
      "",
      "31/01/2027",
      "",
      "Planejada",
    ]);
    const respostas = abas[6]!;
    expect(respostas.linhas[0]!.slice(0, 3)).toEqual([
      "Resposta",
      "Respondeu em",
      "Q1",
    ]);
    expect(respostas.linhas[1]![0]).toBe("Resposta #2");
    expect(respostas.linhas[1]![2]).toBe(4);
  });

  it("NR-1 confidencial (sem respostas individuais) e oculta", () => {
    const sem = abasDaPlanilhaNr1({
      detalhe: NR1,
      empresa: "",
      resultado: RESULTADO_NR1,
      acompanhamento: null,
      respostas: null,
    });
    expect(sem.map((a) => a.nome)).not.toContain("Respostas Individuais");
    const oculta = abasDaPlanilhaNr1({
      detalhe: NR1,
      empresa: "",
      resultado: { ...RESULTADO_NR1, visivel: false, nr1: null },
      acompanhamento: null,
      respostas: null,
    });
    expect(oculta.map((a) => a.nome)).toEqual(["Resumo"]);
  });

  it("saúde financeira: resumo, pessoas e perguntas", () => {
    const abas = abasDaPlanilhaIsfb({
      detalhe: {
        ...SAUDE_FIN,
        secoes: secoesDoModelo(modeloDaGaleria("isfb")),
      },
      empresa: "Empresa Sintética",
      resultado: RESULTADO_ISFB,
      respostas: [RESPOSTA],
      individuais: [null],
    });
    expect(abas.map((a) => a.nome)).toEqual([
      "Resumo",
      "Pessoas",
      "Perguntas",
      "Abertura a apoio",
    ]);
    expect(abas[0]!.linhas).toContainEqual([
      "Nota do time (0 a 100)",
      53,
      "Baixa",
    ]);
    expect(abas[0]!.linhas).toContainEqual([
      "Média do Brasil (referência nacional, 2024)",
      { numero: 56.7, formato: "decimal" },
    ]);
    // Q1 da resposta: a opção marcada não existe no valor (4) → texto.
    expect(abas[1]!.linhas[1]![0]).toBe("Resposta #2");
    expect(abas[2]!.linhas[1]).toEqual([
      "Q2",
      "Dinheiro não gera estresse em casa",
      { numero: 0.333, formato: "percentual" },
      { numero: 0.667, formato: "percentual" },
      1,
      1,
      0,
      0,
      1,
    ]);
  });
});

describe("escala com o rótulo de cada ponto (resposta pelo link)", () => {
  it("NR-1: número e rótulo; saúde financeira: só os rótulos, em lista", () => {
    const [q1] = secoesDoModelo(modeloDaGaleria("copsoq"))[0]!.perguntas;
    const aoMudar = vi.fn();
    const { unmount } = render(
      <CampoDaPergunta
        pergunta={q1!}
        valor={undefined}
        erro={null}
        aoMudar={aoMudar}
      />,
    );
    const sempre = screen.getByRole("radio", { name: /5\s*Sempre/ });
    fireEvent.click(sempre);
    expect(aoMudar).toHaveBeenCalledWith(5);
    unmount();
    const q2 = secoesDoModelo(modeloDaGaleria("isfb"))[0]!.perguntas[1]!;
    render(
      <CampoDaPergunta
        pergunta={q2}
        valor={undefined}
        erro={null}
        aoMudar={aoMudar}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Nada" }));
    expect(aoMudar).toHaveBeenLastCalledWith(0);
    expect(
      screen.getByRole("radio", { name: "Totalmente" }),
    ).toBeInTheDocument();
  });
});
