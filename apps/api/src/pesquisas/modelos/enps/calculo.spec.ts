import type { Pergunta, Secao } from "../../pesquisas.types";
import {
  errosDaEstruturaDoModelo,
  resultadoDoModelo,
  resultadoIndividualDoModelo,
} from "../indice";
import {
  calcularEnps,
  enpsVisivel,
  grupoDoEnps,
  individualDoEnps,
  notaPrincipalDoEnps,
} from "./calculo";
import { CHAVE_PRINCIPAL_DO_ENPS, COMPLEMENTARES_DO_ENPS } from "./definicao";

/** T216 — eNPS: o índice, os grupos, as complementares e a pessoa. */

function pergunta(
  id: string,
  tipo: Pergunta["tipo"],
  config: Pergunta["config"] = {},
  chave: string | undefined = id,
): Pergunta {
  return {
    id: `id_${id}`,
    ...(chave ? { chave } : {}),
    tipo,
    texto: id,
    rotulo: null,
    descricao: null,
    obrigatoria: true,
    config,
    condicao: null,
  };
}

const ESCALA_0_10 = { minimo: 0, maximo: 10 };

/** A estrutura do modelo: principal, 5 complementares e 2 abertas. */
function estrutura(extra: Pergunta[] = []): Secao[] {
  return [
    {
      id: "s1",
      titulo: null,
      descricao: null,
      perguntas: [
        pergunta(CHAVE_PRINCIPAL_DO_ENPS, "nota_0_10", { enps: true }),
      ],
    },
    {
      id: "s2",
      titulo: null,
      descricao: null,
      perguntas: [
        ...COMPLEMENTARES_DO_ENPS.map((c) =>
          pergunta(c, "escala", ESCALA_0_10),
        ),
        ...extra,
      ],
    },
    {
      id: "s3",
      titulo: null,
      descricao: null,
      perguntas: [
        pergunta("enps_gosta", "paragrafo"),
        pergunta("enps_melhoraria", "paragrafo"),
      ],
    },
  ];
}

/** Uma resposta: a principal e as 5 complementares (na ordem). */
function resposta(principal: number | null, complementares: number[] = []) {
  const m = new Map<string, unknown>();
  if (principal !== null) m.set(`id_${CHAVE_PRINCIPAL_DO_ENPS}`, principal);
  complementares.forEach((v, i) => m.set(`id_${COMPLEMENTARES_DO_ENPS[i]}`, v));
  return { valores: m };
}

// O caso real da revisão: 4 respostas anônimas, principais 10, 7, 3 e 9.
const CASO = [
  resposta(10, [10, 9, 8, 7, 6]),
  resposta(7, [8, 8, 7, 6, 5]),
  resposta(3, [2, 4, 3, 1, 0]),
  resposta(9, [9, 10, 9, 8, 7]),
];

describe("T216 — eNPS", () => {
  it("grupos: 9–10 promotor, 7–8 neutro, 0–6 detrator", () => {
    expect([10, 9, 8, 7, 6, 0].map(grupoDoEnps)).toEqual([
      "promotor",
      "promotor",
      "neutro",
      "neutro",
      "detrator",
      "detrator",
    ]);
  });

  it("caso real: 10, 7, 3, 9 → eNPS 25, zona de aperfeiçoamento", () => {
    const r = calcularEnps(estrutura(), CASO);
    expect(r).toMatchObject({
      modelo: "enps",
      perguntaId: `id_${CHAVE_PRINCIPAL_DO_ENPS}`,
      respostas: 4,
      promotores: 2,
      neutros: 1,
      detratores: 1,
      indice: 25,
      zona: "aperfeicoamento",
    });
    expect(r.distribuicao).toHaveLength(11);
    expect(r.distribuicao.map((d) => d.quantidade)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1,
    ]);
  });

  it("zonas: −1 crítica · 0 e 49 aperfeiçoamento · 50 qualidade · 75 excelência", () => {
    const com = (notas: number[]) =>
      calcularEnps(
        estrutura(),
        notas.map((n) => resposta(n)),
      ).zona;
    expect(com([0, 9, 8])).toBe("aperfeicoamento"); // 0
    expect(com([0, 0, 9])).toBe("critica"); // −33
    expect(com([9, 9, 8, 8])).toBe("qualidade"); // 50
    expect(com([9, 9, 9, 8])).toBe("excelencia"); // 75
    expect(com([10, 8, 8, 8])).toBe("aperfeicoamento"); // 25
  });

  it("complementares: média com uma casa, contagem por grupo, da maior para a menor", () => {
    const r = calcularEnps(estrutura(), CASO);
    expect(r.complementares.map((c) => c.perguntaId)).toEqual([
      "id_enps_ambiente", // 31 / 4 = 7,75 → 7,8
      "id_enps_satisfacao", // 29 / 4 = 7,25 → 7,3
      "id_enps_lideranca", // 27 / 4 = 6,75 → 6,8
      "id_enps_crescimento", // 22 / 4 = 5,5
      "id_enps_reconhecimento", // 18 / 4 = 4,5
    ]);
    expect(r.complementares.map((c) => c.media)).toEqual([
      7.8, 7.3, 6.8, 5.5, 4.5,
    ]);
    const ambiente = r.complementares[0]!;
    expect(ambiente).toMatchObject({
      respostas: 4,
      detratores: 1,
      neutros: 1,
      promotores: 2,
    });
  });

  it("empate na média: a ordem da pesquisa decide", () => {
    const r = calcularEnps(estrutura(), [resposta(9, [5, 5, 5, 5, 5])]);
    expect(r.complementares.map((c) => c.perguntaId)).toEqual(
      COMPLEMENTARES_DO_ENPS.map((c) => `id_${c}`),
    );
  });

  it("peso na nota: correlação com a principal (duas casas); sem variação, null", () => {
    const r = calcularEnps(estrutura(), CASO);
    const peso = new Map(r.complementares.map((c) => [c.perguntaId, c.peso]));
    expect(peso.get("id_enps_satisfacao")).toBeCloseTo(0.98, 2);
    expect(peso.get("id_enps_satisfacao")).toBeLessThanOrEqual(1);
    const constante = calcularEnps(estrutura(), [
      resposta(9, [5, 5, 5, 5, 5]),
      resposta(3, [5, 5, 5, 5, 5]),
      resposta(7, [5, 5, 5, 5, 5]),
    ]);
    expect(constante.complementares[0]!.peso).toBeNull();
    // Menos de 3 pares: null.
    const dois = calcularEnps(estrutura(), CASO.slice(0, 2));
    expect(dois.complementares[0]!.peso).toBeNull();
  });

  it("perguntas novas de 0 a 10 entram nas complementares; texto e 1–5 não", () => {
    const r = calcularEnps(
      estrutura([
        pergunta("extra", "escala", ESCALA_0_10, undefined),
        pergunta("nota", "nota_0_10", {}, undefined),
        pergunta("cinco", "escala", { minimo: 1, maximo: 5 }, undefined),
        pergunta("dez", "escala", { minimo: 1, maximo: 10 }, undefined),
        pergunta("texto", "paragrafo", {}, undefined),
      ]),
      [{ valores: new Map<string, unknown>([["id_extra", 10]]) }],
    );
    const ids = r.complementares.map((c) => c.perguntaId);
    expect(ids).toContain("id_extra");
    expect(ids).toContain("id_nota");
    expect(ids).not.toContain("id_cinco");
    expect(ids).not.toContain("id_dez");
    expect(ids).not.toContain("id_texto");
    expect(r.complementares).toHaveLength(7);
  });

  it("sem notas: índice, zona e médias nulos", () => {
    const r = calcularEnps(estrutura(), [resposta(null)]);
    expect(r).toMatchObject({
      respostas: 0,
      indice: null,
      zona: null,
    });
    expect(r.complementares.every((c) => c.media === null)).toBe(true);
  });

  it("pesquisa antiga sem a chave: a nota marcada como eNPS é a principal", () => {
    const secoes: Secao[] = [
      {
        id: "s",
        titulo: null,
        descricao: null,
        perguntas: [pergunta("rec", "nota_0_10", { enps: true }, undefined)],
      },
    ];
    const r = calcularEnps(secoes, [
      { valores: new Map<string, unknown>([["id_rec", 9]]) },
    ]);
    expect(r).toMatchObject({ perguntaId: "id_rec", indice: 100 });
  });

  it("nota principal da resposta (a lista): nota e grupo, ou null", () => {
    expect(notaPrincipalDoEnps(estrutura(), resposta(7).valores)).toEqual({
      nota: 7,
      grupo: "neutro",
    });
    expect(notaPrincipalDoEnps(estrutura(), resposta(null).valores)).toBeNull();
    expect(
      notaPrincipalDoEnps(
        estrutura(),
        new Map<string, unknown>([[`id_${CHAVE_PRINCIPAL_DO_ENPS}`, 11]]),
      ),
    ).toBeNull();
  });

  it("individual: nota, grupo, eNPS e % de promotores do time e cada complementar × time", () => {
    const r = individualDoEnps(estrutura(), CASO[1]!.valores, CASO)!;
    expect(r).toMatchObject({
      modelo: "enps",
      nota: 7,
      grupo: "neutro",
      enpsTime: 25,
      promotoresTime: 50,
      zonaTime: "aperfeicoamento",
    });
    expect(r.complementares.map((c) => c.perguntaId)).toEqual(
      COMPLEMENTARES_DO_ENPS.map((c) => `id_${c}`),
    );
    // Satisfação: 8 na resposta; time 29 / 4 = 7,25 → 7,3; diferença +0,8.
    expect(r.complementares[0]).toEqual({
      perguntaId: "id_enps_satisfacao",
      nota: 8,
      time: 7.3,
      diferenca: 0.8,
    });
    // Reconhecimento: 5; time 4,5; +0,5.
    expect(r.complementares[4]).toMatchObject({
      nota: 5,
      time: 4.5,
      diferenca: 0.5,
    });
  });

  it("individual: complementar em branco fica sem nota e sem diferença", () => {
    const r = individualDoEnps(estrutura(), resposta(9).valores, CASO)!;
    expect(r.complementares[0]).toMatchObject({
      nota: null,
      time: 7.3,
      diferenca: null,
    });
  });

  it("individual: diferença negativa com uma casa", () => {
    const r = individualDoEnps(estrutura(), CASO[2]!.valores, CASO)!;
    // Satisfação: 2 − 7,25 = −5,25 → −5,3 (calculada com a média exata).
    expect(r.complementares[0]).toMatchObject({ nota: 2, diferenca: -5.3 });
  });

  it("evolução: o eNPS de cada pesquisa; confidencial abaixo do mínimo, null", () => {
    const brutas = CASO.map((r) =>
      [...r.valores].map(([perguntaId, valor]) => ({ perguntaId, valor })),
    );
    expect(enpsVisivel(estrutura(), brutas, 3, false)).toBe(25);
    expect(enpsVisivel(estrutura(), brutas, 3, true)).toBe(25);
    expect(enpsVisivel(estrutura(), brutas, 5, true)).toBeNull();
    expect(enpsVisivel(estrutura(), brutas, 5, false)).toBe(25);
    expect(enpsVisivel(estrutura(), [], 3, false)).toBeNull();
  });

  it("registro: agregado e individual pelo índice dos modelos", () => {
    expect(resultadoDoModelo("enps", estrutura(), CASO)).toMatchObject({
      modelo: "enps",
      indice: 25,
    });
    expect(
      resultadoIndividualDoModelo("enps", estrutura(), CASO[0]!.valores, CASO),
    ).toMatchObject({ modelo: "enps", nota: 10, grupo: "promotor" });
  });

  it("estrutura: a principal é obrigatória e única; o resto é livre", () => {
    expect(errosDaEstruturaDoModelo("enps", estrutura())).toEqual([]);
    // Pode remover complementares e somar outras perguntas.
    const livre = estrutura([pergunta("extra", "paragrafo", {}, undefined)]);
    livre[1]!.perguntas.splice(0, 3);
    expect(errosDaEstruturaDoModelo("enps", livre)).toEqual([]);
    const recusa = [{ campo: "secoes", motivo: "estrutura_do_modelo" }];
    // Sem a principal.
    const sem = estrutura();
    sem[0]!.perguntas = [];
    expect(errosDaEstruturaDoModelo("enps", sem)).toEqual(recusa);
    // A principal sem a marca de eNPS.
    const semMarca = estrutura();
    semMarca[0]!.perguntas[0]!.config = { enps: false };
    expect(errosDaEstruturaDoModelo("enps", semMarca)).toEqual(recusa);
    // Outra nota de eNPS além da principal.
    expect(
      errosDaEstruturaDoModelo(
        "enps",
        estrutura([pergunta("outra", "nota_0_10", { enps: true }, undefined)]),
      ),
    ).toEqual(recusa);
    // Principal repetida.
    const repetida = estrutura();
    repetida[1]!.perguntas.push({
      ...repetida[0]!.perguntas[0]!,
      id: "id_dupla",
    });
    expect(errosDaEstruturaDoModelo("enps", repetida)).toEqual(recusa);
  });
});
