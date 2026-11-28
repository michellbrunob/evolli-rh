import {
  alertasDaAvaliacao,
  alinhamento,
  calibracao,
  comparativoDaPessoa,
  comparativoDoTime,
  exigeComentario,
  faixaDeTempoDeCasa,
  grupoDaNota,
  leituraDaCompetencia,
  mesesDeCasa,
  nivelDaNota,
  notaDaAvaliacao,
  pontosADesenvolver,
  quadrante,
  recorte,
  resumoDoTime,
  roteiroDeFeedback,
  umaCasa,
  type Notas,
} from "./calculo-avaliacao";
import { conferirEstruturaFixa } from "../comum";
import {
  ESTRUTURA_DA_AVALIACAO,
  CATALOGO,
  COMPETENCIAS,
  ITENS,
  TOTAL_DE_AFIRMACOES,
  secoesDaAvaliacao,
  type Competencia,
} from "./definicao";

/** T216 — Avaliação 90°/180°: catálogo e cálculo. */

/** Todas as 24 afirmações com a mesma nota. */
const todas = (n: number): Notas =>
  Object.fromEntries(ITENS.map((i) => [i.id, n]));

/** Cada competência com as 3 notas dadas. */
const porCompetencia = (
  notas: Partial<Record<Competencia, [number, number, number]>>,
  resto = 3,
): Notas =>
  Object.fromEntries(
    CATALOGO.flatMap((c) =>
      c.itens.map((i, k) => [i.id, notas[c.id]?.[k] ?? resto]),
    ),
  );

describe("T216 — catálogo da avaliação", () => {
  it("tem 8 competências × 3 afirmações, ids únicos e a ordem global", () => {
    expect(CATALOGO).toHaveLength(8);
    expect(TOTAL_DE_AFIRMACOES).toBe(24);
    expect(new Set(ITENS.map((i) => i.id)).size).toBe(24);
    expect(ITENS.map((i) => i.ordem)).toEqual([...Array(24).keys()]);
    expect(ITENS[3]).toMatchObject({
      id: "teq_1",
      competencia: "trabalho_equipe",
    });
  });

  it("cada afirmação tem as duas redações e um rótulo curto", () => {
    for (const i of ITENS) {
      expect(i.gestor.length).toBeGreaterThan(10);
      expect(i.autoavaliacao.length).toBeGreaterThan(10);
      expect(i.autoavaliacao).not.toBe(i.gestor);
      expect(i.rotulo.length).toBeLessThanOrEqual(40);
    }
  });

  it("os eixos têm 4 competências cada", () => {
    expect(
      CATALOGO.filter((c) => c.eixo === "entrega").map((c) => c.id),
    ).toEqual([
      "proatividade",
      "organizacao",
      "responsabilidade",
      "resolucao_problemas",
    ]);
    expect(CATALOGO.filter((c) => c.eixo === "pessoas")).toHaveLength(4);
  });

  it("as seções gravadas: uma por competência, escala 1–5 com os 5 rótulos", () => {
    const s = secoesDaAvaliacao();
    expect(s.map((x) => x.id)).toEqual([...COMPETENCIAS]);
    const p = s[0]!.perguntas[0]!;
    expect(p).toMatchObject({ id: "com_1", tipo: "escala", obrigatoria: true });
    expect(p.config.rotulos).toEqual([
      "Insuficiente",
      "Em desenvolvimento",
      "Bom",
      "Excelente",
      "Excepcional",
    ]);
  });
});

describe("T216 — níveis, eixos e mapa de talentos", () => {
  it.each([
    [1, "insuficiente"],
    [1.94, "insuficiente"],
    [1.95, "em_desenvolvimento"],
    [2.9, "em_desenvolvimento"],
    [3, "bom"],
    [3.94, "bom"],
    [3.96, "excelente"],
    [4.4, "excelente"],
    [4.45, "excepcional"],
    [5, "excepcional"],
  ])("nota %p → %s", (n, nivel) => {
    expect(nivelDaNota(n)).toBe(nivel);
  });

  it("arredonda 1 casa sem o erro do ponto flutuante", () => {
    expect(umaCasa(2.45)).toBe(2.5);
    expect(umaCasa(3.333)).toBe(3.3);
    expect(umaCasa(4.05)).toBe(4.1);
    expect(umaCasa(-0.45)).toBe(-0.5);
    expect(umaCasa(-0.44)).toBe(-0.4);
  });

  it.each([
    [4.5, 4.2, "referencia"],
    [4, 3.5, "forte_na_entrega"],
    [4, 2.9, "entrega_sozinho"],
    [3.5, 4.1, "forte_com_pessoas"],
    [3, 3.9, "solido"],
    [3.2, 2, "relacao_a_desenvolver"],
    [2.5, 4, "conecta_entrega_pouco"],
    [2.9, 3, "entrega_abaixo"],
    [1, 2.94, "precisa_de_apoio"],
  ])("entrega %p e pessoas %p → %s", (e, p, q) => {
    expect(quadrante(e, p)).toBe(q);
  });

  it("grupos pela nota geral: destaque ≥ 4, esperado 3–3,9, apoio < 3", () => {
    expect(grupoDaNota(4)).toBe("destaque");
    expect(grupoDaNota(3.96)).toBe("destaque");
    expect(grupoDaNota(3)).toBe("esperado");
    expect(grupoDaNota(2.94)).toBe("apoio");
  });
});

describe("T216 — nota de uma avaliação", () => {
  it("competência = média das 3; geral = média das 8; eixos", () => {
    const n = notaDaAvaliacao(
      porCompetencia({
        comunicacao: [5, 4, 4],
        proatividade: [2, 2, 3],
        lideranca: [1, 1, 1],
      }),
    );
    expect(n.competencias.comunicacao).toBe(4.3);
    expect(n.competencias.proatividade).toBe(2.3);
    expect(n.competencias.lideranca).toBe(1);
    // (4.333 + 3 + 2.333 + 3 + 3 + 3 + 1 + 3) / 8 = 2.833
    expect(n.geral).toBe(2.8);
    // entrega: (2.333 + 3 + 3 + 3) / 4 = 2.833; pessoas: (4.333+3+3+1)/4 = 2.833
    expect(n.entrega).toBe(2.8);
    expect(n.pessoas).toBe(2.8);
    expect(n.nivel).toBe("em_desenvolvimento");
    expect(n.quadrante).toBe("precisa_de_apoio");
    expect(n.grupo).toBe("apoio");
  });

  it("ignora notas fora de 1–5, não inteiras e ids desconhecidos", () => {
    const n = notaDaAvaliacao({
      com_1: 5,
      com_2: 0,
      com_3: 4.5,
      xyz_1: 1,
    });
    expect(n.competencias.comunicacao).toBe(5);
    expect(n.competencias.lideranca).toBeNull();
    expect(n.geral).toBe(5);
    expect(n.entrega).toBeNull();
    expect(n.quadrante).toBeNull();
  });

  it("sem nota nenhuma, tudo nulo", () => {
    const n = notaDaAvaliacao({});
    expect(n.geral).toBeNull();
    expect(n.nivel).toBeNull();
    expect(n.grupo).toBeNull();
  });

  it("pontos a desenvolver: as competências abaixo de 3, da menor", () => {
    const n = notaDaAvaliacao(
      porCompetencia({ lideranca: [2, 2, 2], organizacao: [1, 1, 2] }, 4),
    );
    expect(pontosADesenvolver(n)).toEqual(["organizacao", "lideranca"]);
  });
});

describe("T216 — comentários e alertas", () => {
  it.each([
    ["opcionais", 1, false],
    ["opcionais", 5, false],
    ["obrigatorios", 3, true],
    ["obrigatorios", null, true],
    ["extremos", 2.4, true],
    ["extremos", 2.5, false],
    ["extremos", 4.9, false],
    ["extremos", 5, true],
    ["extremos", null, false],
  ] as const)("regra %s com média %p → %p", (regra, m, esperado) => {
    expect(exigeComentario(regra, m)).toBe(esperado);
  });

  it("linha reta: as 24 notas iguais", () => {
    expect(alertasDaAvaliacao(todas(3), {})).toEqual([{ tipo: "linha_reta" }]);
    const quase = { ...todas(3), rpr_3: 4 };
    expect(alertasDaAvaliacao(quase, {})).toEqual([]);
    const incompleta = { ...todas(3) } as Record<string, number>;
    delete incompleta.rpr_3;
    expect(alertasDaAvaliacao(incompleta, {})).toEqual([]);
  });

  it("extremas sem comentário (< 2,5 ou = 5); com comentário, não", () => {
    const notas = porCompetencia({
      comunicacao: [5, 5, 5],
      lideranca: [2, 2, 3],
      organizacao: [3, 2, 2],
    });
    expect(
      alertasDaAvaliacao(notas, { organizacao: "Exemplo concreto." }),
    ).toEqual([
      {
        tipo: "extremas_sem_comentario",
        competencias: ["comunicacao", "lideranca"],
      },
    ]);
    expect(
      alertasDaAvaliacao(notas, {
        comunicacao: "a",
        lideranca: "b",
        organizacao: "  ",
      }),
    ).toEqual([
      { tipo: "extremas_sem_comentario", competencias: ["organizacao"] },
    ]);
  });
});

describe("T216 — o time", () => {
  const a = (avaliadoId: string, notas: Notas, avaliadorId = "g1") => ({
    avaliadoId,
    avaliadorId,
    notas,
  });

  it("média, ranking do mais forte ao mais fraco, abaixo de 3 e menor afirmação", () => {
    const r = resumoDoTime([
      a("p1", porCompetencia({ lideranca: [2, 2, 1] }, 4)),
      a("p2", porCompetencia({ lideranca: [4, 3, 2] }, 4)),
      a("p3", porCompetencia({ comunicacao: [5, 5, 5] }, 4)),
    ]);
    expect(r.avaliadas).toBe(3);
    expect(r.competencias[0]!.competencia).toBe("comunicacao");
    expect(r.competencias[0]!.media).toBe(4.3);
    const lid = r.competencias.at(-1)!;
    expect(lid.competencia).toBe("lideranca");
    // (1.667 + 3 + 4) / 3 = 2.889
    expect(lid.media).toBe(2.9);
    expect(lid.abaixoDe3).toEqual(["p1"]);
    expect(lid.percentualAbaixoDe3).toBe(33);
    // lid_3: (1 + 2 + 4) / 3 = 2.333 é a menor
    expect(lid.menorAfirmacao).toEqual({ itemId: "lid_3", media: 2.3 });
  });

  it("grupos e mapa de talentos com as pessoas", () => {
    const r = resumoDoTime([
      a("p1", todas(5)),
      a("p2", todas(3)),
      a("p3", todas(2)),
    ]);
    expect(r.grupos).toEqual({
      destaque: ["p1"],
      esperado: ["p2"],
      apoio: ["p3"],
    });
    expect(r.mapa.referencia).toEqual(["p1"]);
    expect(r.mapa.solido).toEqual(["p2"]);
    expect(r.mapa.precisa_de_apoio).toEqual(["p3"]);
    expect(r.mapa.forte_na_entrega).toEqual([]);
    expect(r.media).toBe(3.3);
    expect(r.nivel).toBe("bom");
  });

  it("sem avaliações: média nula e listas vazias", () => {
    const r = resumoDoTime([]);
    expect(r.media).toBeNull();
    expect(r.competencias.every((c) => c.media === null)).toBe(true);
    expect(r.competencias.every((c) => c.percentualAbaixoDe3 === 0)).toBe(true);
  });

  it("calibração: poucas (< 5), generoso, exigente e alinhado", () => {
    const lote = (gestor: string, n: number, nota: number) =>
      Array.from({ length: n }, (_, i) =>
        a(`${gestor}-${i}`, todas(nota), gestor),
      );
    const r = calibracao([
      ...lote("generoso", 5, 5),
      ...lote("exigente", 5, 2),
      ...lote("alinhado", 5, 4),
      ...lote("pouco", 4, 5),
    ]);
    // empresa: (25 + 10 + 20 + 20) / 19 = 3.947
    const por = Object.fromEntries(r.map((x) => [x.avaliadorId, x]));
    expect(por.generoso).toMatchObject({ leitura: "generoso", diferenca: 1.1 });
    expect(por.exigente).toMatchObject({
      leitura: "exigente",
      diferenca: -1.9,
    });
    expect(por.alinhado).toMatchObject({ leitura: "alinhado", diferenca: 0.1 });
    expect(por.pouco).toMatchObject({ leitura: "poucas", avaliadas: 4 });
  });

  it("calibração: diferença de exatamente 0,4 já conta", () => {
    const r = calibracao([
      ...Array.from({ length: 5 }, (_, i) => a(`x${i}`, todas(4), "x")),
      ...Array.from({ length: 5 }, (_, i) =>
        a(`y${i}`, porCompetencia({}, 3), "y"),
      ),
      ...Array.from({ length: 5 }, (_, i) => a(`z${i}`, todas(4), "z")),
    ]);
    // empresa: (20 + 15 + 20)/15 = 3.667; x: 4 − 3.667 = 0.333 → 0.3 (alinhado)
    const x = r.find((c) => c.avaliadorId === "x")!;
    expect(x.leitura).toBe("alinhado");
    const y = r.find((c) => c.avaliadorId === "y")!;
    // 3 − 3.667 = −0.667 → exigente
    expect(y.leitura).toBe("exigente");
  });

  it("tempo de casa: meses completos e as 5 faixas", () => {
    expect(mesesDeCasa("2026-01-15", "2026-07-14")).toBe(5);
    expect(mesesDeCasa("2026-01-15", "2026-07-15")).toBe(6);
    expect(faixaDeTempoDeCasa("2026-06-01", "2026-11-27")).toBe("ate_6_meses");
    expect(faixaDeTempoDeCasa("2026-05-27", "2026-11-27")).toBe(
      "6_meses_a_1_ano",
    );
    expect(faixaDeTempoDeCasa("2025-11-27", "2026-11-27")).toBe("1_a_3_anos");
    expect(faixaDeTempoDeCasa("2023-11-27", "2026-11-27")).toBe("3_a_5_anos");
    expect(faixaDeTempoDeCasa("2021-11-27", "2026-11-27")).toBe(
      "mais_de_5_anos",
    );
  });

  it("recorte: média por grupo; grupo com menos de 3 fica oculto", () => {
    const grupo: Record<string, string | null> = {
      p1: "A",
      p2: "A",
      p3: "A",
      p4: "B",
      p5: null,
    };
    const r = recorte(
      [
        a("p1", todas(5)),
        a("p2", todas(4)),
        a("p3", todas(3)),
        a("p4", todas(1)),
        a("p5", todas(1)),
      ],
      (id) => grupo[id] ?? null,
    );
    expect(r).toEqual([
      { grupo: "A", avaliadas: 3, media: 4, visivel: true },
      { grupo: "B", avaliadas: 1, media: null, visivel: false },
    ]);
  });
});

describe("T216 — 180°: gestor × autoavaliação", () => {
  it.each([
    [0.5, "acima"],
    [0.44, "alinhada"],
    [0, "alinhada"],
    [-0.45, "abaixo"],
    [-1.2, "abaixo"],
  ])("diferença %p → %s", (d, esperado) => {
    expect(alinhamento(d)).toBe(esperado);
  });

  it.each([
    [4, 4.5, "forca_confirmada"],
    [4.5, 3, "forca_nao_vista"],
    [3, 4, "ponto_cego"],
    [2, 2.9, "a_desenvolver"],
    [3.5, 3.9, "alinhada"],
    [3, 3.9, "alinhada"],
  ])("gestor %p e pessoa %p → %s", (g, a, l) => {
    expect(leituraDaCompetencia(g, a)).toBe(l);
  });

  it("comparativo da pessoa: diferença por competência e geral", () => {
    const c = comparativoDaPessoa(
      porCompetencia({ lideranca: [3, 3, 3], comunicacao: [5, 5, 4] }, 3),
      porCompetencia({ lideranca: [5, 4, 4], comunicacao: [5, 4, 5] }, 3),
    );
    const lid = c.competencias.find((x) => x.competencia === "lideranca")!;
    expect(lid).toMatchObject({
      gestor: 3,
      autoavaliacao: 4.3,
      diferenca: 1.3,
      leitura: "ponto_cego",
    });
    const com = c.competencias.find((x) => x.competencia === "comunicacao")!;
    expect(com.leitura).toBe("forca_confirmada");
    expect(c.diferenca).toBe(0.2);
    expect(c.alinhamento).toBe("alinhada");
  });

  it("sem a autoavaliação, a diferença fica nula", () => {
    const c = comparativoDaPessoa(todas(4), {});
    expect(c.diferenca).toBeNull();
    expect(c.alinhamento).toBeNull();
    expect(c.competencias.every((x) => x.leitura === null)).toBe(true);
  });

  it("comparativo do time: ordenado pela diferença e contagem acima/alinhadas/abaixo", () => {
    const t = comparativoDoTime([
      { gestor: todas(3), auto: todas(4) },
      { gestor: todas(4), auto: todas(4) },
      { gestor: todas(4), auto: todas(3) },
      {
        gestor: porCompetencia({ lideranca: [2, 2, 2] }, 4),
        auto: porCompetencia({ lideranca: [5, 5, 5] }, 4),
      },
    ]);
    expect(t.completas).toBe(4);
    expect(t.acima).toBe(1);
    expect(t.alinhadas).toBe(2);
    expect(t.abaixo).toBe(1);
    expect(t.competencias[0]!.competencia).toBe("lideranca");
    // gestor (3+4+4+2)/4 = 3.25; auto (4+4+3+5)/4 = 4
    expect(t.competencias[0]).toMatchObject({
      gestor: 3.3,
      autoavaliacao: 4,
      diferenca: 0.8,
    });
  });

  it("roteiro de feedback: a ordem da conversa, sem passo vazio, plano no fim", () => {
    const c = comparativoDaPessoa(
      porCompetencia(
        {
          comunicacao: [5, 5, 5],
          lideranca: [3, 3, 3],
          organizacao: [5, 5, 4],
          adaptabilidade: [2, 2, 2],
        },
        4,
      ),
      porCompetencia(
        {
          comunicacao: [4, 4, 5],
          lideranca: [5, 4, 5],
          organizacao: [3, 3, 3],
          adaptabilidade: [2, 2, 1],
        },
        4,
      ),
    );
    const r = roteiroDeFeedback(c);
    expect(r.map((p) => p.passo)).toEqual([
      "forcas_confirmadas",
      "forcas_nao_vistas",
      "pontos_cegos",
      "a_desenvolver",
      "plano",
    ]);
    expect(r[1]!.competencias).toEqual(["organizacao"]);
    expect(r[2]!.competencias).toEqual(["lideranca"]);
    expect(r[3]!.competencias).toEqual(["adaptabilidade"]);
    const so = roteiroDeFeedback(comparativoDaPessoa(todas(3), todas(3)));
    expect(so).toEqual([{ passo: "plano", competencias: [] }]);
  });
});

describe("T216 — metodologia fixa da avaliação (registro dos modelos)", () => {
  it("as seções do catálogo conferem", () => {
    expect(
      conferirEstruturaFixa(ESTRUTURA_DA_AVALIACAO, secoesDaAvaliacao()),
    ).toEqual([]);
  });

  it.each([
    [
      "sem uma afirmação",
      (s: ReturnType<typeof secoesDaAvaliacao>) => s[0]!.perguntas.pop(),
    ],
    [
      "escala de 1 a 10",
      (s: ReturnType<typeof secoesDaAvaliacao>) =>
        (s[1]!.perguntas[0]!.config.maximo = 10),
    ],
    [
      "afirmação opcional",
      (s: ReturnType<typeof secoesDaAvaliacao>) =>
        (s[2]!.perguntas[1]!.obrigatoria = false),
    ],
    [
      "sem a chave",
      (s: ReturnType<typeof secoesDaAvaliacao>) =>
        delete s[3]!.perguntas[2]!.chave,
    ],
  ])("recusa: %s", (_caso, estragar) => {
    const s = secoesDaAvaliacao();
    estragar(s);
    expect(conferirEstruturaFixa(ESTRUTURA_DA_AVALIACAO, s)).toEqual([
      { campo: "secoes", motivo: "estrutura_do_modelo" },
    ]);
  });
});

describe("T216 — fronteiras dos níveis e dos comentários (provas extras)", () => {
  it("4,5 já é Excepcional (nota, avaliação e time)", () => {
    expect(nivelDaNota(4.5)).toBe("excepcional");
    // Competências alternando 4,67 e 4,33: média geral 4,5.
    const n = notaDaAvaliacao(
      porCompetencia(
        {
          comunicacao: [5, 4, 5],
          trabalho_equipe: [4, 5, 4],
          proatividade: [5, 4, 5],
          organizacao: [4, 5, 4],
          responsabilidade: [5, 4, 5],
          adaptabilidade: [4, 5, 4],
          lideranca: [5, 4, 5],
          resolucao_problemas: [4, 5, 4],
        },
        4,
      ),
    );
    expect(n.geral).toBe(4.5);
    expect(n.nivel).toBe("excepcional");
    const t = resumoDoTime([
      { avaliadoId: "a", avaliadorId: "g", notas: todas(4) },
      { avaliadoId: "b", avaliadorId: "g", notas: todas(5) },
    ]);
    expect(t.nivel).toBe("excepcional");
  });

  it("média 2,5 (ou que arredonda para 2,5) não exige comentário", () => {
    expect(exigeComentario("extremos", 2.45)).toBe(false);
    expect(exigeComentario("extremos", 2.44)).toBe(true);
    const notas = { ...todas(3) } as Record<string, number>;
    notas.lid_1 = 2;
    notas.lid_2 = 3;
    delete notas.lid_3;
    expect(alertasDaAvaliacao(notas, {})).toEqual([]);
  });
});
