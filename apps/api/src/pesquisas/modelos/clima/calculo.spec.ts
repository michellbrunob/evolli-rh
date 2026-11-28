import type { Pergunta, Secao } from "../../pesquisas.types";
import { errosDaEstruturaDoModelo, resumoDaRespostaDoModelo } from "../indice";
import {
  calcularClima,
  faixaDoClima,
  individualDoClima,
  resumoDaRespostaDoClima,
} from "./calculo";
import { ABERTAS_CLIMA, AFIRMACOES_CLIMA, DIMENSOES_CLIMA } from "./definicao";

/** T216 — Pesquisa de Clima: 5 dimensões × 3 subdimensões × 4 afirmações. */

function pergunta(chave: string, tipo: Pergunta["tipo"]): Pergunta {
  return {
    id: `id_${chave}`,
    chave,
    tipo,
    texto: chave,
    rotulo: null,
    descricao: null,
    obrigatoria: true,
    config: {},
    condicao: null,
  };
}

function estrutura(): Secao[] {
  return [
    ...DIMENSOES_CLIMA.map((d) => ({
      id: d.chave,
      titulo: d.rotulo,
      descricao: null,
      perguntas: AFIRMACOES_CLIMA.filter((a) => a.dimensao === d.chave).map(
        (a) => pergunta(a.chave, "concordancia"),
      ),
    })),
    {
      id: "abertas",
      titulo: null,
      descricao: null,
      perguntas: ABERTAS_CLIMA.map((c) => pergunta(c, "paragrafo")),
    },
  ];
}

function resposta(nota: number, trocas: Record<string, number> = {}) {
  const valores = new Map<string, unknown>();
  for (const a of AFIRMACOES_CLIMA) {
    valores.set(`id_${a.chave}`, trocas[a.chave] ?? nota);
  }
  return { valores };
}

/** 1, 2, 3, 4, 5, 1, 2… nas 60 afirmações, na ordem. */
function alternando(): Record<string, number> {
  const notas: Record<string, number> = {};
  AFIRMACOES_CLIMA.forEach((a, i) => (notas[a.chave] = (i % 5) + 1));
  return notas;
}

const RECUSA = [{ campo: "secoes", motivo: "estrutura_do_modelo" }];

describe("T216 — Pesquisa de Clima", () => {
  it("60 afirmações numeradas na ordem: 12 por dimensão, 4 por subdimensão", () => {
    expect(AFIRMACOES_CLIMA).toHaveLength(60);
    expect(AFIRMACOES_CLIMA[0]).toEqual({
      chave: "clima_01",
      dimensao: "credibilidade",
      subdimensao: "comunicacao",
    });
    expect(AFIRMACOES_CLIMA[12]).toEqual({
      chave: "clima_13",
      dimensao: "respeito",
      subdimensao: "apoio",
    });
    expect(AFIRMACOES_CLIMA[31]).toEqual({
      chave: "clima_32",
      dimensao: "imparcialidade",
      subdimensao: "imparcialidade",
    });
    expect(AFIRMACOES_CLIMA[59]).toEqual({
      chave: "clima_60",
      dimensao: "camaradagem",
      subdimensao: "comunidade",
    });
  });

  it("faixas do % favorável: < 50 crítica · 50–64 atenção · 65–79 boa · ≥ 80 excelente", () => {
    expect(faixaDoClima(0)).toBe("critica");
    expect(faixaDoClima(49)).toBe("critica");
    expect(faixaDoClima(50)).toBe("atencao");
    expect(faixaDoClima(64)).toBe("atencao");
    expect(faixaDoClima(65)).toBe("boa");
    expect(faixaDoClima(79)).toBe("boa");
    expect(faixaDoClima(80)).toBe("excelente");
    expect(faixaDoClima(100)).toBe("excelente");
  });

  it("caso real: todas 5, todas 3 e 1–5 alternando → 47%; dimensões 44/47/47/44/50", () => {
    const r = calcularClima(estrutura(), [
      resposta(5),
      resposta(3),
      resposta(1, alternando()),
    ]);
    expect(r).toMatchObject({
      favoravel: 47,
      faixa: "critica",
      notas: { favoraveis: 84, neutras: 72, desfavoraveis: 24 },
    });
    expect(r.dimensoes.map((d) => [d.favoravel, d.faixa])).toEqual([
      [44, "critica"],
      [47, "critica"],
      [47, "critica"],
      [44, "critica"],
      [50, "atencao"],
    ]);
  });

  it("% favorável por dimensão e subdimensão, com a faixa pelo favorável", () => {
    // Integridade (clima_09 a clima_12) com 3 numa das pessoas.
    const r = calcularClima(estrutura(), [
      resposta(5),
      resposta(4, {
        clima_09: 3,
        clima_10: 3,
        clima_11: 3,
        clima_12: 3,
      }),
    ]);
    const cred = r.dimensoes.find((d) => d.chave === "credibilidade")!;
    expect(cred).toMatchObject({
      afirmacoes: 12,
      respostas: 24,
      favoravel: 83,
      neutro: 17,
      desfavoravel: 0,
      faixa: "excelente",
    });
    expect(cred.subdimensoes?.map((s) => s.chave)).toEqual([
      "comunicacao",
      "competencia",
      "integridade",
    ]);
    const integridade = cred.subdimensoes!.find(
      (s) => s.chave === "integridade",
    )!;
    expect(integridade).toMatchObject({
      afirmacoes: 4,
      respostas: 8,
      favoravel: 50,
      neutro: 50,
      faixa: "atencao",
      // médias 4 → 75.
      score: 75,
    });
    expect(
      cred.subdimensoes!.find((s) => s.chave === "comunicacao"),
    ).toMatchObject({ favoravel: 100, faixa: "excelente", score: 88 });
    // Geral: 4 respostas neutras em 120.
    expect(r).toMatchObject({
      modelo: "clima",
      favoravel: 97,
      neutro: 3,
      desfavoravel: 0,
      faixa: "excelente",
    });
    expect(r.afirmacoes).toHaveLength(60);
  });

  it("crítica abaixo de 50% favorável; atenção a partir de 50%", () => {
    const r = calcularClima(estrutura(), [resposta(2), resposta(4)]);
    expect(r).toMatchObject({ favoravel: 50, faixa: "atencao" });
    const r2 = calcularClima(estrutura(), [
      resposta(2),
      resposta(1),
      resposta(5),
    ]);
    expect(r2).toMatchObject({
      favoravel: 33,
      desfavoravel: 67,
      faixa: "critica",
    });
  });

  it("afirmação acrescentada entra na dimensão dela; a removida sai da conta", () => {
    const secoes = estrutura().map((s) =>
      s.id === "respeito"
        ? {
            ...s,
            perguntas: [
              ...s.perguntas.filter((p) => p.chave !== "clima_13"),
              pergunta("clima_respeito_x1", "concordancia"),
            ],
          }
        : s,
    );
    const valores = new Map(resposta(3).valores);
    valores.set("id_clima_respeito_x1", 5);
    const r = calcularClima(secoes, [{ valores }]);
    const respeito = r.dimensoes.find((d) => d.chave === "respeito")!;
    expect(respeito).toMatchObject({ afirmacoes: 12, favoravel: 8 });
    expect(r.afirmacoes).toHaveLength(60);
    const chaves = r.afirmacoes.map((a) => a.chave);
    expect(chaves).toContain("clima_respeito_x1");
    expect(chaves).not.toContain("clima_13");
    expect(r.afirmacoes.find((a) => a.chave === "clima_respeito_x1")).toEqual(
      expect.objectContaining({ dimensao: "respeito", subdimensao: null }),
    );
  });

  it("estrutura editável: sem abertas, sem uma afirmação e com perguntas novas", () => {
    expect(errosDaEstruturaDoModelo("clima", estrutura())).toEqual([]);
    expect(errosDaEstruturaDoModelo("clima", estrutura().slice(0, 5))).toEqual(
      [],
    );
    const faltando = estrutura().map((s) => ({
      ...s,
      perguntas: s.perguntas.filter((p) => p.chave !== "clima_33"),
    }));
    expect(errosDaEstruturaDoModelo("clima", faltando)).toEqual([]);
    const comNovas = [
      ...estrutura(),
      {
        id: "novas",
        titulo: null,
        descricao: null,
        perguntas: [
          pergunta("clima_orgulho_abc", "concordancia"),
          pergunta("clima_aberta_xyz", "paragrafo"),
        ],
      },
    ];
    expect(errosDaEstruturaDoModelo("clima", comNovas)).toEqual([]);
  });

  it("estrutura editável: recusa tipo errado, dimensão inexistente, sem chave e repetida", () => {
    const com = (p: Pergunta): Secao[] => [
      ...estrutura(),
      { id: "x", titulo: null, descricao: null, perguntas: [p] },
    ];
    const casos: Pergunta[] = [
      pergunta("clima_orgulho_a", "escala"),
      pergunta("clima_aberta_b", "concordancia"),
      pergunta("clima_lideranca_a", "concordancia"),
      { ...pergunta("x", "paragrafo"), chave: null },
      pergunta("clima_05", "concordancia"),
      pergunta("outra", "concordancia"),
    ];
    for (const p of casos)
      expect(errosDaEstruturaDoModelo("clima", com(p))).toEqual(RECUSA);
    const trocada = estrutura().map((s) => ({
      ...s,
      perguntas: s.perguntas.map((p) =>
        p.chave === "clima_01" ? { ...p, tipo: "paragrafo" as const } : p,
      ),
    }));
    expect(errosDaEstruturaDoModelo("clima", trocada)).toEqual(RECUSA);
    // Só texto livre: falta afirmação.
    expect(errosDaEstruturaDoModelo("clima", [estrutura().at(-1)!])).toEqual(
      RECUSA,
    );
  });

  it("resumo da resposta: o índice da pessoa (40%, 0%, 100%) com a faixa", () => {
    expect(
      resumoDaRespostaDoClima(estrutura(), resposta(1, alternando()).valores),
    ).toEqual({ modelo: "clima", indice: 40, faixa: "critica" });
    expect(resumoDaRespostaDoClima(estrutura(), resposta(3).valores)).toEqual({
      modelo: "clima",
      indice: 0,
      faixa: "critica",
    });
    expect(
      resumoDaRespostaDoModelo("clima", estrutura(), resposta(5).valores),
    ).toEqual({ modelo: "clima", indice: 100, faixa: "excelente" });
    expect(resumoDaRespostaDoClima(estrutura(), new Map())).toEqual({
      modelo: "clima",
      indice: null,
      faixa: null,
    });
    expect(
      resumoDaRespostaDoModelo("pulso", estrutura(), new Map()),
    ).toBeNull();
  });

  it("individual: índice, contagens, dimensões, afirmações e distribuição × time", () => {
    const time = [resposta(5), resposta(3), resposta(1, alternando())];
    const p = individualDoClima(estrutura(), time[2]!.valores, time)!;
    expect(p).toMatchObject({
      modelo: "clima",
      indice: 40,
      faixa: "critica",
      favoraveis: 24,
      neutras: 12,
      desfavoraveis: 24,
      time: { indice: 47, faixa: "critica" },
    });
    expect(
      p.dimensoes.map((d) => [d.chave, d.indice, d.faixa, d.time]),
    ).toEqual([
      ["credibilidade", 33, "critica", 44],
      ["respeito", 42, "critica", 47],
      ["imparcialidade", 42, "critica", 47],
      ["orgulho", 33, "critica", 44],
      ["camaradagem", 50, "atencao", 50],
    ]);
    expect(p.afirmacoes).toHaveLength(60);
    expect(p.afirmacoes[0]).toEqual({
      chave: "clima_01",
      perguntaId: "id_clima_01",
      dimensao: "credibilidade",
      nota: 1,
      mediaTime: 3,
      favoravelTime: 33,
    });
    // 12 de cada nota; o time: 180 notas (12, 12, 72, 12, 72).
    expect(p.distribuicao).toEqual({
      resposta: [12, 12, 12, 12, 12],
      time: [7, 7, 40, 7, 40],
    });
  });

  it("individual sem o time: sem comparação; sem afirmações respondidas: índice nulo", () => {
    const sozinha = individualDoClima(estrutura(), resposta(5).valores)!;
    expect(sozinha).toMatchObject({
      indice: 100,
      faixa: "excelente",
      time: null,
    });
    expect(sozinha.distribuicao).toEqual({
      resposta: [0, 0, 0, 0, 60],
      time: null,
    });
    expect(sozinha.dimensoes[0]!.time).toBeNull();
    expect(sozinha.afirmacoes[0]).toMatchObject({
      nota: 5,
      mediaTime: null,
      favoravelTime: null,
    });
    const vazia = individualDoClima(estrutura(), new Map(), [])!;
    expect(vazia).toMatchObject({
      indice: null,
      faixa: null,
      favoraveis: 0,
      time: { indice: null, faixa: null },
    });
    expect(vazia.afirmacoes[0]!.nota).toBeNull();
  });
});
