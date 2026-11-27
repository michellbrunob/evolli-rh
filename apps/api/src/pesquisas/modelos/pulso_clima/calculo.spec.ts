import type { Pergunta, Secao } from "../../pesquisas.types";
import { errosDaEstruturaDoModelo, resultadoDoModelo } from "../indice";
import { calcularPulsoClima } from "./calculo";
import {
  AFIRMACOES_PULSO_CLIMA,
  CHAVE_ENPS,
  CHAVE_LNPS,
  DIMENSOES_PULSO_CLIMA,
  chaveDoComentario,
} from "./definicao";

/** T216 — Pulso e Clima: dimensões, score 0–100, eNPS e LNPS. */

function pergunta(
  chave: string,
  tipo: Pergunta["tipo"],
  config: Pergunta["config"] = {},
  obrigatoria = true,
): Pergunta {
  return {
    id: `id_${chave}`,
    chave,
    tipo,
    texto: chave,
    rotulo: null,
    descricao: null,
    obrigatoria,
    config,
    condicao: null,
  };
}

/** A estrutura do modelo, com ou sem os comentários. */
function estrutura(comComentarios = true): Secao[] {
  const secoes: Secao[] = DIMENSOES_PULSO_CLIMA.map((d) => ({
    id: d.chave,
    titulo: d.rotulo,
    descricao: null,
    perguntas: [
      ...AFIRMACOES_PULSO_CLIMA.filter((a) => a.dimensao === d.chave).map((a) =>
        pergunta(a.chave, "concordancia"),
      ),
      ...(comComentarios
        ? [pergunta(chaveDoComentario(d.chave), "paragrafo", {}, false)]
        : []),
    ],
  }));
  secoes.push({
    id: "recomendacao",
    titulo: null,
    descricao: null,
    perguntas: [
      pergunta(CHAVE_LNPS, "nota_0_10", { enps: false, lnps: true }),
      ...(comComentarios
        ? [pergunta(chaveDoComentario("lnps"), "paragrafo", {}, false)]
        : []),
      pergunta(CHAVE_ENPS, "nota_0_10", { enps: true }),
      ...(comComentarios
        ? [pergunta(chaveDoComentario("enps"), "paragrafo", {}, false)]
        : []),
    ],
  });
  return secoes;
}

/** Todas as afirmações com a mesma nota, mais as trocas. */
function resposta(
  nota: number,
  lnps: number,
  enps: number,
  outros: Record<string, unknown> = {},
) {
  const valores = new Map<string, unknown>();
  for (const a of AFIRMACOES_PULSO_CLIMA) valores.set(`id_${a.chave}`, nota);
  valores.set(`id_${CHAVE_LNPS}`, lnps);
  valores.set(`id_${CHAVE_ENPS}`, enps);
  for (const [k, v] of Object.entries(outros)) valores.set(`id_${k}`, v);
  return { valores };
}

describe("T216 — Pulso e Clima", () => {
  const respostas = [
    resposta(5, 10, 10, {
      pc_cond_01: 1,
      [chaveDoComentario("lideranca")]: "Ótima liderança",
      [chaveDoComentario("enps")]: "Gosto daqui",
    }),
    resposta(2, 5, 6),
    resposta(4, 8, 9, {
      [chaveDoComentario("lideranca")]: "   ",
      [chaveDoComentario("bem_estar")]: "Pausas",
    }),
  ];
  const r = calcularPulsoClima(estrutura(), respostas);

  it("tem 8 dimensões com 3, 4, 3, 2, 2, 3, 3 e 2 afirmações (22)", () => {
    expect(r.dimensoes.map((d) => d.chave)).toEqual(
      DIMENSOES_PULSO_CLIMA.map((d) => d.chave),
    );
    expect(r.dimensoes.map((d) => d.afirmacoes)).toEqual([
      3, 4, 3, 2, 2, 3, 3, 2,
    ]);
    expect(r.afirmacoes).toHaveLength(22);
  });

  it("score da afirmação = (média − 1) ÷ 4 × 100 e percentuais", () => {
    const ae = r.afirmacoes.find((a) => a.chave === "pc_ae_01")!;
    expect(ae).toMatchObject({
      dimensao: "alinhamento_estrategia",
      respostas: 3,
      media: 3.67,
      score: 67,
      favoravel: 67,
      neutro: 0,
      desfavoravel: 33,
    });
    const cond = r.afirmacoes.find((a) => a.chave === "pc_cond_01")!;
    expect(cond).toMatchObject({ media: 2.33, score: 33, favoravel: 33 });
  });

  it("dimensão = média das afirmações; faixa pelo score (50 = atenção)", () => {
    const condicoes = r.dimensoes.find((d) => d.chave === "condicoes")!;
    expect(condicoes).toMatchObject({
      score: 50,
      faixa: "atencao",
      respostas: 6,
      favoravel: 50,
      neutro: 0,
      desfavoravel: 50,
    });
    const lideranca = r.dimensoes.find((d) => d.chave === "lideranca")!;
    expect(lideranca).toMatchObject({ score: 67, faixa: "atencao" });
  });

  it("geral = média das 22 afirmações", () => {
    // 21 afirmações em 66,67 e uma em 33,33: 65,15.
    expect(r.score).toBe(65);
    expect(r.faixa).toBe("atencao");
    expect(r.favoravel).toBe(65);
  });

  it("eNPS e LNPS com as faixas do modelo e a distribuição", () => {
    expect(r.enps).toMatchObject({
      perguntaId: `id_${CHAVE_ENPS}`,
      promotores: 2,
      neutros: 0,
      detratores: 1,
      indice: 33,
      faixa: "bom",
    });
    expect(r.lnps).toMatchObject({
      perguntaId: `id_${CHAVE_LNPS}`,
      promotores: 1,
      neutros: 1,
      detratores: 1,
      indice: 0,
      faixa: "em_ajuste",
    });
    expect(r.lnps.distribuicao[8]).toEqual({ valor: 8, quantidade: 1 });
  });

  it("conta só os comentários escritos de cada dimensão", () => {
    expect(r.dimensoes.find((d) => d.chave === "lideranca")!.comentarios).toBe(
      1,
    );
    expect(r.dimensoes.find((d) => d.chave === "bem_estar")!.comentarios).toBe(
      1,
    );
    expect(r.dimensoes.find((d) => d.chave === "inovacao")!.comentarios).toBe(
      0,
    );
    expect(r.comentarios).toHaveLength(10);
    expect(r.comentarios.find((c) => c.dimensao === "enps")?.quantidade).toBe(
      1,
    );
    expect(r.comentarios.find((c) => c.dimensao === "lnps")?.quantidade).toBe(
      0,
    );
    expect(r.comentarios.find((c) => c.dimensao === "lideranca")).toEqual({
      dimensao: "lideranca",
      perguntaId: `id_${chaveDoComentario("lideranca")}`,
      quantidade: 1,
    });
  });

  it("forte a partir de 85 e crítico abaixo de 50", () => {
    const forte = calcularPulsoClima(estrutura(false), [
      resposta(5, 10, 10),
      resposta(4, 10, 10),
    ]);
    // média 4,5 → 87,5 → 88.
    expect(forte).toMatchObject({ score: 88, faixa: "forte" });
    expect(forte.enps).toMatchObject({ indice: 100, faixa: "excelente" });
    expect(forte.comentarios).toEqual([]);
    const critico = calcularPulsoClima(estrutura(false), [resposta(2, 0, 0)]);
    expect(critico).toMatchObject({ score: 25, faixa: "critico" });
    expect(critico.enps).toMatchObject({ indice: -100, faixa: "critico" });
  });

  it("registro: estrutura fixa e cálculo pelo modelo", () => {
    expect(errosDaEstruturaDoModelo("pulso_clima", estrutura())).toEqual([]);
    expect(errosDaEstruturaDoModelo("pulso_clima", estrutura(false))).toEqual(
      [],
    );
    const semLnps = estrutura().map((s) => ({
      ...s,
      perguntas: s.perguntas.filter((p) => p.chave !== CHAVE_LNPS),
    }));
    expect(errosDaEstruturaDoModelo("pulso_clima", semLnps)).toEqual([
      { campo: "secoes", motivo: "estrutura_do_modelo" },
    ]);
    expect(
      resultadoDoModelo("pulso_clima", estrutura(), respostas)?.modelo,
    ).toBe("pulso_clima");
    expect(resultadoDoModelo("pulso", estrutura(), respostas)).toBeNull();
  });
});
