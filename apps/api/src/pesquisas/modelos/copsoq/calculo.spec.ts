import {
  calcularNr1,
  calcularNr1DoModelo,
  compararEscore,
  escoresDaPessoa,
  faixaDoEscore,
  individualNr1,
  MATRIZ_NR1,
  nivelDo,
  ordenarPrioridades,
  pontuacaoDoItem,
  prevalenciaDo,
  pressaoERecursos,
  saudeLegadaDe,
  severidadeDo,
  tercilDo,
  valoresDe,
} from "./calculo";
import {
  DIMENSOES_NR1,
  DOMINIOS_NR1,
  ESTRUTURA_NR1,
  ITENS_NR1,
  ROTULOS_DA_ESCALA,
  ROTULOS_DA_SAUDE_LEGADA,
} from "./definicao";
import type { Secao, ValorRespondido } from "../../pesquisas.types";

/** T216 — riscos psicossociais (NR-1): estrutura e cálculo. */

const item = (id: string) => ITENS_NR1.find((i) => i.id === id)!;

/** Uma resposta com a mesma posição em todos os itens (e ajustes). */
function resposta(
  padrao: number,
  ajustes: Record<string, number> = {},
): { valores: ValorRespondido[] } {
  return {
    valores: ITENS_NR1.map((i) => ({
      perguntaId: i.id,
      valor: ajustes[i.id] ?? padrao,
    })),
  };
}

/** Itens de uma dimensão. */
const itensDe = (dim: string) =>
  ITENS_NR1.filter((i) => i.dimensao === dim).map((i) => i.id);

/** A mesma posição nos itens de uma dimensão. */
function naDimensao(dim: string, v: number): Record<string, number> {
  return Object.fromEntries(itensDe(dim).map((id) => [id, v]));
}

describe("estrutura NR-1", () => {
  it("tem 76 perguntas em 8 domínios e 29 dimensões, na ordem", () => {
    expect(ITENS_NR1).toHaveLength(76);
    expect(ITENS_NR1.map((i) => i.id)).toEqual(
      Array.from({ length: 76 }, (_, i) => `Q${i + 1}`),
    );
    expect(DIMENSOES_NR1).toHaveLength(29);
    expect(ESTRUTURA_NR1.itens.map((i) => i.chave)).toEqual(
      ITENS_NR1.map((i) => i.id),
    );
    expect(ESTRUTURA_NR1.opcionais).toEqual([]);
    const porDominio = DOMINIOS_NR1.map(
      (d) =>
        ITENS_NR1.filter(
          (i) =>
            DIMENSOES_NR1.find((x) => x.id === i.dimensao)!.dominio === d.id,
        ).length,
    );
    expect(porDominio).toEqual([8, 12, 21, 8, 12, 2, 9, 4]);
  });

  it("usa a escala de cada bloco e inverte só Q53 e Q54", () => {
    expect(item("Q43").escala).toBe("satisfacao");
    expect(item("Q46").escala).toBe("satisfacao");
    expect(item("Q47").escala).toBe("frequencia");
    expect(item("Q50").escala).toBe("concordancia");
    expect(item("Q63").escala).toBe("concordancia");
    expect(item("Q64").escala).toBe("saude");
    expect(item("Q65").escala).toBe("intensidade");
    expect(item("Q72").escala).toBe("intensidade");
    expect(item("Q73").escala).toBe("frequencia");
    expect(ITENS_NR1.filter((i) => i.invertido).map((i) => i.id)).toEqual([
      "Q53",
      "Q54",
    ]);
    expect(itensDe("confianca_horizontal")).toEqual(["Q53", "Q54", "Q55"]);
    expect(itensDe("qualidade_lideranca")).toEqual([
      "Q32",
      "Q33",
      "Q34",
      "Q35",
    ]);
  });

  it("confere a escala de 1 a 5 com os 5 rótulos e a obrigatoriedade", () => {
    const q64 = ESTRUTURA_NR1.itens[63]!;
    expect(q64.chave).toBe("Q64");
    expect(q64.tipo).toBe("escala");
    expect(q64.obrigatoria).toBe(true);
    // Do pior ao melhor: a posição 5 é "Excelente" (exibida de 5 a 1).
    const rotulos = [...ROTULOS_DA_ESCALA.saude];
    expect(rotulos).toEqual([
      "Fraca",
      "Regular",
      "Boa",
      "Muito boa",
      "Excelente",
    ]);
    expect(
      q64.config!({ minimo: 1, maximo: 5, rotulos, decrescente: true }),
    ).toBe(true);
    // As pesquisas já gravadas (1 = Excelente) continuam aceitas.
    expect(
      q64.config!({
        minimo: 1,
        maximo: 5,
        rotulos: [...ROTULOS_DA_SAUDE_LEGADA],
      }),
    ).toBe(true);
    expect(ROTULOS_DA_SAUDE_LEGADA[0]).toBe("Excelente");
    expect(
      q64.config!({ minimo: 1, maximo: 5, rotulos: rotulos.slice(1) }),
    ).toBe(false);
    expect(q64.config!({ minimo: 0, maximo: 4, rotulos })).toBe(false);
    expect(q64.config!({ minimo: 1, maximo: 5 })).toBe(false);
    expect(ROTULOS_DA_ESCALA.frequencia[0]).toBe("Nunca / Quase nunca");
    expect(ROTULOS_DA_ESCALA.satisfacao[2]).toBe("Moderadamente satisfeito(a)");
  });

  it("classifica risco e proteção como no instrumento", () => {
    const tipo = (id: string) => DIMENSOES_NR1.find((d) => d.id === id)!.tipo;
    expect(tipo("conflitos_papeis")).toBe("risco");
    expect(tipo("inseguranca_laboral")).toBe("risco");
    expect(tipo("saude_geral")).toBe("protecao");
    expect(tipo("autoeficacia")).toBe("protecao");
    expect(DIMENSOES_NR1.filter((d) => d.tipo === "risco")).toHaveLength(12);
  });
});

describe("pontuação, tercis, severidade e prevalência", () => {
  it("espelha invertidos e a escala de saúde; recusa fora de 1 a 5", () => {
    expect(pontuacaoDoItem(item("Q1"), 4)).toBe(4);
    expect(pontuacaoDoItem(item("Q53"), 5)).toBe(1);
    expect(pontuacaoDoItem(item("Q54"), 2)).toBe(4);
    // Saúde: 5 = Excelente vale 5; nas pesquisas já gravadas, espelhada.
    expect(pontuacaoDoItem(item("Q64"), 5)).toBe(5);
    expect(pontuacaoDoItem(item("Q64"), 2)).toBe(2);
    expect(pontuacaoDoItem(item("Q64"), 1, true)).toBe(5);
    expect(pontuacaoDoItem(item("Q64"), 4, true)).toBe(2);
    expect(pontuacaoDoItem(item("Q53"), 5, true)).toBe(1);
    expect(pontuacaoDoItem(item("Q1"), 4, true)).toBe(4);
    expect(pontuacaoDoItem(item("Q1"), 0)).toBeNull();
    expect(pontuacaoDoItem(item("Q1"), 6)).toBeNull();
    expect(pontuacaoDoItem(item("Q1"), 2.5)).toBeNull();
    expect(pontuacaoDoItem(item("Q1"), "3")).toBeNull();
  });

  it("escore da dimensão = média dos itens respondidos", () => {
    const e = escoresDaPessoa(
      valoresDe([
        { perguntaId: "Q1", valor: 5 },
        { perguntaId: "Q2", valor: 2 },
        { perguntaId: "Q53", valor: 5 },
        { perguntaId: "Q54", valor: 5 },
        { perguntaId: "Q55", valor: 4 },
      ]),
    );
    expect(e.get("exigencias_quantitativas")).toBe(3.5);
    expect(e.get("confianca_horizontal")).toBe(2);
    expect(e.has("ritmo_trabalho")).toBe(false);
  });

  it("corta os tercis em 2,33 e 3,66", () => {
    expect(tercilDo(2.33)).toBe(1);
    expect(tercilDo(7 / 3)).toBe(2);
    expect(tercilDo(3.66)).toBe(2);
    expect(tercilDo(3.67)).toBe(3);
    expect(faixaDoEscore("risco", 4)).toBe("risco");
    expect(faixaDoEscore("risco", 1)).toBe("favoravel");
    expect(faixaDoEscore("protecao", 1)).toBe("risco");
    expect(faixaDoEscore("protecao", 4)).toBe("favoravel");
    expect(faixaDoEscore("protecao", 3)).toBe("intermediario");
  });

  it("severidade pelo escore (proteção espelhada)", () => {
    expect(severidadeDo("risco", 4.01)).toBe(4);
    expect(severidadeDo("risco", 4)).toBe(3);
    expect(severidadeDo("risco", 3)).toBe(2);
    expect(severidadeDo("risco", 2)).toBe(1);
    expect(severidadeDo("risco", 2.01)).toBe(2);
    expect(severidadeDo("protecao", 1.5)).toBe(4);
    expect(severidadeDo("protecao", 5)).toBe(1);
  });

  it("prevalência pelo % em risco, com a regra de amostra pequena", () => {
    expect(prevalenciaDo(60, 10, 6, 0)).toBe(4);
    expect(prevalenciaDo(59.9, 10, 5, 0)).toBe(3);
    expect(prevalenciaDo(40, 10, 4, 0)).toBe(3);
    expect(prevalenciaDo(20, 10, 2, 0)).toBe(2);
    expect(prevalenciaDo(19.9, 20, 3, 0)).toBe(1);
    // Menos de 10 pessoas: alguém em risco → 3 (mesmo com 100%).
    expect(prevalenciaDo(100, 3, 3, 0)).toBe(3);
    expect(prevalenciaDo(0, 9, 0, 2)).toBe(2);
    expect(prevalenciaDo(0, 9, 0, 0)).toBe(1);
    expect(prevalenciaDo(0, 10, 0, 5)).toBe(1);
  });

  it("nível pela matriz 4 × 4 e a regra de proteção", () => {
    expect(MATRIZ_NR1[0]).toEqual(["medio", "alto", "critico", "critico"]);
    expect(MATRIZ_NR1[3]).toEqual(["baixo", "baixo", "baixo", "medio"]);
    expect(nivelDo("stress", 4, 1).nivel).toBe("medio");
    expect(nivelDo("stress", 3, 3).nivel).toBe("alto");
    expect(nivelDo("stress", 2, 4).nivel).toBe("alto");
    expect(nivelDo("stress", 1, 1).nivel).toBe("baixo");
    expect(nivelDo("sintomas_depressivos", 3, 1)).toEqual({
      nivel: "alto",
      regraDeProtecao: true,
    });
    expect(nivelDo("comportamentos_ofensivos", 4, 1)).toEqual({
      nivel: "alto",
      regraDeProtecao: true,
    });
    expect(nivelDo("comportamentos_ofensivos", 2, 4)).toEqual({
      nivel: "alto",
      regraDeProtecao: false,
    });
    expect(nivelDo("sintomas_depressivos", 2, 2).nivel).toBe("baixo");
    expect(nivelDo("sintomas_depressivos", 4, 3)).toEqual({
      nivel: "critico",
      regraDeProtecao: false,
    });
  });

  it("compara a pessoa com o grupo com folga de 0,5", () => {
    expect(compararEscore(3.6, 3)).toBe("acima");
    expect(compararEscore(3.5, 3)).toBe("na_media");
    expect(compararEscore(2.4, 3)).toBe("abaixo");
    expect(compararEscore(2.5, 3)).toBe("na_media");
  });
});

describe("resultado do grupo", () => {
  // Três pessoas: posição 3 em tudo (intermediário), com ajustes.
  const r = calcularNr1([
    resposta(3, {
      ...naDimensao("exigencias_quantitativas", 5),
      ...naDimensao("apoio_social_colegas", 1),
      Q73: 2,
    }),
    resposta(3, {
      ...naDimensao("exigencias_quantitativas", 5),
      Q74: 4,
    }),
    resposta(3, naDimensao("exigencias_quantitativas", 1)),
  ]);
  const dim = (id: string) => r.dimensoes.find((d) => d.id === id)!;

  it("distribui as pessoas e calcula severidade, prevalência e nível", () => {
    const q = dim("exigencias_quantitativas");
    expect(q.pessoas).toBe(3);
    expect(q.escore).toBe(3.67);
    expect(q.tercil).toBe(3);
    expect(q.faixa).toBe("risco");
    expect(q.distribuicao).toEqual({
      risco: 2,
      intermediario: 0,
      favoravel: 1,
    });
    expect(q.percentuais.risco).toBe(66.7);
    expect(q.severidade).toBe(3);
    // 3 pessoas (< 10) com alguém em risco → prevalência 3.
    expect(q.prevalencia).toBe(3);
    expect(q.nivel).toBe("alto");

    const colegas = dim("apoio_social_colegas");
    expect(colegas.escore).toBe(2.33);
    expect(colegas.distribuicao.risco).toBe(1);
    expect(colegas.severidade).toBe(3);
    expect(colegas.nivel).toBe("alto");

    const ritmo = dim("ritmo_trabalho");
    expect(ritmo.distribuicao.intermediario).toBe(3);
    expect(ritmo.prevalencia).toBe(2);
    expect(ritmo.severidade).toBe(2);
    expect(ritmo.nivel).toBe("baixo");
  });

  it("conta os níveis, monta a matriz e ordena as prioridades", () => {
    expect(r.niveis.alto).toBe(r.precisamDeAcao - r.niveis.critico);
    expect(
      r.niveis.critico + r.niveis.alto + r.niveis.medio + r.niveis.baixo,
    ).toBe(29);
    expect(r.prioridades.slice(0, 2)).toEqual([
      "exigencias_quantitativas",
      "apoio_social_colegas",
    ]);
    // Severidade 3 (2ª linha), prevalência 3 (3ª coluna).
    expect(r.matriz[1]![2]).toEqual([
      "exigencias_quantitativas",
      "apoio_social_colegas",
    ]);
    expect(r.matriz.flat(2)).toHaveLength(29);
  });

  it("resume os domínios e os indicadores de saúde", () => {
    const exig = r.dominios.find((d) => d.id === "exigencias_laborais")!;
    expect(exig.dimensoes).toBe(4);
    expect(exig.precisamDeAcao).toBe(1);
    expect(exig.percentualEmRisco).toBe(16.7);
    expect(r.saude.map((s) => s.id)).toEqual([
      "burnout",
      "stress",
      "problemas_dormir",
      "sintomas_depressivos",
      "saude_geral",
    ]);
    expect(r.saude[0]).toEqual({
      id: "burnout",
      pessoasEmRisco: 0,
      pessoas: 3,
      percentualEmRisco: 0,
      nivel: "baixo",
    });
  });

  it("conta comportamentos ofensivos por tipo e quem relatou", () => {
    expect(r.ofensivos.pessoas).toBe(3);
    // Posição 3 em tudo = "às vezes" para todos.
    expect(r.ofensivos.relataram).toBe(3);
    expect(r.ofensivos.tipos[0]).toEqual({
      id: "Q73",
      raramente: 1,
      asVezes: 2,
      frequentementeOuSempre: 0,
      relataram: 3,
    });
    expect(r.ofensivos.tipos[1]!.frequentementeOuSempre).toBe(1);
  });

  it("esconde contagens abaixo do sigilo (menos de N pessoas)", () => {
    const s = calcularNr1(
      [resposta(1, { Q73: 2 }), resposta(1), resposta(1), resposta(1)],
      { sigilo: 3 },
    );
    expect(s.ofensivos.relataram).toBeNull();
    expect(s.ofensivos.percentual).toBeNull();
    expect(s.ofensivos.tipos[0]!.raramente).toBeNull();
    expect(s.ofensivos.tipos[0]!.asVezes).toBe(0);
    const t = calcularNr1(
      [
        resposta(1, { Q73: 2 }),
        resposta(1, { Q73: 2 }),
        resposta(1, { Q73: 2 }),
      ],
      { sigilo: 3 },
    );
    expect(t.ofensivos.relataram).toBe(3);
    expect(t.ofensivos.percentual).toBe(100);
  });

  it("sem respostas: dimensões vazias e nenhum nível", () => {
    const v = calcularNr1([]);
    expect(v.respostas).toBe(0);
    expect(v.dimensoes[0]!.escore).toBeNull();
    expect(v.dimensoes[0]!.nivel).toBeNull();
    expect(v.prioridades).toEqual([]);
    expect(v.dominios[0]!.percentualEmRisco).toBeNull();
  });

  it("pressão e recursos são as médias dos escores", () => {
    const pr = pressaoERecursos(r);
    // Quantitativas 3,67; ritmo, cognitivas e emocionais 3.
    expect(pr.pressao).toBe(3.17);
    // Colegas 2,33; os outros quatro 3.
    expect(pr.recursos).toBe(2.87);
  });

  it("desempata a prioridade pelo nome", () => {
    const base = r.dimensoes.map((d) => ({ ...d, nivel: "baixo" as const }));
    const ordem = ordenarPrioridades(
      base.map((d) => ({
        ...d,
        percentuais: { ...d.percentuais, risco: 0 },
        severidade: 1 as const,
      })),
    );
    expect(ordem[0]).toBe("apoio_social_colegas");
  });
});

describe("escala de saúde: 5 = Excelente, com as pesquisas já gravadas", () => {
  /** As seções com o Q64 configurado (nova: decrescente; antiga: sem). */
  function secoesCom(config: Record<string, unknown>): Secao[] {
    return [
      {
        id: "s1",
        titulo: null,
        descricao: null,
        perguntas: ITENS_NR1.map((i) => ({
          id: `p-${i.id}`,
          chave: i.id,
          tipo: "escala" as const,
          texto: i.id,
          rotulo: null,
          descricao: null,
          obrigatoria: true,
          config:
            i.id === "Q64"
              ? config
              : {
                  minimo: 1,
                  maximo: 5,
                  rotulos: [...ROTULOS_DA_ESCALA[i.escala]],
                },
          condicao: null,
        })),
      },
    ];
  }
  const NOVA = secoesCom({
    minimo: 1,
    maximo: 5,
    rotulos: [...ROTULOS_DA_ESCALA.saude],
    decrescente: true,
  });
  const ANTIGA = secoesCom({
    minimo: 1,
    maximo: 5,
    rotulos: [...ROTULOS_DA_SAUDE_LEGADA],
  });
  const respostaCom = (q64: number) => ({
    valores: new Map<string, unknown>(
      ITENS_NR1.map((i) => [`p-${i.id}`, i.id === "Q64" ? q64 : 3]),
    ),
  });

  it("reconhece a pesquisa gravada antes da mudança pela configuração do Q64", () => {
    expect(saudeLegadaDe(NOVA)).toBe(false);
    expect(saudeLegadaDe(ANTIGA)).toBe(true);
    // A ordem dos rótulos decide (a exibição decrescente é só visual).
    expect(
      saudeLegadaDe(
        secoesCom({
          minimo: 1,
          maximo: 5,
          rotulos: [...ROTULOS_DA_ESCALA.saude],
        }),
      ),
    ).toBe(false);
    // Sem o item (estrutura incompleta): a regra nova.
    expect(saudeLegadaDe([])).toBe(false);
  });

  it("a mesma saúde dá o mesmo escore nas duas orientações", () => {
    // "Excelente": posição 5 na nova, posição 1 na antiga.
    const nova = calcularNr1DoModelo(NOVA, [respostaCom(5)]);
    const antiga = calcularNr1DoModelo(ANTIGA, [respostaCom(1)]);
    const saude = (r: typeof nova) =>
      r.dimensoes.find((d) => d.id === "saude_geral")!;
    expect(saude(nova).escore).toBe(5);
    expect(saude(antiga).escore).toBe(5);
    expect(saude(nova).faixa).toBe("favoravel");
    // "Fraca": posição 1 na nova é risco (proteção baixa).
    const fraca = calcularNr1DoModelo(NOVA, [respostaCom(1)]);
    expect(saude(fraca).escore).toBe(1);
    expect(saude(fraca).faixa).toBe("risco");
    expect(saude(calcularNr1DoModelo(ANTIGA, [respostaCom(5)])).faixa).toBe(
      "risco",
    );
  });
});

describe("comportamentos ofensivos: sigilo complementar por tipo", () => {
  /** Respostas com a posição de Q73 de cada pessoa. */
  const comQ73 = (...posicoes: number[]) =>
    calcularNr1(
      posicoes.map((v) => resposta(1, { Q73: v })),
      { sigilo: 3 },
    ).ofensivos.tipos[0]!;

  it("uma frequência só abaixo do sigilo esconde também a menor visível", () => {
    // Raramente 1 (oculta), às vezes 3, frequentemente 4: sem a regra, o 1
    // sairia por subtração (8 − 3 − 4).
    const t = comQ73(2, 3, 3, 3, 4, 4, 4, 4);
    expect(t.relataram).toBe(8);
    expect(t.raramente).toBeNull();
    expect(t.asVezes).toBeNull();
    expect(t.frequentementeOuSempre).toBe(4);
  });

  it("duas frequências ocultas ou nenhuma: nada a mais some", () => {
    const duas = comQ73(2, 3, 4, 4, 4);
    expect(duas.relataram).toBe(5);
    expect(duas.raramente).toBeNull();
    expect(duas.asVezes).toBeNull();
    expect(duas.frequentementeOuSempre).toBe(3);
    const nenhuma = comQ73(2, 2, 2, 3, 3, 3);
    expect(nenhuma.raramente).toBe(3);
    expect(nenhuma.asVezes).toBe(3);
    expect(nenhuma.frequentementeOuSempre).toBe(0);
  });

  it("o zero não protege: esconde a menor contagem positiva", () => {
    // Raramente 2 (oculta), às vezes 0, frequentemente 3.
    const t = comQ73(2, 2, 4, 4, 4);
    expect(t.relataram).toBe(5);
    expect(t.raramente).toBeNull();
    expect(t.asVezes).toBe(0);
    expect(t.frequentementeOuSempre).toBeNull();
  });

  it("sem sigilo (identificada) e com o total oculto: nada muda", () => {
    const semSigilo = calcularNr1([
      resposta(1, { Q73: 2 }),
      resposta(1, { Q73: 3 }),
      resposta(1, { Q73: 3 }),
      resposta(1, { Q73: 3 }),
    ]).ofensivos.tipos[0]!;
    expect(semSigilo.raramente).toBe(1);
    expect(semSigilo.asVezes).toBe(3);
    const poucos = comQ73(2, 3);
    expect(poucos.relataram).toBeNull();
    expect(poucos.raramente).toBeNull();
    expect(poucos.asVezes).toBeNull();
    expect(poucos.frequentementeOuSempre).toBe(0);
  });
});

describe("resultado individual", () => {
  it("prevalência pela faixa da pessoa e comparação com o time", () => {
    const time = calcularNr1([resposta(3), resposta(3)]);
    const p = individualNr1(
      resposta(3, {
        ...naDimensao("burnout", 5),
        ...naDimensao("sintomas_depressivos", 4),
        Q76: 5,
      }).valores,
      time,
    );
    const burnout = p.dimensoes.find((d) => d.id === "burnout")!;
    expect(burnout.faixa).toBe("risco");
    expect(burnout.prevalencia).toBe(4);
    expect(burnout.severidade).toBe(4);
    expect(burnout.nivel).toBe("critico");
    expect(burnout.comparacao).toBe("acima");
    const dep = p.dimensoes.find((d) => d.id === "sintomas_depressivos")!;
    expect(dep.prevalencia).toBe(4);
    expect(dep.nivel).toBe("critico");
    const ritmo = p.dimensoes.find((d) => d.id === "ritmo_trabalho")!;
    expect(ritmo.prevalencia).toBe(2);
    expect(ritmo.comparacao).toBe("na_media");
    expect(p.niveis.critico).toBeGreaterThanOrEqual(1);
    expect(p.ofensivos[3]).toEqual({ id: "Q76", resposta: 5 });
  });

  it("sem time: sem comparação", () => {
    const p = individualNr1(resposta(1).valores, null);
    expect(p.dimensoes[0]!.escoreDoTime).toBeNull();
    expect(p.dimensoes[0]!.comparacao).toBeNull();
    expect(p.dimensoes[0]!.prevalencia).toBe(1);
  });
});
