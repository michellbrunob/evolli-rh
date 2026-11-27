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
  secoesDoModelo,
  totalDePerguntas,
} from "./modelosDePesquisa";

describe("modelos de pesquisa", () => {
  it("são 8, com nomes únicos, e a contagem bate com as perguntas geradas", () => {
    expect(MODELOS_DE_PESQUISA).toHaveLength(8);
    expect(new Set(MODELOS_DE_PESQUISA.map((m) => m.modelo)).size).toBe(8);
    for (const m of MODELOS_DE_PESQUISA) {
      expect(perguntasEmOrdem(secoesDoModelo(m))).toHaveLength(
        totalDePerguntas(m),
      );
    }
  });

  it("juntos usam os 11 tipos de pergunta", () => {
    const tipos = new Set(
      MODELOS_DE_PESQUISA.flatMap((m) =>
        perguntasEmOrdem(secoesDoModelo(m)).map((p) => p.tipo),
      ),
    );
    expect(tipos.size).toBe(11);
  });

  it("todo modelo com perguntas já passa na validação (condições incluídas)", () => {
    for (const m of MODELOS_DE_PESQUISA.filter(
      (x) => totalDePerguntas(x) > 0,
    )) {
      const e = estadoDoModelo(m.modelo);
      expect(validarPerguntas(e)).toEqual({});
    }
    const comCondicao = perguntasEmOrdem(
      estadoDoModelo("onboarding").secoes,
    ).filter((p) => p.condicao);
    expect(comCondicao).toHaveLength(1);
  });

  it("o Pulso tem 6 afirmações de 1 a 10, o eNPS e um comentário", () => {
    const p = perguntasEmOrdem(estadoDoModelo("pulso").secoes);
    expect(
      p.filter((x) => x.tipo === "escala" && x.config.maximo === 10),
    ).toHaveLength(6);
    expect(
      p.filter((x) => x.tipo === "nota_0_10" && x.config.enps),
    ).toHaveLength(1);
    expect(p.at(-1)!.tipo).toBe("paragrafo");
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
    const e = estadoDoModelo("onboarding");
    const secao = e.secoes[0]!;
    const copia = duplicarSecao(e.secoes, secao.id)[1]!;
    const [, origem, dependente] = copia.perguntas;
    expect(dependente!.condicao!.perguntaId).toBe(origem!.id);
    expect(copia.titulo).toBe("A chegada (cópia)");
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
