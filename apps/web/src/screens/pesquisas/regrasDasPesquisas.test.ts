/**
 * T216 — regras puras de Pesquisas: modelos (contagem única, 11 tipos,
 * condições válidas, textos neutros), operações sobre perguntas e o CSV que
 * respeita a identificação.
 */
import { describe, expect, it } from "vitest";
import type { PesquisaDetalhe } from "../../api/pesquisasClient";
import { DETALHE, RESULTADOS } from "./dadosDeTeste";
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
import {
  csvDasRespostas,
  csvDoResumo,
  textoDoValor,
} from "./exportarResultados";
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

describe("CSV e texto das respostas", () => {
  it("o resumo nunca leva autor fora da identificada", () => {
    const csv = csvDoResumo(DETALHE, RESULTADOS);
    expect(csv).toContain("Mais retorno, por favor.");
    expect(csv).not.toContain("Pessoa Exemplo");
    expect(csv).toContain("eNPS 50");
    const ident = csvDoResumo(
      { ...DETALHE, identificacao: "identificada" },
      RESULTADOS,
    );
    expect(ident).toContain("Pessoa Exemplo: Mais retorno, por favor.");
  });

  it("CSV por pessoa só existe na identificada", () => {
    const resposta = {
      colaboradorId: "c-1",
      nome: "Ana Exemplo",
      departamento: null,
      respondidaEm: "2026-11-20T12:00:00Z",
      valores: [],
    };
    for (const identificacao of ["confidencial", "anonima"] as const) {
      expect(
        csvDasRespostas({ ...DETALHE, identificacao } as PesquisaDetalhe, [
          resposta,
        ]),
      ).toBeNull();
    }
    expect(
      csvDasRespostas({ ...DETALHE, identificacao: "identificada" }, [
        resposta,
      ]),
    ).toContain("Ana Exemplo");
  });

  it("abaixo do mínimo, o resumo não traz números", () => {
    const csv = csvDoResumo(DETALHE, {
      ...RESULTADOS,
      filtro: { departamentoId: "d-2", visivel: false },
      perguntas: [],
    });
    expect(csv).toContain("Poucas respostas para mostrar");
    expect(csv).not.toContain("eNPS");
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
