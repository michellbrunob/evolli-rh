/**
 * T216 — regras puras de Pesquisas: modelos (contagem única, 11 tipos,
 * condições válidas), operações sobre perguntas, a exportação que respeita a
 * identificação e as contas dos indicadores.
 */
import { describe, expect, it } from "vitest";
import { DETALHE, RESPOSTA_DETALHE, RESULTADOS } from "./dadosDeTeste";
import {
  duplicarSecao,
  entradaDoEstado,
  estadoDoModelo,
  excluirPergunta,
  moverPergunta,
  perguntasEmOrdem,
  validarEtapa,
  validarPerguntas,
} from "./estadoDaPesquisa";
import { montarRelatorio } from "./dadosDoRelatorio";
import {
  linhasDoResumo,
  planilhaDosResultados,
  textoDoValor,
} from "./exportarResultados";
import { lerAbasXlsx } from "../pessoas/importacao/planilhaXlsx";
import {
  faixaDaMedia10,
  faixasDe,
  favoravelDe,
  indicadoresDe,
  limitesDasFaixas,
  mediaNa10,
  zonaDoEnps,
} from "./indicadores";
import {
  MODELOS_DE_PESQUISA,
  ROTEIROS_PERSONALIZADOS,
  secoesDoModelo,
  totalDePerguntas,
} from "./modelosDePesquisa";

describe("modelos de pesquisa", () => {
  const TODOS = [...MODELOS_DE_PESQUISA, ...ROTEIROS_PERSONALIZADOS];

  it("a galeria tem os 12 modelos, na ordem dos cards, em 4 categorias (6, 2, 2, 2)", () => {
    expect(MODELOS_DE_PESQUISA.map((m) => m.id)).toEqual([
      "pulso",
      "pulso_clima",
      "clima",
      "enps",
      "onboarding",
      "tad",
      "copsoq",
      "isfb",
      "avaliacao90",
      "avaliacao180",
      "disc",
      "personalizada",
    ]);
    const conta = (c: string) =>
      MODELOS_DE_PESQUISA.filter((m) => m.categoria === c).length;
    expect([
      conta("clima"),
      conta("saude"),
      conta("desempenho"),
      conta("outros"),
    ]).toEqual([6, 2, 2, 2]);
    expect(new Set(MODELOS_DE_PESQUISA.map((m) => m.modelo)).size).toBe(12);
  });

  it("selos e fatos dos cards", () => {
    const m = (id: string) => MODELOS_DE_PESQUISA.find((x) => x.id === id)!;
    expect(m("pulso_clima").selo).toBe("novo");
    expect(m("onboarding").selo).toBe("novo");
    expect(m("copsoq").selo).toBe("nr1");
    expect(m("isfb").selo).toBe("complementa_nr1");
    expect(m("pulso").selo).toBeUndefined();
    expect(m("pulso").fatos.map((f) => f.texto)).toEqual([
      "5 perguntas",
      "Escala 1–10",
    ]);
    expect(m("pulso_clima").fatos.map((f) => f.texto)).toEqual([
      "24 perguntas",
      "8 dimensões",
    ]);
    expect(m("tad").fatos.map((f) => f.texto)).toEqual([
      "21 perguntas",
      "3 pilares",
    ]);
  });

  it("a contagem do card bate com as perguntas geradas (sem os comentários por dimensão)", () => {
    for (const m of TODOS.filter((x) => x.secoes.length > 0)) {
      const geradas = perguntasEmOrdem(secoesDoModelo(m)).filter(
        (p) => !p.chave?.startsWith("__comentario_"),
      );
      expect(geradas).toHaveLength(totalDePerguntas(m));
    }
    // Sem as perguntas no catálogo (outras frentes): a soma dos grupos.
    const riscos = MODELOS_DE_PESQUISA.find((m) => m.id === "copsoq")!;
    expect(totalDePerguntas(riscos)).toBe(76);
    const financeira = MODELOS_DE_PESQUISA.find((m) => m.id === "isfb")!;
    expect(totalDePerguntas(financeira)).toBe(18);
  });

  it("juntos usam os 13 tipos de pergunta", () => {
    const tipos = new Set(
      TODOS.flatMap((m) =>
        perguntasEmOrdem(secoesDoModelo(m)).map((p) => p.tipo),
      ),
    );
    for (const t of [
      "concordancia_4",
      "satisfacao_4",
      "escala",
      "nota_0_10",
      "estrelas",
      "sim_nao",
      "multipla_escolha",
      "escolha_unica",
      "paragrafo",
      "texto_curto",
      "concordancia",
    ]) {
      expect(tipos.has(t as never)).toBe(true);
    }
  });

  it("todo modelo com perguntas já passa na validação (condições incluídas)", () => {
    for (const m of TODOS.filter(
      (x) => totalDePerguntas(x) > 0 && x.secoes.length > 0,
    )) {
      const e = estadoDoModelo(m.id);
      expect(validarPerguntas(e)).toEqual({});
    }
    const comCondicao = perguntasEmOrdem(
      estadoDoModelo("onboarding-30").secoes,
    ).filter((p) => p.condicao);
    expect(comCondicao).toHaveLength(1);
  });

  it("Pulso: 5 afirmações de 1 a 10, o eNPS e o comentário curto opcional", () => {
    const p = perguntasEmOrdem(estadoDoModelo("pulso").secoes);
    expect(
      p
        .filter((x) => x.tipo === "escala" && x.config.maximo === 10)
        .map((x) => x.chave),
    ).toEqual([
      "pulso_permanencia",
      "pulso_clareza",
      "pulso_apoio_gestao",
      "pulso_reconhecimento",
      "pulso_orgulho",
    ]);
    expect(
      p.filter((x) => x.tipo === "nota_0_10" && x.config.enps),
    ).toHaveLength(1);
    expect(p.at(-1)).toMatchObject({ tipo: "texto_curto", obrigatoria: false });
  });

  it("Pulso e Clima: 22 afirmações em 8 dimensões, LNPS, eNPS e 10 comentários", () => {
    const e = estadoDoModelo("pulso_clima");
    const p = perguntasEmOrdem(e.secoes);
    expect(p.filter((x) => x.tipo === "concordancia")).toHaveLength(22);
    expect(
      e.secoes
        .slice(0, 8)
        .map(
          (s) => s.perguntas.filter((x) => x.tipo === "concordancia").length,
        ),
    ).toEqual([3, 4, 3, 2, 2, 3, 3, 2]);
    expect(p.find((x) => x.chave === "pc_lnps_01")!.config).toMatchObject({
      lnps: true,
      enps: false,
    });
    expect(p.find((x) => x.chave === "pc_enps_01")!.config).toMatchObject({
      enps: true,
    });
    const comentarios = p.filter((x) => x.chave?.startsWith("__comentario_"));
    expect(comentarios).toHaveLength(10);
    expect(
      comentarios.every((x) => x.tipo === "paragrafo" && !x.obrigatoria),
    ).toBe(true);
    expect(e.nome).toMatch(/^Pulso e Clima – [12]º semestre \d{4}$/);
  });

  it("Clima: 60 afirmações numeradas e 2 abertas", () => {
    const p = perguntasEmOrdem(estadoDoModelo("clima").secoes);
    expect(p).toHaveLength(62);
    expect(p[0]!.chave).toBe("clima_01");
    expect(p[59]!.chave).toBe("clima_60");
    expect(p.slice(60).map((x) => x.chave)).toEqual([
      "clima_aberta_01",
      "clima_aberta_02",
    ]);
  });

  it("TAD: 21 afirmações de 1 a 7 com os 7 rótulos e os pilares 7, 6 e 8", () => {
    const m = MODELOS_DE_PESQUISA.find((x) => x.id === "tad")!;
    const p = perguntasEmOrdem(estadoDoModelo("tad").secoes);
    expect(p).toHaveLength(21);
    expect(
      p.every(
        (x) =>
          x.tipo === "escala" &&
          x.config.maximo === 7 &&
          x.config.rotulos?.length === 7,
      ),
    ).toBe(true);
    expect(m.agrupamento!.map((g) => g.chaves.length)).toEqual([7, 6, 8]);
    expect(
      m.secoes[0]!.perguntas.filter((x) => x.selo === "Invertida"),
    ).toHaveLength(9);
  });

  it("Onboarding: 17 perguntas em 8 blocos, 14 obrigatórias", () => {
    const e = estadoDoModelo("onboarding");
    const p = perguntasEmOrdem(e.secoes);
    expect(e.secoes).toHaveLength(8);
    expect(p).toHaveLength(17);
    expect(p.filter((x) => x.obrigatoria)).toHaveLength(14);
    expect(p.filter((x) => x.tipo === "concordancia_4")).toHaveLength(10);
    expect(p.find((x) => x.chave === "q7")!.tipo).toBe("satisfacao_4");
  });

  it("eNPS: 1 principal, 5 complementares e 2 abertas", () => {
    const e = estadoDoModelo("enps");
    expect(e.secoes.map((s) => s.perguntas.length)).toEqual([1, 5, 2]);
  });

  it("Personalizada: 6 modelos prontos (Integração 1, Desempenho 2, Satisfação 2, Desligamento 1)", () => {
    const conta = (c: string) =>
      ROTEIROS_PERSONALIZADOS.filter((m) => m.categoria === c).length;
    expect(ROTEIROS_PERSONALIZADOS).toHaveLength(6);
    expect([
      conta("integracao"),
      conta("desempenho"),
      conta("satisfacao"),
      conta("saida"),
    ]).toEqual([1, 2, 2, 1]);
    expect(ROTEIROS_PERSONALIZADOS.map((m) => totalDePerguntas(m))).toEqual([
      8, 10, 8, 6, 7, 8,
    ]);
  });

  it("ids novos a cada uso (dois usos não compartilham ids)", () => {
    const a = perguntasEmOrdem(estadoDoModelo("clima").secoes).map((p) => p.id);
    const b = perguntasEmOrdem(estadoDoModelo("clima").secoes).map((p) => p.id);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });
});

describe("operações e validação", () => {
  it("excluir a origem limpa a condição; mover acima dela invalida", () => {
    const e = estadoDoModelo("desligamento");
    const todas = perguntasEmOrdem(e.secoes);
    const origem = todas.find((p) => p.tipo === "sim_nao")!;
    const dependente = todas.find((p) => p.condicao)!;
    const semOrigem = excluirPergunta(e.secoes, origem.id);
    expect(
      perguntasEmOrdem(semOrigem).find((p) => p.id === dependente.id)!.condicao,
    ).toBeNull();
    const movida = moverPergunta(e.secoes, dependente.id, -1);
    expect(Object.keys(validarPerguntas({ ...e, secoes: movida }))).toContain(
      `pergunta:${dependente.id}`,
    );
  });

  it("duplicar a seção mantém a condição dentro da cópia", () => {
    const e = estadoDoModelo("onboarding-30");
    const secao = e.secoes[0]!;
    const copia = duplicarSecao(e.secoes, secao.id)[1]!;
    const [, origem, dependente] = copia.perguntas;
    expect(dependente!.condicao!.perguntaId).toBe(origem!.id);
    expect(copia.titulo).toBe("Sua chegada (cópia)");
  });

  it("a entrada apara textos e manda participantes escolhidos", () => {
    const e = {
      ...estadoDoModelo("enps"),
      nome: "  eNPS  ",
      boasVindas: "   ",
      todos: false,
      escolhidos: { "c-1": { nome: "Ana", departamento: null } },
    };
    const entrada = entradaDoEstado(e);
    expect(entrada.nome).toBe("eNPS");
    expect(entrada.boasVindas).toBeNull();
    expect(entrada.participantes).toEqual({
      todos: false,
      colaboradorIds: ["c-1"],
    });
  });

  it("revisão junta os erros de todas as etapas", () => {
    const e = { ...estadoDoModelo("personalizada"), nome: "" };
    expect(Object.keys(validarEtapa(e, 4, "2026-11-27")).sort()).toEqual([
      "nome",
      "perguntas",
    ]);
  });
});

describe("Exportação e texto das respostas", () => {
  it("o resumo nunca leva autor fora da identificada", () => {
    const resumo = linhasDoResumo(DETALHE, RESULTADOS)
      .map((l) => l.resultado)
      .join(" ");
    expect(resumo).toContain("Mais retorno, por favor.");
    expect(resumo).not.toContain("Pessoa Exemplo");
    expect(resumo).toContain("eNPS 50");
    const ident = linhasDoResumo(
      { ...DETALHE, identificacao: "identificada" },
      RESULTADOS,
    )
      .map((l) => l.resultado)
      .join(" ");
    expect(ident).toContain("Pessoa Exemplo: Mais retorno, por favor.");
  });

  it("planilha: respostas individuais nunca na confidencial", async () => {
    const respostas = [RESPOSTA_DETALHE];
    const planilha = (d: typeof DETALHE) =>
      lerAbasXlsx(
        planilhaDosResultados(
          montarRelatorio({
            detalhe: d,
            geral: RESULTADOS,
            empresa: "Empresa Alfa",
            hoje: "2026-11-27",
          }),
          d,
          RESULTADOS,
          respostas,
        ),
      );
    const conf = await planilha(DETALHE);
    expect(Object.keys(conf)).not.toContain("Participantes");
    const anon = await planilha({ ...DETALHE, identificacao: "anonima" });
    expect(anon["Participantes"]![4]![0]).toBe("Participante 1");
    const ident = await planilha({ ...DETALHE, identificacao: "identificada" });
    expect(ident["Participantes"]![4]!.slice(0, 2)).toEqual([
      "Ana Exemplo",
      "Operações",
    ]);
  });

  it("abaixo do mínimo, o resumo não traz números", () => {
    const vazio = {
      ...RESULTADOS,
      filtro: { departamentoId: "d-2", visivel: false },
      perguntas: [],
    };
    expect(linhasDoResumo(DETALHE, vazio)).toEqual([]);
    const rel = montarRelatorio({
      detalhe: DETALHE,
      geral: vazio,
      empresa: "",
      hoje: "2026-11-27",
    });
    expect(rel.mediaGeral).toBeNull();
    expect(rel.perguntas.every((p) => p.media === null)).toBe(true);
  });

  it("texto das respostas por tipo", () => {
    const [nota, conc, sim, esc] = DETALHE.secoes[0]!.perguntas;
    expect(textoDoValor(nota!, 9)).toBe("9");
    expect(textoDoValor(conc!, 4)).toBe("4 · Concordo");
    expect(textoDoValor(sim!, "nao")).toBe("Não");
    expect(textoDoValor(esc!, { opcao: "o-2" })).toBe("Mensagem");
    expect(textoDoValor(esc!, undefined)).toBe("Sem resposta");
  });
});

describe("indicadores e faixas", () => {
  it("faixas e favorável por escala", () => {
    expect(limitesDasFaixas({ minimo: 1, maximo: 10 })).toEqual({
      baixaAte: 4,
      altaDesde: 8,
    });
    expect(limitesDasFaixas({ minimo: 0, maximo: 10 })).toEqual({
      baixaAte: 4,
      altaDesde: 8,
    });
    expect(limitesDasFaixas({ minimo: 1, maximo: 5 })).toEqual({
      baixaAte: 2,
      altaDesde: 4,
    });
    const f = faixasDe(
      [
        { valor: 2, quantidade: 1 },
        { valor: 6, quantidade: 1 },
        { valor: 9, quantidade: 2 },
      ],
      { minimo: 1, maximo: 10 },
    );
    expect(f).toEqual({ baixa: 1, media: 1, alta: 2 });
    expect(favoravelDe(f)).toBe(50);
  });

  it("zonas do eNPS", () => {
    expect([-1, 0, 49, 50, 74, 75, 100].map(zonaDoEnps)).toEqual([
      "critica",
      "aperfeicoamento",
      "aperfeicoamento",
      "qualidade",
      "qualidade",
      "excelencia",
      "excelencia",
    ]);
  });

  it("média na escala de 0 a 10 e a faixa do mapa", () => {
    expect(mediaNa10(4, { minimo: 1, maximo: 5 })).toBe(8);
    expect(mediaNa10(7, { minimo: 1, maximo: 10 })).toBe(7);
    expect([6.4, 6.5, 7.9, 8].map(faixaDaMedia10)).toEqual([
      "baixa",
      "media",
      "media",
      "alta",
    ]);
  });

  it("indicadores pelo cálculo local deixam o eNPS fora da média", () => {
    const ind = indicadoresDe(DETALHE, RESULTADOS);
    expect(ind.mediaGeral).toBe(8.5);
    expect(ind.perguntasDeEscala).toBe(1);
    expect(ind.enps).toMatchObject({ indice: 50, zona: "qualidade" });
  });
});
