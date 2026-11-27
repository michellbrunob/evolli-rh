import type { Pergunta, Secao } from "../../pesquisas.types";
import { errosDaEstruturaDoModelo } from "../indice";
import { calcularClima } from "./calculo";
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
    obrigatoria: tipo !== "paragrafo",
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
      faixa: "saudavel",
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
    ).toMatchObject({ favoravel: 100, faixa: "forte", score: 88 });
    // Geral: 4 respostas neutras em 120.
    expect(r).toMatchObject({
      modelo: "clima",
      favoravel: 97,
      neutro: 3,
      desfavoravel: 0,
      faixa: "forte",
    });
    expect(r.afirmacoes).toHaveLength(60);
  });

  it("crítico abaixo de 50% favorável", () => {
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
      faixa: "critico",
    });
  });

  it("estrutura fixa: as 60 afirmações; as abertas podem sair", () => {
    expect(errosDaEstruturaDoModelo("clima", estrutura())).toEqual([]);
    const semAbertas = estrutura().slice(0, 5);
    expect(errosDaEstruturaDoModelo("clima", semAbertas)).toEqual([]);
    const faltando = estrutura().map((s) => ({
      ...s,
      perguntas: s.perguntas.filter((p) => p.chave !== "clima_33"),
    }));
    expect(errosDaEstruturaDoModelo("clima", faltando)).toEqual([
      { campo: "secoes", motivo: "estrutura_do_modelo" },
    ]);
  });
});
