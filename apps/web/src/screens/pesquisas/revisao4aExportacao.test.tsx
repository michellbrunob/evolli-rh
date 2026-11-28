/**
 * T216 — 4ª revisão, exportação geral (Pulso e Personalizada): o índice
 * "Abas desta planilha" no Resumo, as abas Evolução, Preenchimento e
 * Participação, os cabeçalhos dos Participantes com o texto inteiro da
 * pergunta, a contagem do grupo oculto, quem emitiu sem nome de exibição e o
 * nome da empresa no lugar do marcador. Dados sintéticos.
 */
import { describe, expect, it, vi } from "vitest";
import type {
  AnalisesPesquisa,
  ParticipanteDaPesquisa,
  Pergunta,
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadosPesquisa,
} from "../../api/pesquisasClient";
import { lerAbasXlsx } from "../pessoas/importacao/planilhaXlsx";
import { carregarRelatorio } from "./carregarRelatorio";
import {
  DETALHE,
  RESPOSTA_DETALHE,
  RESPOSTAS,
  servicoFalso,
} from "./dadosDeTeste";
import { montarRelatorio } from "./dadosDoRelatorio";
import { planilhaDosResultados } from "./exportarResultados";
import { quemEmiteDaConta } from "./servicoDePesquisas";

const HOJE = "2026-11-27";

const pergunta = (
  id: string,
  tipo: Pergunta["tipo"],
  texto: string,
  extra: Partial<Pergunta> = {},
): Pergunta => ({
  id,
  tipo,
  texto,
  descricao: null,
  obrigatoria: true,
  config: {},
  condicao: null,
  ...extra,
});

const escala10 = { minimo: 1, maximo: 10 };

const PULSO: PesquisaDetalhe = {
  ...DETALHE,
  id: "p-pulso",
  nome: "Pulso sintético",
  modelo: "pulso",
  identificacao: "anonima",
  participantes: null,
  respostas: 4,
  separarPor: ["departamento"],
  secoes: [
    {
      id: "s-1",
      titulo: null,
      descricao: null,
      perguntas: [
        pergunta("q1", "escala", "Eu me vejo na {empresa} daqui a um ano.", {
          rotulo: "Permanência",
          config: escala10,
        }),
        pergunta("q2", "escala", "Sei o que esperam do meu trabalho.", {
          rotulo: "Clareza",
          config: escala10,
        }),
        pergunta(
          "q-enps",
          "nota_0_10",
          "Indicaria a {empresa} para trabalhar?",
          {
            rotulo: "eNPS",
            config: { enps: true },
          },
        ),
        pergunta("q-com", "texto_curto", "Quer deixar um comentário?", {
          obrigatoria: false,
        }),
      ],
    },
  ],
};

const GERAL: ResultadosPesquisa = {
  pesquisaId: "p-pulso",
  respostas: 4,
  participantes: 0,
  departamentos: [],
  recortes: ["departamento"],
  filtro: { departamentoId: null, visivel: true },
  perguntas: [
    {
      perguntaId: "q1",
      tipo: "escala",
      respondidas: 4,
      viram: 4,
      media: 7,
      distribuicao: [
        { valor: 6, quantidade: 2 },
        { valor: 8, quantidade: 2 },
      ],
    },
    {
      perguntaId: "q2",
      tipo: "escala",
      respondidas: 4,
      viram: 4,
      media: 8,
      distribuicao: [{ valor: 8, quantidade: 4 }],
    },
    {
      perguntaId: "q-enps",
      tipo: "nota_0_10",
      respondidas: 4,
      viram: 4,
      enps: { promotores: 2, neutros: 0, detratores: 2, indice: 0 },
      media: 6.5,
      distribuicao: [
        { valor: 3, quantidade: 2 },
        { valor: 10, quantidade: 2 },
      ],
    },
  ],
};

const ANALISES: AnalisesPesquisa = {
  campo: "departamento",
  colunas: [
    { perguntaId: "q1", rotulo: "Permanência" },
    { perguntaId: "q2", rotulo: "Clareza" },
  ],
  linhas: [
    {
      grupoId: null,
      nome: "Toda a empresa",
      respostas: 4,
      visivel: true,
      media: 7.5,
      medias: [7, 8],
    },
    {
      grupoId: "d-1",
      nome: "Comercial (C1)",
      respostas: 3,
      visivel: false,
      oculto: "protege_grupo_menor",
      media: null,
      medias: [null, null],
    },
    {
      grupoId: "d-2",
      nome: "Comercial (C2)",
      respostas: 1,
      visivel: false,
      oculto: "minimo",
      media: null,
      medias: [null, null],
    },
  ],
  evolucao: [
    {
      pesquisaId: "p-antigo",
      nome: "Pulso de outubro",
      publicadaEm: "2026-10-02T13:00:00Z",
      mediaGeral: 6.8,
      enps: -10,
    },
    {
      pesquisaId: "p-sem-enps",
      nome: "Pulso de setembro",
      publicadaEm: "2026-09-02T13:00:00Z",
      mediaGeral: 7.1,
    },
    {
      pesquisaId: "p-pulso",
      nome: "Pulso sintético",
      publicadaEm: "2026-11-03T13:00:00Z",
      mediaGeral: 7.5,
      enps: 0,
    },
  ],
};

const rel = (
  detalhe: PesquisaDetalhe = PULSO,
  extra: Partial<Parameters<typeof montarRelatorio>[0]> = {},
) =>
  montarRelatorio({
    detalhe,
    geral: GERAL,
    empresa: "Empresa Alfa",
    hoje: HOJE,
    respostas: RESPOSTAS,
    analises: ANALISES,
    emitidoPor: "Pessoa Emissora",
    ...extra,
  });

const individual = (n: number): RespostaDetalhe => ({
  ...RESPOSTA_DETALHE,
  id: `r-${n}`,
  numero: n,
  nome: null,
  colaboradorId: null,
  departamento: null,
  valores: [
    { perguntaId: "q1", valor: 6 + n, mediaTime: null },
    { perguntaId: "q-enps", valor: 9, mediaTime: null },
  ],
});

const abas = (
  detalhe: PesquisaDetalhe = PULSO,
  respostas: RespostaDetalhe[] | null = [individual(1), individual(2)],
) =>
  lerAbasXlsx(planilhaDosResultados(rel(detalhe), detalhe, GERAL, respostas));

const participante = (
  nome: string,
  departamento: string | null,
  respondeu: boolean,
  centroCusto: string | null = null,
  unidade: string | null = null,
): ParticipanteDaPesquisa => ({
  colaboradorId: `c-${nome}`,
  nome,
  departamento,
  centroCusto,
  unidade,
  respondeu,
  identificavel: true,
});

const IDENTIFICADA: PesquisaDetalhe = {
  ...PULSO,
  identificacao: "identificada",
  participantes: 5,
  separarPor: [],
  participantesLista: [
    participante("Ana", "Comercial (C1)", true, "Vendas", "Matriz"),
    participante("Bruno", "Comercial (C1)", false, "Vendas", "Matriz"),
    participante("Carla", "Comercial (C2)", true, null, "Filial"),
    participante("Davi", "Comercial (C2)", true, null, "Filial"),
    participante("Eva", null, false),
  ],
};

describe("R4-A-05 — Resumo com o índice das abas", () => {
  it("'Abas desta planilha' lista as abas que existem, na ordem, com o que cada uma traz", async () => {
    const planilha = await abas();
    const nomes = Object.keys(planilha);
    const resumo = planilha["Resumo"]!;
    const i = resumo.findIndex((l) => l[0] === "Abas desta planilha");
    expect(i).toBeGreaterThan(0);
    const indice = resumo.slice(i + 1).filter((l) => l[0]);
    expect(indice.map((l) => l[0])).toEqual(nomes.slice(1));
    expect(indice.every((l) => (l[1] ?? "").length > 10)).toBe(true);
    expect(nomes).not.toContain("Análise por IA");
  });
});

describe("R4-A-05 — aba Evolução", () => {
  it("média e eNPS das pesquisas anteriores do modelo (o mesmo dado das Análises)", async () => {
    const evolucao = (await abas())["Evolução"]!;
    expect(evolucao[0]![0]).toBe("Evolução");
    expect(evolucao[3]).toEqual([
      "Pesquisa",
      "Publicada em",
      "Média geral (1 a 10)",
      "eNPS",
    ]);
    expect(evolucao.slice(4, 7).map((l) => [l[0], l[2], l[3]])).toEqual([
      ["Pulso de outubro", "6.8", "-10"],
      ["Pulso de setembro", "7.1", "—"],
      ["Pulso sintético", "7.5", "0"],
    ]);
  });

  it("primeira pesquisa do modelo: diz que a evolução vem a partir da próxima", async () => {
    const so = lerAbasXlsx(
      planilhaDosResultados(
        rel(PULSO, {
          analises: { ...ANALISES, evolucao: [ANALISES.evolucao[2]!] },
        }),
        PULSO,
        GERAL,
        null,
      ),
    );
    const evolucao = (await so)["Evolução"]!;
    expect(JSON.stringify(evolucao)).toContain(
      "Esta é a primeira pesquisa Pulso com respostas: a evolução aparece a partir da próxima.",
    );
  });
});

describe("R4-A-05 — Preenchimento e Participação (só presença)", () => {
  it("identificada: convidados, respostas, % e ação por grupo, com o total", async () => {
    const planilha = await abas(IDENTIFICADA);
    const preenchimento = planilha["Preenchimento"]!;
    const cabecalho = preenchimento.findIndex((l) => l[0] === "Departamento");
    expect(preenchimento[cabecalho]).toEqual([
      "Departamento",
      "Convidados",
      "Responderam",
      "Faltam",
      "Preenchimento",
      "Ação",
    ]);
    expect(preenchimento.slice(cabecalho + 1, cabecalho + 5)).toEqual([
      ["Toda a empresa", "5", "3", "2", "0.6", "ok"],
      ["Comercial (C1)", "2", "1", "1", "0.5", "ok"],
      ["Comercial (C2)", "2", "2", "0", "1", "ok"],
      ["Sem departamento", "1", "0", "1", "0", "cobrar"],
    ]);
    // Também por centro de custo e por unidade, quando o cadastro tem.
    expect(preenchimento.some((l) => l[0] === "Centro de custo")).toBe(true);
    expect(preenchimento.some((l) => l[0] === "Unidade")).toBe(true);
    // Só presença: nenhuma nota.
    expect(JSON.stringify(preenchimento)).not.toContain("Média");
  });

  it("participação: por combinação de grupos e por pessoa", async () => {
    const participacao = (await abas(IDENTIFICADA))["Participação"]!;
    const combinacao = participacao.findIndex(
      (l) => l[0] === "Departamento" && l[1] === "Centro de custo",
    );
    expect(participacao[combinacao]).toEqual([
      "Departamento",
      "Centro de custo",
      "Unidade",
      "Convidados",
      "Responderam",
      "Preenchimento",
    ]);
    expect(participacao[combinacao + 1]).toEqual([
      "Comercial (C1)",
      "Vendas",
      "Matriz",
      "2",
      "1",
      "0.5",
    ]);
    const pessoas = participacao.findIndex((l) => l[0] === "Nome");
    expect(participacao[pessoas]).toEqual([
      "Nome",
      "Departamento",
      "Centro de custo",
      "Unidade",
      "Respondeu",
    ]);
    expect(participacao.slice(pessoas + 1, pessoas + 3)).toEqual([
      ["Ana", "Comercial (C1)", "Vendas", "Matriz", "Sim"],
      ["Bruno", "Comercial (C1)", "Vendas", "Matriz", "Não"],
    ]);
  });

  it("confidencial: a presença por pessoa, nunca a nota", async () => {
    const participacao = (
      await abas({ ...IDENTIFICADA, identificacao: "confidencial" }, null)
    )["Participação"]!;
    expect(JSON.stringify(participacao)).toContain('"Ana"');
    expect(JSON.stringify(participacao)).not.toMatch(/Média|eNPS|favorável/i);
  });

  it("anônima: sem convidados, sem as duas abas", async () => {
    // Mesmo que uma lista chegue, a anônima não mostra quem respondeu.
    const nomes = Object.keys(
      await abas({
        ...PULSO,
        participantesLista: IDENTIFICADA.participantesLista,
      }),
    );
    expect(nomes).not.toContain("Preenchimento");
    expect(nomes).not.toContain("Participação");
  });
});

describe("R4-A-06 — Participantes com o texto inteiro da pergunta", () => {
  it("'1. <texto>' nas perguntas, 'eNPS · <texto>' na recomendação", async () => {
    const participantes = (await abas())["Participantes"]!;
    const cabecalho = participantes[3]!;
    expect(cabecalho).toContain(
      "1. Eu me vejo na Empresa Alfa daqui a um ano.",
    );
    expect(cabecalho).toContain("2. Sei o que esperam do meu trabalho.");
    expect(cabecalho).toContain(
      "eNPS · Indicaria a Empresa Alfa para trabalhar?",
    );
    expect(cabecalho).toContain("3. Quer deixar um comentário?");
    expect(cabecalho).toContain("Média (1 a 10)");
    expect(cabecalho.join("|")).not.toContain("Permanência");
  });
});

describe("R3-A-26 e R4-A-02 — grupos na planilha", () => {
  it("o grupo oculto para proteger um menor mostra a contagem; nomes repetidos com o código", async () => {
    const planilha = await abas();
    const porGrupo = planilha["Por departamento"]!;
    expect(
      porGrupo.find((l) => l[0] === "Comercial (C1)")!.slice(0, 3),
    ).toEqual(["Comercial (C1)", "3", "Oculto · protege um grupo menor"]);
    const enps = planilha["eNPS"]!;
    expect(enps.find((l) => l[0] === "Comercial (C1)")![1]).toBe("3");
  });
});

describe("R3-A-21 — quem emitiu sem nome de exibição", () => {
  it("usa o outro identificador da conta; com nome, nunca o e-mail", () => {
    expect(
      quemEmiteDaConta({ nomeExibicao: "Ana Lima", email: "ana@exemplo.test" }),
    ).toBe("Ana Lima");
    expect(
      quemEmiteDaConta({ nomeExibicao: "  ", email: "ana@exemplo.test" }),
    ).toBe("ana@exemplo.test");
    expect(quemEmiteDaConta({ nomeExibicao: null, email: null })).toBeNull();
  });
});

describe("R4-A-12 — planilha e PDF com o nome da empresa", () => {
  it("carregarRelatorio troca o marcador pelo nome da empresa ativa", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() => Promise.resolve(PULSO)),
      resultadosDaPesquisa: vi.fn(() => Promise.resolve(GERAL)),
      analisesDaPesquisa: vi.fn(() => Promise.resolve(ANALISES)),
    });
    const { detalhe } = await carregarRelatorio(servico, "p-pulso", HOJE);
    const textos = detalhe.secoes.flatMap((s) =>
      s.perguntas.map((p) => p.texto),
    );
    expect(textos).toContain("Eu me vejo na Empresa Alfa daqui a um ano.");
    expect(JSON.stringify(detalhe)).not.toContain("{empresa}");
  });
});
