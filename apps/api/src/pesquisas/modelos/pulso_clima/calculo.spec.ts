import type { Pergunta, Secao } from "../../pesquisas.types";
import {
  errosDaEstruturaDoModelo,
  resumoDaRespostaDoModelo,
  resultadoDoModelo,
  resultadoIndividualDoModelo,
} from "../indice";
import {
  calcularPulsoClima,
  indicadorDoPulsoClima,
  individualDoPulsoClima,
} from "./calculo";
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
      textos: [{ texto: "Ótima liderança", mes: null, departamento: null }],
    });
  });

  it("textos dos comentários: mês mais recente primeiro e, no mês, alfabética", () => {
    const k = chaveDoComentario("lideranca");
    const c = calcularPulsoClima(estrutura(), [
      { ...resposta(4, 8, 8, { [k]: "Zeloso" }), mes: "2026-10" },
      {
        ...resposta(4, 8, 8, { [k]: " beta " }),
        mes: "2026-11",
        departamento: "Vendas",
      },
      { ...resposta(4, 8, 8, { [k]: "Alfa" }), mes: "2026-11" },
      { ...resposta(4, 8, 8, { [k]: "Antigo" }), mes: null },
    ]).comentarios.find((x) => x.dimensao === "lideranca")!;
    expect(c.quantidade).toBe(4);
    expect(c.textos).toEqual([
      { texto: "Alfa", mes: "2026-11", departamento: null },
      { texto: "beta", mes: "2026-11", departamento: "Vendas" },
      { texto: "Zeloso", mes: "2026-10", departamento: null },
      { texto: "Antigo", mes: null, departamento: null },
    ]);
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

describe("T216 — Pulso e Clima: a resposta de uma pessoa", () => {
  const time = [resposta(5, 10, 10), resposta(3, 8, 9), resposta(1, 2, 3)];

  it("indicador da aba Respostas: score 0–100 com a faixa", () => {
    expect(indicadorDoPulsoClima(estrutura(), time[0]!.valores)).toEqual({
      modelo: "pulso_clima",
      valor: 100,
      faixa: "forte",
    });
    // 21 em 3 (50) e uma em 4 (75): 51,1 → 51, atenção.
    const misto = resposta(3, 5, 5, { pc_ae_01: 4 });
    expect(indicadorDoPulsoClima(estrutura(), misto.valores)).toEqual({
      modelo: "pulso_clima",
      valor: 51,
      faixa: "atencao",
    });
    expect(indicadorDoPulsoClima(estrutura(), new Map())).toEqual({
      modelo: "pulso_clima",
      valor: null,
      faixa: null,
    });
    expect(
      resumoDaRespostaDoModelo("pulso_clima", estrutura(), misto.valores),
    ).toMatchObject({ valor: 51 });
    expect(
      resumoDaRespostaDoModelo("pulso", estrutura(), misto.valores),
    ).toBeNull();
  });

  it("score da pessoa ao lado do time, por dimensão e no geral", () => {
    const valores = resposta(4, 9, 6, {
      pc_lid_01: 2,
      [chaveDoComentario("lideranca")]: "  Mais retorno  ",
      [chaveDoComentario("enps")]: "Ok",
    }).valores;
    const p = individualDoPulsoClima(estrutura(), valores, time)!;
    // 21 em 4 (75) e uma em 2 (25): 72,7 → 73, saudável.
    expect(p).toMatchObject({
      modelo: "pulso_clima",
      score: 73,
      faixa: "saudavel",
      scoreTime: 50,
      favoraveis: 21,
      neutras: 0,
      desfavoraveis: 1,
    });
    const lid = p.dimensoes.find((d) => d.chave === "lideranca")!;
    // (25 + 75 × 3) ÷ 4 = 62,5 → 63.
    expect(lid).toEqual({
      chave: "lideranca",
      rotulo: "Liderança",
      score: 63,
      faixa: "atencao",
      scoreTime: 50,
    });
    expect(p.dimensoes).toHaveLength(8);
    expect(p.enps).toEqual({ nota: 6, indiceTime: 33 });
    expect(p.lnps).toEqual({ nota: 9, indiceTime: 0 });
    expect(p.comentarios).toEqual([
      { dimensao: "lideranca", texto: "Mais retorno" },
      { dimensao: "enps", texto: "Ok" },
    ]);
  });

  it("distribuição de 1 a 5: quantas a pessoa marcou e o % do time", () => {
    const p = individualDoPulsoClima(estrutura(), time[1]!.valores, time)!;
    expect(p.distribuicao).toEqual([
      { valor: 1, resposta: 0, time: 33 },
      { valor: 2, resposta: 0, time: 0 },
      { valor: 3, resposta: 22, time: 33 },
      { valor: 4, resposta: 0, time: 0 },
      { valor: 5, resposta: 0, time: 33 },
    ]);
    expect(p).toMatchObject({ favoraveis: 0, neutras: 22, desfavoraveis: 0 });
  });

  it("sem afirmação respondida: nulo; o registro devolve o individual", () => {
    expect(individualDoPulsoClima(estrutura(), new Map(), time)).toBeNull();
    const sozinho = individualDoPulsoClima(estrutura(), time[2]!.valores)!;
    expect(sozinho).toMatchObject({
      score: 0,
      faixa: "critico",
      scoreTime: null,
    });
    expect(sozinho.enps).toEqual({ nota: 3, indiceTime: null });
    expect(
      resultadoIndividualDoModelo(
        "pulso_clima",
        estrutura(),
        time[0]!.valores,
        time,
      ),
    ).toMatchObject({ modelo: "pulso_clima", score: 100, scoreTime: 50 });
  });
});
