import type { Pergunta, Secao } from "../pesquisas.types";
import {
  conferirEstruturaFixa,
  faixaDaRecomendacao,
  faixaDoScore,
  percentuais,
  recomendacao,
  scoreDaConcordancia,
} from "./comum";
import { errosDaEstruturaDoModelo } from "./indice";
import type { EstruturaFixa } from "./tipos";

/** T216 — contas comuns dos modelos: faixas, percentuais, eNPS/LNPS e estrutura fixa. */

function p(
  id: string,
  chave: string | null,
  tipo: Pergunta["tipo"],
  config: Pergunta["config"] = {},
  obrigatoria = true,
): Pergunta {
  return {
    id,
    ...(chave ? { chave } : {}),
    tipo,
    texto: id,
    rotulo: null,
    descricao: null,
    obrigatoria,
    config,
    condicao: null,
  };
}

const secao = (perguntas: Pergunta[]): Secao[] => [
  { id: "s", titulo: null, descricao: null, perguntas },
];

describe("T216 — modelos/comum", () => {
  it("score da concordância: 1 → 0, 3 → 50, 5 → 100 e 3,67 → 66,75", () => {
    expect(scoreDaConcordancia(1)).toBe(0);
    expect(scoreDaConcordancia(3)).toBe(50);
    expect(scoreDaConcordancia(5)).toBe(100);
    expect(scoreDaConcordancia(3.67)).toBeCloseTo(66.75, 5);
  });

  it("faixas do score nas fronteiras: 49 crítico, 50 atenção, 69/70, 84/85", () => {
    expect(faixaDoScore(0)).toBe("critico");
    expect(faixaDoScore(49)).toBe("critico");
    expect(faixaDoScore(49.9)).toBe("critico");
    expect(faixaDoScore(50)).toBe("atencao");
    expect(faixaDoScore(69)).toBe("atencao");
    expect(faixaDoScore(70)).toBe("saudavel");
    expect(faixaDoScore(84)).toBe("saudavel");
    expect(faixaDoScore(85)).toBe("forte");
    expect(faixaDoScore(100)).toBe("forte");
  });

  it("faixas da recomendação: −1 crítico, 0 em ajuste, 29/30 bom, 69/70 excelente", () => {
    expect(faixaDaRecomendacao(-100)).toBe("critico");
    expect(faixaDaRecomendacao(-1)).toBe("critico");
    expect(faixaDaRecomendacao(0)).toBe("em_ajuste");
    expect(faixaDaRecomendacao(29)).toBe("em_ajuste");
    expect(faixaDaRecomendacao(30)).toBe("bom");
    expect(faixaDaRecomendacao(69)).toBe("bom");
    expect(faixaDaRecomendacao(70)).toBe("excelente");
  });

  it("percentuais: 4 e 5 favoráveis, 3 neutro, 1 e 2 desfavoráveis", () => {
    expect(percentuais([5, 4, 3, 2])).toEqual({
      favoravel: 50,
      neutro: 25,
      desfavoravel: 25,
    });
    expect(percentuais([1, 2, 3])).toEqual({
      favoravel: 0,
      neutro: 33,
      desfavoravel: 67,
    });
    expect(percentuais([])).toEqual({
      favoravel: null,
      neutro: null,
      desfavoravel: null,
    });
  });

  it("recomendação: promotores 9–10, neutros 7–8, detratores 0–6, índice e notas", () => {
    const r = recomendacao("q", [10, 9, 8, 7, 6, 0]);
    expect(r).toMatchObject({
      perguntaId: "q",
      respostas: 6,
      promotores: 2,
      neutros: 2,
      detratores: 2,
      indice: 0,
      faixa: "em_ajuste",
    });
    expect(r.distribuicao).toHaveLength(11);
    expect(r.distribuicao[0]).toEqual({ valor: 0, quantidade: 1 });
    expect(r.distribuicao[6]).toEqual({ valor: 6, quantidade: 1 });
    expect(r.distribuicao[10]).toEqual({ valor: 10, quantidade: 1 });
    expect(recomendacao(null, [9, 10, 5]).indice).toBe(33);
    expect(recomendacao(null, [0]).faixa).toBe("critico");
    expect(recomendacao(null, [])).toMatchObject({ indice: null, faixa: null });
  });

  describe("estrutura fixa", () => {
    const estrutura: EstruturaFixa = {
      itens: [
        { chave: "a", tipo: "concordancia" },
        {
          chave: "b",
          tipo: "nota_0_10",
          config: (c) => c.lnps === true,
        },
      ],
      opcionais: [{ chave: "c", tipo: "paragrafo", obrigatoria: false }],
    };
    const recusa = [{ campo: "secoes", motivo: "estrutura_do_modelo" }];
    const base = () => [
      p("1", "a", "concordancia"),
      p("2", "b", "nota_0_10", { lnps: true }),
    ];

    it("aceita os itens com e sem o opcional", () => {
      expect(conferirEstruturaFixa(estrutura, secao(base()))).toEqual([]);
      expect(
        conferirEstruturaFixa(
          estrutura,
          secao([...base(), p("3", "c", "paragrafo", {}, false)]),
        ),
      ).toEqual([]);
    });

    it("recusa item faltando, repetido, de outro tipo ou de outra escala", () => {
      expect(conferirEstruturaFixa(estrutura, secao([base()[0]!]))).toEqual(
        recusa,
      );
      expect(
        conferirEstruturaFixa(
          estrutura,
          secao([...base(), p("9", "a", "concordancia")]),
        ),
      ).toEqual(recusa);
      expect(
        conferirEstruturaFixa(
          estrutura,
          secao([p("1", "a", "estrelas"), base()[1]!]),
        ),
      ).toEqual(recusa);
      expect(
        conferirEstruturaFixa(
          estrutura,
          secao([base()[0]!, p("2", "b", "nota_0_10", { enps: true })]),
        ),
      ).toEqual(recusa);
    });

    it("recusa pergunta fora do modelo e o opcional obrigatório", () => {
      expect(
        conferirEstruturaFixa(
          estrutura,
          secao([...base(), p("x", null, "texto_curto")]),
        ),
      ).toEqual(recusa);
      expect(
        conferirEstruturaFixa(
          estrutura,
          secao([...base(), p("3", "c", "paragrafo", {}, true)]),
        ),
      ).toEqual(recusa);
    });

    it("só os modelos registrados com estrutura são conferidos", () => {
      const livre = secao([p("x", null, "texto_curto")]);
      expect(errosDaEstruturaDoModelo("pulso", livre)).toEqual([]);
      expect(errosDaEstruturaDoModelo("personalizada", livre)).toEqual([]);
      expect(errosDaEstruturaDoModelo("tad", livre)).toEqual(recusa);
      expect(errosDaEstruturaDoModelo("clima", livre)).toEqual(recusa);
      expect(errosDaEstruturaDoModelo("pulso_clima", livre)).toEqual(recusa);
    });
  });
});
