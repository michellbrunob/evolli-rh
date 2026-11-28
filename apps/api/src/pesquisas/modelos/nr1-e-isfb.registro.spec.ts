import type { Pergunta, Secao } from "../pesquisas.types";
import { respostaPorChave } from "./chaves";
import { ITENS_NR1, ROTULOS_DA_ESCALA } from "./copsoq/definicao";
import {
  errosDaEstruturaDoModelo,
  resultadoDoModelo,
  resultadoIndividualDoModelo,
} from "./indice";
import {
  OPCOES_Q1,
  OPCOES_Q14,
  OPCOES_Q15,
  PRODUTOS,
  ROTULOS_DA_CONCORDANCIA,
  ROTULOS_DA_FREQUENCIA,
} from "./isfb/definicao";

/**
 * T216 — NR-1 e saúde financeira pelo registro: estrutura conferida pela
 * chave, ids gerados pela tela (perguntas e opções) e as opções valendo
 * pela posição.
 */

const pergunta = (
  chave: string,
  tipo: Pergunta["tipo"],
  config: Pergunta["config"],
  obrigatoria = true,
): Pergunta => ({
  id: `id-${chave}`,
  chave,
  tipo,
  texto: chave,
  rotulo: null,
  descricao: null,
  obrigatoria,
  config,
  condicao: null,
});

function secoesNr1(): Secao[] {
  return [
    {
      id: "s1",
      titulo: null,
      descricao: null,
      perguntas: ITENS_NR1.map((i) =>
        pergunta(i.id, "escala", {
          minimo: 1,
          maximo: 5,
          rotulos: [...ROTULOS_DA_ESCALA[i.escala]],
        }),
      ),
    },
  ];
}

const opcoesGeradas = (chave: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${chave}-g${i}`,
    texto: `${i}`,
  }));

function secoesIsfb(comAuto = true): Secao[] {
  const escala = (c: string, rotulos: readonly string[], obrig = true) =>
    pergunta(
      c,
      "escala",
      { minimo: 0, maximo: 4, rotulos: [...rotulos] },
      obrig,
    );
  const perguntas: Pergunta[] = [
    pergunta("Q1", "escolha_unica", {
      opcoes: opcoesGeradas("Q1", OPCOES_Q1.length),
      outro: false,
    }),
    ...[
      "Q2",
      "Q3",
      "Q4",
      "Q5",
      "Q6",
      "Q7",
      "Q8",
      "Q9",
      "Q10",
      "Q11",
      "Q12",
    ].map((c) => escala(c, ROTULOS_DA_CONCORDANCIA)),
    pergunta(
      "Q13",
      "multipla_escolha",
      { opcoes: opcoesGeradas("Q13", PRODUTOS.length), outro: false },
      false,
    ),
    pergunta("Q14", "escolha_unica", {
      opcoes: opcoesGeradas("Q14", OPCOES_Q14.length),
      outro: false,
    }),
    pergunta("Q15", "escolha_unica", {
      opcoes: opcoesGeradas("Q15", OPCOES_Q15.length),
      outro: false,
    }),
    ...(comAuto
      ? ["O1", "O2", "O3"].map((c) => escala(c, ROTULOS_DA_FREQUENCIA, false))
      : []),
  ];
  return [{ id: "s1", titulo: null, descricao: null, perguntas }];
}

const recusa = [{ campo: "secoes", motivo: "estrutura_do_modelo" }];

describe("estrutura conferida pela chave", () => {
  it("NR-1: as 76 escalas de 1 a 5 com os rótulos, todas obrigatórias", () => {
    expect(errosDaEstruturaDoModelo("copsoq", secoesNr1())).toEqual([]);
    const falta = secoesNr1();
    falta[0]!.perguntas.pop();
    expect(errosDaEstruturaDoModelo("copsoq", falta)).toEqual(recusa);
    const opcional = secoesNr1();
    opcional[0]!.perguntas[0]!.obrigatoria = false;
    expect(errosDaEstruturaDoModelo("copsoq", opcional)).toEqual(recusa);
    const semRotulos = secoesNr1();
    semRotulos[0]!.perguntas[3]!.config = { minimo: 1, maximo: 5 };
    expect(errosDaEstruturaDoModelo("copsoq", semRotulos)).toEqual(recusa);
  });

  it("saúde financeira: a autopercepção pode sair; as opções contam", () => {
    expect(errosDaEstruturaDoModelo("isfb", secoesIsfb())).toEqual([]);
    expect(errosDaEstruturaDoModelo("isfb", secoesIsfb(false))).toEqual([]);
    const menos = secoesIsfb();
    menos[0]!.perguntas[13]!.config = {
      opcoes: opcoesGeradas("Q14", 6),
      outro: false,
    };
    expect(errosDaEstruturaDoModelo("isfb", menos)).toEqual(recusa);
  });
});

describe("opções pela posição", () => {
  it("converte ids gerados nos ids do modelo; ignora perguntas sem chave", () => {
    const secoes = secoesIsfb();
    const v = respostaPorChave(
      secoes,
      new Map<string, unknown>([
        ["id-Q14", { opcao: "Q14-g6" }],
        ["id-Q13", { opcoes: ["Q13-g3", "Q13-g6", "inexistente"] }],
        ["id-Q2", 1],
        ["livre", "texto"],
      ]),
      { Q13: PRODUTOS, Q14: OPCOES_Q14 },
    );
    expect(v).toEqual([
      { perguntaId: "Q2", valor: 1 },
      { perguntaId: "Q13", valor: { opcoes: ["poupanca", "investimentos"] } },
      { perguntaId: "Q14", valor: { opcao: "renda_7" } },
    ]);
  });
});

describe("resultado pelo registro", () => {
  const respostaNr1 = (
    padrao: number,
    ajustes: Record<string, number> = {},
  ) => ({
    valores: new Map<string, unknown>(
      ITENS_NR1.map((i) => [`id-${i.id}`, ajustes[i.id] ?? padrao]),
    ),
  });

  it("NR-1: agregado com sigilo e o individual comparado com o time", () => {
    const respostas = [
      respostaNr1(3, { Q1: 5, Q2: 5, Q3: 5, Q73: 2 }),
      respostaNr1(3, { Q1: 5, Q2: 5, Q3: 5 }),
      respostaNr1(3),
    ];
    const r = resultadoDoModelo("copsoq", secoesNr1(), respostas, {
      sigilo: 3,
      minimoPorGrupo: 3,
    });
    if (r?.modelo !== "copsoq") throw new Error("sem resultado");
    expect(r.respostas).toBe(3);
    expect(r.dimensoes[0]).toMatchObject({
      id: "exigencias_quantitativas",
      escore: 4.33,
      nivel: "critico",
    });
    expect(r.ofensivos.tipos[0]!.raramente).toBeNull();
    expect(r.pressao).not.toBeNull();
    const semSigilo = resultadoDoModelo("copsoq", secoesNr1(), respostas, {
      sigilo: null,
      minimoPorGrupo: 3,
    });
    if (semSigilo?.modelo !== "copsoq") throw new Error("sem resultado");
    expect(semSigilo.ofensivos.tipos[0]!.raramente).toBe(1);
    const ind = resultadoIndividualDoModelo(
      "copsoq",
      secoesNr1(),
      respostas[2]!.valores,
      respostas,
    );
    if (ind?.modelo !== "copsoq") throw new Error("sem individual");
    expect(ind.dimensoes[0]).toMatchObject({
      escore: 3,
      escoreDoTime: 4.33,
      comparacao: "abaixo",
    });
  });

  it("saúde financeira: nota pela posição das opções e o time", () => {
    const valores = new Map<string, unknown>([
      ["id-Q1", { opcao: "Q1-g2" }],
      ...[
        "Q2",
        "Q3",
        "Q4",
        "Q5",
        "Q6",
        "Q7",
        "Q8",
        "Q9",
        "Q10",
        "Q11",
        "Q12",
      ].map((c) => [`id-${c}`, 2] as [string, unknown]),
      ["id-Q13", { opcoes: ["Q13-g0", "Q13-g1", "Q13-g3"] }],
      ["id-Q14", { opcao: "Q14-g2" }],
      ["id-Q15", { opcao: "Q15-g3" }],
      ["id-O1", 3],
      ["id-O2", 3],
      ["id-O3", 3],
    ]);
    const r = resultadoDoModelo("isfb", secoesIsfb(), [{ valores }], {
      sigilo: 3,
      minimoPorGrupo: 3,
    });
    if (r?.modelo !== "isfb") throw new Error("sem resultado");
    expect(r.isfb).toBe(56);
    expect(r.mediaDoBrasil).toBe(56.7);
    expect(r.produtos.poupanca.quantidade).toBe(1);
    const ind = resultadoIndividualDoModelo("isfb", secoesIsfb(), valores, [
      { valores },
    ]);
    if (ind?.modelo !== "isfb") throw new Error("sem individual");
    expect(ind).toMatchObject({
      isfb: 56,
      autopercepcao: 80,
      isfbDoTime: 56,
      perfil: "estaveis",
    });
    expect(
      resultadoIndividualDoModelo("isfb", secoesIsfb(), new Map(), []),
    ).toBeNull();
  });
});
