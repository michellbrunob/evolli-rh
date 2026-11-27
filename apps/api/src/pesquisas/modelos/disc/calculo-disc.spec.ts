import type { Secao } from "../../pesquisas.types";
import {
  type Pontos,
  areaDoPonto,
  classificar,
  compatibilidadeDe,
  diversidadeDe,
  faixaDaDiversidade,
  lacunasDe,
  percentuaisDe,
  perfilDe,
  pontosDosValores,
  posicaoNoMapa,
  predominanteDe,
  resumoDoTime,
  tipoDoPar,
} from "./calculo-disc";
import { AREAS_DO_MAPA, FATORES, relacaoEntre } from "./definicao-disc";

/** T216 — Perfil comportamental (DISC): o cálculo puro. */

const p = (D: number, I: number, S: number, C: number): Pontos => ({
  D,
  I,
  S,
  C,
});

/** Blocos com as frases a→D, b→I, c→S, d→C. */
function blocos(n: number): Secao[] {
  return [
    {
      id: "s",
      titulo: null,
      descricao: null,
      perguntas: Array.from({ length: n }, (_, i) => ({
        id: `b${i + 1}`,
        tipo: "escolha_forcada" as const,
        texto: "Qual frase combina mais com você?",
        rotulo: null,
        descricao: null,
        obrigatoria: true,
        config: {
          opcoes: (["D", "I", "S", "C"] as const).map((fator) => ({
            id: `b${i + 1}-${fator}`,
            texto: `Frase ${fator}`,
            fator,
          })),
        },
        condicao: null,
      })),
    },
  ];
}

/** Respostas escolhendo os fatores na ordem dada. */
const escolhas = (fatores: string) =>
  [...fatores].map((f, i) => ({
    perguntaId: `b${i + 1}`,
    valor: { opcao: `b${i + 1}-${f}` },
  }));

describe("T216 — DISC: pontos e percentuais", () => {
  it("1 ponto por bloco no fator da frase escolhida", () => {
    const pontos = pontosDosValores(
      blocos(28),
      escolhas(`${"I".repeat(17)}${"D".repeat(6)}SSSCC`),
    );
    expect(pontos).toEqual(p(6, 17, 3, 2));
  });

  it("ignora bloco sem resposta, frase desconhecida e outras perguntas", () => {
    const secoes = blocos(3);
    secoes[0]!.perguntas.push({
      id: "texto",
      tipo: "texto_curto",
      texto: "Algo mais?",
      rotulo: null,
      descricao: null,
      obrigatoria: false,
      config: {},
      condicao: null,
    });
    const pontos = pontosDosValores(secoes, [
      { perguntaId: "b1", valor: { opcao: "b1-S" } },
      { perguntaId: "b2", valor: { opcao: "inexistente" } },
      { perguntaId: "texto", valor: "b3-D" },
    ]);
    expect(pontos).toEqual(p(0, 0, 1, 0));
  });

  it("percentual = round(pontos ÷ respondidos × 100); sem pontos, zeros", () => {
    expect(percentuaisDe(p(6, 17, 3, 2))).toEqual(p(21, 61, 11, 7));
    expect(percentuaisDe(p(3, 0, 18, 7))).toEqual(p(11, 0, 64, 25));
    // Sobre os blocos respondidos, não sobre os 28.
    expect(percentuaisDe(p(1, 1, 0, 0))).toEqual(p(50, 50, 0, 0));
    expect(percentuaisDe(p(0, 0, 0, 0))).toEqual(p(0, 0, 0, 0));
  });

  it("predominante: o de mais pontos; empate na ordem D, I, S, C", () => {
    expect(predominanteDe(p(6, 17, 3, 2))).toBe("I");
    expect(predominanteDe(p(14, 0, 0, 14))).toBe("D");
    expect(predominanteDe(p(0, 5, 5, 5))).toBe("I");
    expect(predominanteDe(p(0, 1, 5, 5))).toBe("S");
    expect(predominanteDe(p(1, 1, 1, 9))).toBe("C");
  });
});

describe("T216 — DISC: classificação do perfil", () => {
  it("mono: 1º ≥ 45 e 15 à frente; intensidade puro, acentuado, moderado", () => {
    expect(classificar(p(21, 61, 11, 7))).toEqual({
      tipo: "mono",
      fatores: ["I"],
      codigo: "I",
      intensidade: "puro",
    });
    expect(classificar(p(60, 30, 5, 5)).intensidade).toBe("puro");
    expect(classificar(p(59, 30, 6, 5)).intensidade).toBe("acentuado");
    expect(classificar(p(30, 50, 10, 10)).intensidade).toBe("acentuado");
    expect(classificar(p(10, 14, 30, 46))).toMatchObject({
      tipo: "mono",
      codigo: "C",
      intensidade: "moderado",
    });
    // 44%: não chega ao mono.
    expect(classificar(p(44, 29, 15, 12)).tipo).not.toBe("mono");
    // 14 à frente: não chega ao mono.
    expect(classificar(p(50, 36, 10, 4)).tipo).toBe("bi");
  });

  it("bi: 1º − 2º < 15 e 2º − 3º ≥ 10; acentuado com o 1º ≥ 40", () => {
    expect(classificar(p(50, 0, 0, 50))).toEqual({
      tipo: "bi",
      fatores: ["D", "C"],
      codigo: "DC",
      intensidade: "acentuado",
    });
    expect(classificar(p(38, 30, 18, 14))).toEqual({
      tipo: "bi",
      fatores: ["D", "I"],
      codigo: "DI",
      intensidade: "moderado",
    });
    expect(classificar(p(10, 30, 40, 20)).codigo).toBe("SI");
    expect(classificar(p(40, 30, 18, 12)).intensidade).toBe("acentuado");
    expect(classificar(p(39, 30, 19, 12)).intensidade).toBe("moderado");
  });

  it("tri: 1º − 3º < 20 → equilibrado; senão, bi moderado", () => {
    expect(classificar(p(27, 20, 25, 27), ["D", "C", "S", "I"])).toEqual({
      tipo: "tri",
      fatores: ["D", "C", "S"],
      codigo: "DCS",
      intensidade: "equilibrado",
    });
    expect(classificar(p(30, 28, 22, 20)).codigo).toBe("DIS");
    // 1º − 3º = 20 exatos: nem tri nem bi pela regra; vira bi moderado.
    expect(classificar(p(40, 25, 20, 15))).toEqual({
      tipo: "bi",
      fatores: ["D", "I"],
      codigo: "DI",
      intensidade: "moderado",
    });
  });

  it("perfil completo: o time do exemplo fica equilibrado D/C/S", () => {
    const time = perfilDe(p(23, 17, 21, 23));
    expect(time.percentuais).toEqual(p(27, 20, 25, 27));
    expect(time.predominante).toBe("D");
    expect(time.total).toBe(84);
    expect(time.classe.codigo).toBe("DCS");
    expect(time.classe.intensidade).toBe("equilibrado");
  });
});

describe("T216 — DISC: mapa de talentos", () => {
  it("x = 50 + ((S+C) − (D+I)) ÷ 2; y = 50 − ((I+S) − (D+C)) ÷ 2", () => {
    expect(posicaoNoMapa(p(21, 61, 11, 7))).toEqual({ x: 18, y: 28, area: 4 });
    expect(posicaoNoMapa(p(27, 20, 25, 27))).toEqual({
      x: 52.5,
      y: 54.5,
      area: 2,
    });
    expect(posicaoNoMapa(p(25, 25, 25, 25))).toEqual({ x: 50, y: 50, area: 2 });
  });

  it("limitado a 2..98: cada fator puro cai no canto da sua área", () => {
    expect(posicaoNoMapa(p(100, 0, 0, 0))).toEqual({ x: 2, y: 98, area: 1 });
    expect(posicaoNoMapa(p(0, 100, 0, 0))).toEqual({ x: 2, y: 2, area: 4 });
    expect(posicaoNoMapa(p(0, 0, 100, 0))).toEqual({ x: 98, y: 2, area: 8 });
    expect(posicaoNoMapa(p(0, 0, 0, 100))).toEqual({ x: 98, y: 98, area: 11 });
  });

  it("as 13 áreas cobrem o quadrado sem sobrepor", () => {
    expect(AREAS_DO_MAPA).toHaveLength(13);
    expect(new Set(AREAS_DO_MAPA.map((a) => a.id)).size).toBe(13);
    for (let x = 0.5; x < 100; x += 1) {
      for (let y = 0.5; y < 100; y += 1) {
        const dentro = AREAS_DO_MAPA.filter(
          (a) => x >= a.x[0] && x < a.x[1] && y >= a.y[0] && y < a.y[1],
        );
        expect(dentro).toHaveLength(1);
      }
    }
  });

  it("a área pela borda: o início é da área, o fim é da vizinha", () => {
    expect(areaDoPonto(33, 10)).toBe(7);
    expect(areaDoPonto(32.9, 10)).toBe(4);
    expect(areaDoPonto(50, 40)).toBe(6);
    expect(areaDoPonto(83, 60)).toBe(10);
    expect(areaDoPonto(70, 75)).toBe(13);
    // Fora do quadrado: a área de centro mais próximo.
    expect(areaDoPonto(120, 120)).toBe(11);
    expect(areaDoPonto(-5, -5)).toBe(4);
  });
});

describe("T216 — DISC: diversidade, lacunas e compatibilidade", () => {
  it("diversidade = entropia de Shannon ÷ 2 × 100, com as faixas", () => {
    expect(diversidadeDe(p(1, 1, 1, 0))).toEqual({
      score: 79,
      faixa: "equilibrado",
      ausentes: ["C"],
    });
    expect(diversidadeDe(p(2, 2, 2, 2)).score).toBe(100);
    expect(diversidadeDe(p(3, 3, 0, 0)).score).toBe(50);
    expect(diversidadeDe(p(5, 0, 0, 0))).toEqual({
      score: 0,
      faixa: "pouco_diverso",
      ausentes: ["I", "S", "C"],
    });
    expect(diversidadeDe(p(0, 0, 0, 0))).toEqual({
      score: 0,
      faixa: "pouco_diverso",
      ausentes: [],
    });
  });

  it("faixas: 0–39, 40–59, 60–79, 80–100", () => {
    expect(faixaDaDiversidade(39)).toBe("pouco_diverso");
    expect(faixaDaDiversidade(40)).toBe("moderado");
    expect(faixaDaDiversidade(59)).toBe("moderado");
    expect(faixaDaDiversidade(60)).toBe("equilibrado");
    expect(faixaDaDiversidade(79)).toBe("equilibrado");
    expect(faixaDaDiversidade(80)).toBe("altamente_diverso");
  });

  it("lacunas: < 20% das pessoas, do menos presente, até 2", () => {
    expect(lacunasDe(p(1, 1, 1, 0))).toEqual(["C"]);
    expect(lacunasDe(p(8, 1, 0, 1))).toEqual(["S", "I"]);
    // 20% exatos não é lacuna.
    expect(lacunasDe(p(2, 4, 2, 2))).toEqual([]);
    expect(lacunasDe(p(1, 4, 2, 3))).toEqual(["D"]);
    expect(lacunasDe(p(0, 0, 0, 0))).toEqual([]);
  });

  it("relações e o tipo do par", () => {
    expect(relacaoEntre("D", "S")).toBe("atrito");
    expect(relacaoEntre("S", "D")).toBe("atrito");
    expect(relacaoEntre("C", "I")).toBe("atrito");
    expect(relacaoEntre("D", "I")).toBe("sinergia");
    expect(relacaoEntre("C", "C")).toBe("neutro");
    expect(tipoDoPar("D", "D")).toBe("mesma_linguagem");
    expect(tipoDoPar("S", "D")).toBe("pede_atencao");
    expect(tipoDoPar("D", "C")).toBe("complementar");
    expect(tipoDoPar("S", "C")).toBe("complementar");
  });

  it("pares de pessoas: n(n−1)/2 no mesmo fator, nA × nB entre fatores", () => {
    const c = compatibilidadeDe(p(1, 1, 1, 0));
    expect(c.totalDePares).toBe(3);
    expect(c.porTipo).toEqual({
      mesma_linguagem: { pares: 0, percentual: 0 },
      complementar: { pares: 2, percentual: 67 },
      pede_atencao: { pares: 1, percentual: 33 },
    });
    expect(c.maiorAtencao).toEqual({ a: "D", b: "S", pares: 1 });
    expect(c.matriz).toHaveLength(10);

    const d = compatibilidadeDe(p(3, 2, 0, 4));
    const pares = (a: string, b: string) =>
      d.matriz.find((m) => m.a === a && m.b === b)!.pares;
    expect(pares("D", "D")).toBe(3);
    expect(pares("C", "C")).toBe(6);
    expect(pares("I", "C")).toBe(8);
    expect(pares("D", "C")).toBe(12);
    expect(d.totalDePares).toBe(36);
    expect(d.maiorAtencao).toEqual({ a: "I", b: "C", pares: 8 });
    expect(d.porTipo.mesma_linguagem.pares).toBe(10);
  });

  it("sem atrito com gente: sem maior ponto de atenção", () => {
    expect(compatibilidadeDe(p(2, 2, 0, 0)).maiorAtencao).toBeNull();
    expect(compatibilidadeDe(p(0, 0, 0, 0)).totalDePares).toBe(0);
  });
});

describe("T216 — DISC: resumo do time", () => {
  it("soma dos pontos, pessoas por predominante, intensidades e áreas", () => {
    const pessoas = [
      perfilDe(p(6, 17, 3, 2)),
      perfilDe(p(3, 0, 18, 7)),
      perfilDe(p(14, 0, 0, 14)),
    ];
    const r = resumoDoTime(pessoas);
    expect(r.totalDePessoas).toBe(3);
    expect(r.perfil!.pontos).toEqual(p(23, 17, 21, 23));
    expect(r.perfil!.classe.codigo).toBe("DCS");
    expect(r.porPredominante).toEqual(p(1, 1, 1, 0));
    expect(r.intensidades).toEqual({
      puro: 2,
      acentuado: 1,
      moderado: 0,
      equilibrado: 0,
    });
    expect(r.diversidade.score).toBe(79);
    expect(r.lacunas).toEqual(["C"]);
    expect(r.areas.reduce((t, a) => t + a.pessoas, 0)).toBe(3);
    expect(r.compatibilidade.maiorAtencao).toEqual({
      a: "D",
      b: "S",
      pares: 1,
    });
  });

  it("áreas da mais cheia para a mais vazia (empate: ordem do mapa)", () => {
    const r = resumoDoTime([
      perfilDe(p(0, 28, 0, 0)),
      perfilDe(p(28, 0, 0, 0)),
      perfilDe(p(28, 0, 0, 0)),
      perfilDe(p(0, 0, 28, 0)),
    ]);
    expect(r.areas).toEqual([
      { area: 1, pessoas: 2 },
      { area: 4, pessoas: 1 },
      { area: 8, pessoas: 1 },
    ]);
  });

  it("time vazio: sem perfil, tudo zerado", () => {
    const r = resumoDoTime([]);
    expect(r.perfil).toBeNull();
    expect(r.totalDePessoas).toBe(0);
    expect(FATORES.map((f) => r.porPredominante[f])).toEqual([0, 0, 0, 0]);
    expect(r.areas).toEqual([]);
  });
});
