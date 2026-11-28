import { conferirSecoes } from "../../estrutura-pesquisa";
import { montarResultados } from "../../calculo-resultados";
import type { Pergunta } from "../../pesquisas.types";
import { conferirRespostas } from "../../validacao-respostas";
import {
  conferirConfigDoBloco,
  conferirEstruturaDisc,
  conferirValorDoBloco,
} from "./regras-disc";

/** T216 — DISC: o bloco de escolha forçada e a estrutura do modelo. */

const frases = (prefixo = "x") =>
  (["D", "I", "S", "C"] as const).map((fator) => ({
    id: `${prefixo}-${fator}`,
    texto: `Frase ${fator}`,
    fator,
  }));

const bloco = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  tipo: "escolha_forcada",
  texto: "Qual frase combina mais com você?",
  rotulo: null,
  descricao: null,
  obrigatoria: true,
  config: { opcoes: frases(id) },
  condicao: null,
  ...extra,
});

const secoesDe = (perguntas: unknown[]) => [
  { id: "s", titulo: null, descricao: null, perguntas },
];

const vinteOito = (): Record<string, unknown>[] =>
  Array.from({ length: 28 }, (_, i) => bloco(`b${i + 1}`));

describe("T216 — DISC: configuração do bloco", () => {
  it("aceita 4 frases, uma por fator; apara o texto e descarta o resto", () => {
    const opcoes = frases();
    opcoes[0] = { ...opcoes[0]!, texto: "  Decido rápido  " };
    expect(
      conferirConfigDoBloco({
        opcoes: opcoes.map((o) => ({ ...o, lixo: 1 })),
        outro: true,
      }),
    ).toEqual({
      opcoes: [
        { id: "x-D", texto: "Decido rápido", fator: "D" },
        { id: "x-I", texto: "Frase I", fator: "I" },
        { id: "x-S", texto: "Frase S", fator: "S" },
        { id: "x-C", texto: "Frase C", fator: "C" },
      ],
    });
  });

  it("recusa quantidade, fator repetido ou ausente, id e texto inválidos", () => {
    const base = frases();
    const casos: unknown[] = [
      undefined,
      {},
      { opcoes: base.slice(0, 3) },
      { opcoes: [...base, { id: "e", texto: "E", fator: "D" }] },
      { opcoes: [base[0], base[1], base[2], { ...base[3], fator: "D" }] },
      { opcoes: [base[0], base[1], base[2], { ...base[3], fator: "X" }] },
      { opcoes: [base[0], base[1], base[2], { id: "x-C", texto: "C" }] },
      { opcoes: [base[0], base[1], base[2], { ...base[3], id: "x-D" }] },
      { opcoes: [base[0], base[1], base[2], { ...base[3], id: "com espaço" }] },
      { opcoes: [base[0], base[1], base[2], { ...base[3], texto: "   " }] },
      {
        opcoes: [
          base[0],
          base[1],
          base[2],
          { ...base[3], texto: "a".repeat(201) },
        ],
      },
      { opcoes: [base[0], base[1], base[2], "C"] },
    ];
    for (const c of casos) expect(conferirConfigDoBloco(c)).toBeNull();
  });

  it("fator repetido é recusado, mesmo com 4 frases", () => {
    const base = frases();
    expect(
      conferirConfigDoBloco({
        opcoes: [base[0], base[1], { ...base[2], fator: "I" }, base[3]],
      }),
    ).toBeNull();
  });

  it("na estrutura comum: bloco com dois D é inválido", () => {
    const opcoes = frases("b1");
    opcoes[1] = { ...opcoes[1]!, fator: "D" };
    expect(
      conferirSecoes(secoesDe([bloco("b1", { config: { opcoes } })])).erros,
    ).toEqual([{ campo: "b1", motivo: "invalido" }]);
  });

  it("na estrutura comum: o bloco vale e não abre condição", () => {
    const ok = conferirSecoes(secoesDe([bloco("b1")]));
    expect(ok.erros).toEqual([]);
    expect(ok.secoes[0]!.perguntas[0]!.config.opcoes).toHaveLength(4);
    const ruim = conferirSecoes(
      secoesDe([bloco("b1", { config: { opcoes: frases().slice(0, 2) } })]),
    );
    expect(ruim.erros).toEqual([{ campo: "b1", motivo: "invalido" }]);
    const condicao = conferirSecoes(
      secoesDe([
        bloco("b1"),
        {
          id: "t",
          tipo: "texto_curto",
          texto: "Por quê?",
          obrigatoria: false,
          config: {},
          condicao: { perguntaId: "b1", opcaoId: "b1-D" },
        },
      ]),
    );
    expect(condicao.erros).toEqual([{ campo: "t", motivo: "invalido" }]);
  });
});

describe("T216 — DISC: resposta do bloco", () => {
  const p = conferirSecoes(secoesDe([bloco("b1")])).secoes[0]!
    .perguntas[0] as Pergunta;

  it("aceita { opcao } de uma das frases", () => {
    expect(conferirValorDoBloco(p, { opcao: "b1-S" })).toEqual({
      ok: true,
      valor: { opcao: "b1-S" },
    });
  });

  it("recusa frase de fora, chave a mais, texto solto e vazio", () => {
    for (const v of [
      { opcao: "b2-S" },
      { opcao: "b1-S", outro: "x" },
      { opcoes: ["b1-S"] },
      "b1-S",
      { opcao: 1 },
      null,
      [],
    ]) {
      expect(conferirValorDoBloco(p, v)).toEqual({ ok: false });
    }
  });

  it("na conferência do envio: obrigatório e inválido por pergunta", () => {
    const secoes = conferirSecoes(secoesDe([bloco("b1"), bloco("b2")])).secoes;
    expect(
      conferirRespostas(secoes, [
        { perguntaId: "b1", valor: { opcao: "b1-I" } },
        { perguntaId: "b2", valor: { opcao: "b2-C" } },
      ]),
    ).toEqual({
      valores: [
        { perguntaId: "b1", valor: { opcao: "b1-I" } },
        { perguntaId: "b2", valor: { opcao: "b2-C" } },
      ],
      erros: [],
    });
    expect(
      conferirRespostas(secoes, [
        { perguntaId: "b1", valor: { opcao: "b2-I" } },
      ]).erros,
    ).toEqual([
      { campo: "b1", motivo: "invalido" },
      { campo: "b2", motivo: "obrigatorio" },
    ]);
  });

  it("nos resultados comuns: a contagem de cada frase", () => {
    const secoes = conferirSecoes(secoesDe([bloco("b1")])).secoes;
    const r = montarResultados({
      pesquisaId: "p",
      secoes,
      respostas: ["b1-D", "b1-D", "b1-C"].map((opcao) => ({
        valores: [{ perguntaId: "b1", valor: { opcao } }],
        autor: null,
        grupos: {},
      })),
      participantes: null,
      nomesDosGrupos: new Map(),
      minimoPorGrupo: 3,
      filtro: null,
      recortes: [],
      identificada: false,
      minimoNaVisaoGeral: false,
    });
    expect(r.perguntas[0]).toMatchObject({
      tipo: "escolha_forcada",
      respondidas: 3,
      opcoes: [
        { opcaoId: "b1-D", quantidade: 2 },
        { opcaoId: "b1-I", quantidade: 0 },
        { opcaoId: "b1-S", quantidade: 0 },
        { opcaoId: "b1-C", quantidade: 1 },
      ],
    });
  });
});

describe("T216 — DISC: estrutura do modelo", () => {
  const conferida = (perguntas: unknown[]) =>
    conferirSecoes(secoesDe(perguntas)).secoes;

  it("disc: exatamente 28 blocos obrigatórios, sem condição", () => {
    expect(conferirEstruturaDisc("disc", conferida(vinteOito()))).toEqual([]);
    expect(
      conferirEstruturaDisc("disc", conferida(vinteOito().slice(1))),
    ).toEqual([{ campo: "secoes", motivo: "limite" }]);
    expect(
      conferirEstruturaDisc("disc", conferida([...vinteOito(), bloco("b29")])),
    ).toEqual([{ campo: "secoes", motivo: "limite" }]);
  });

  it("disc: pergunta de outro tipo ou opcional é inválida", () => {
    const perguntas = vinteOito();
    perguntas[3] = bloco("b4", { obrigatoria: false });
    perguntas[27] = {
      ...bloco("b28"),
      tipo: "texto_curto",
      config: {},
    };
    expect(conferirEstruturaDisc("disc", conferida(perguntas))).toEqual([
      { campo: "b4", motivo: "invalido" },
      { campo: "b28", motivo: "invalido" },
    ]);
  });

  it("disc: bloco com condição é inválido", () => {
    const secoes = conferida(vinteOito());
    secoes[0]!.perguntas[5] = {
      ...secoes[0]!.perguntas[5]!,
      condicao: { perguntaId: "b1", opcaoId: "b1-D" },
    };
    expect(conferirEstruturaDisc("disc", secoes)).toEqual([
      { campo: "b6", motivo: "invalido" },
    ]);
  });

  it("outros modelos não aceitam o bloco", () => {
    expect(
      conferirEstruturaDisc("personalizada", conferida([bloco("b1")])),
    ).toEqual([{ campo: "b1", motivo: "nao_se_aplica" }]);
    expect(
      conferirEstruturaDisc(
        "pulso",
        conferida([{ ...bloco("t"), tipo: "texto_curto", config: {} }]),
      ),
    ).toEqual([]);
  });
});
