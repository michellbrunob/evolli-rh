/**
 * T216 — Pulso e Clima: a planilha com as abas do modelo (no lugar das
 * genéricas de 0 a 10) e o relatório imprimível próprio, com o score de 0 a
 * 100 e as faixas do modelo. Dados sintéticos.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  AfirmacaoDoModelo,
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadoPulsoClima,
  ResultadoPergunta,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { lerAbasXlsx } from "../../../pessoas/importacao/planilhaXlsx";
import type { RelatorioCarregado } from "../../carregarRelatorio";
import {
  ANALISES,
  DETALHE,
  RESPOSTA_DETALHE,
  RESPOSTAS,
  RESULTADOS,
} from "../../dadosDeTeste";
import { montarRelatorio } from "../../dadosDoRelatorio";
import { estadoDoModelo, perguntasEmOrdem } from "../../estadoDaPesquisa";
import { planilhaDosResultados } from "../../exportarResultados";
import { planilhaPropriaDoModelo } from "../exportacao";
import { alertaDaAfirmacao, zonaDaMedia } from "./exportarPulsoClima";
import { DocumentoPulsoClima } from "./RelatorioPulsoClima";
import { DocumentoDaResposta } from "../../RelatorioImprimivel";

const HOJE = "2026-11-27";

const detalhe: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "pulso_clima",
  identificacao: "anonima",
  participantes: null,
  secoes: [...estadoDoModelo("pulso_clima").secoes],
};
const todas = perguntasEmOrdem(detalhe.secoes);
const id = (chave: string) => todas.find((p) => p.chave === chave)!.id;
const afirmacoes = todas.filter((p) => p.tipo === "concordancia");

/** Todas em 3,67 (5, 2, 4); a 1ª da Liderança em 2,33 (alerta alto). */
const afirmacao = (chave: string, dimensao: string): AfirmacaoDoModelo =>
  chave === "pc_lid_01"
    ? {
        chave,
        perguntaId: id(chave),
        dimensao,
        subdimensao: null,
        respostas: 3,
        media: 2.33,
        score: 33,
        favoravel: 33,
        neutro: 0,
        desfavoravel: 67,
      }
    : {
        chave,
        perguntaId: id(chave),
        dimensao,
        subdimensao: null,
        respostas: 3,
        media: 3.67,
        score: 67,
        favoravel: 67,
        neutro: 0,
        desfavoravel: 33,
      };

const DIMENSAO_DA_CHAVE: Readonly<Record<string, string>> = {
  ae: "alinhamento_estrategia",
  lid: "lideranca",
  amb: "ambiente_colaboracao",
  cond: "condicoes",
  inov: "inovacao",
  desv: "desenvolvimento",
  rec: "reconhecimento",
  bem: "bem_estar",
};

const r: ResultadoPulsoClima = {
  modelo: "pulso_clima",
  score: 65,
  faixa: "atencao",
  favoravel: 65,
  neutro: 0,
  desfavoravel: 35,
  dimensoes: [
    {
      chave: "alinhamento_estrategia",
      rotulo: "Alinhamento e Estratégia",
      afirmacoes: 3,
      respostas: 9,
      score: 67,
      faixa: "atencao",
      favoravel: 67,
      neutro: 0,
      desfavoravel: 33,
      comentarios: 0,
    },
    {
      chave: "lideranca",
      rotulo: "Liderança",
      afirmacoes: 4,
      respostas: 12,
      score: 58,
      faixa: "atencao",
      favoravel: 58,
      neutro: 0,
      desfavoravel: 42,
      comentarios: 1,
    },
  ],
  afirmacoes: afirmacoes.map((p) =>
    afirmacao(p.chave!, DIMENSAO_DA_CHAVE[p.chave!.split("_")[1]!]!),
  ),
  enps: {
    perguntaId: id("pc_enps_01"),
    respostas: 3,
    promotores: 1,
    neutros: 1,
    detratores: 1,
    indice: 0,
    faixa: "em_ajuste",
    distribuicao: Array.from({ length: 11 }, (_, valor) => ({
      valor,
      quantidade: [3, 8, 10].includes(valor) ? 1 : 0,
    })),
  },
  lnps: {
    perguntaId: id("pc_lnps_01"),
    respostas: 3,
    promotores: 2,
    neutros: 0,
    detratores: 1,
    indice: 33,
    faixa: "bom",
    distribuicao: Array.from({ length: 11 }, (_, valor) => ({
      valor,
      quantidade: valor === 10 ? 2 : valor === 2 ? 1 : 0,
    })),
  },
  comentarios: [
    {
      dimensao: "lideranca",
      perguntaId: id("__comentario_lideranca__"),
      quantidade: 1,
      textos: [{ texto: "Mais retorno", mes: "2026-11", departamento: null }],
    },
  ],
};

const perguntas: ResultadoPergunta[] = afirmacoes.map((p) => ({
  perguntaId: p.id,
  tipo: "concordancia",
  respondidas: 3,
  viram: 3,
  media: 3.67,
  distribuicao: [1, 2, 3, 4, 5].map((valor) => ({
    valor,
    quantidade: valor === 2 || valor >= 4 ? 1 : 0,
  })),
}));
const geral: ResultadosPesquisa = {
  ...RESULTADOS,
  respostas: 3,
  perguntas,
  modelo: r,
};

const resposta = (numero: number, nota: number): RespostaDetalhe => ({
  ...RESPOSTA_DETALHE,
  id: `r-${numero}`,
  numero,
  nome: null,
  valores: [
    ...afirmacoes.map((p) => ({
      perguntaId: p.id,
      valor: nota,
      mediaTime: 3.67,
    })),
    { perguntaId: id("pc_enps_01"), valor: 10, mediaTime: 7 },
  ],
});

function carregado(
  extra: Partial<{
    analises: typeof ANALISES | null;
    geral: ResultadosPesquisa;
  }> = {},
): RelatorioCarregado {
  const g = extra.geral ?? geral;
  return {
    detalhe,
    geral: g,
    empresa: "Empresa Alfa",
    lista: RESPOSTAS,
    rel: montarRelatorio({
      detalhe,
      geral: g,
      empresa: "Empresa Alfa",
      hoje: HOJE,
      respostas: RESPOSTAS,
      analises: extra.analises ?? null,
    }),
  };
}

describe("T216 — Pulso e Clima: planilha do modelo", () => {
  it("abas do modelo no lugar das genéricas", async () => {
    const c = carregado();
    const abas = await lerAbasXlsx(
      planilhaDosResultados(c.rel, detalhe, geral, [
        resposta(1, 5),
        resposta(2, 2),
      ]),
    );
    expect(Object.keys(abas)).toEqual([
      "Dimensões",
      "Visão geral",
      "Resultados por pergunta",
      "eNPS e LNPS",
      "Respondentes x Perguntas",
      "Matriz de distribuição",
      "Ranking",
      "Alertas",
      "Comentários",
      "Metodologia",
    ]);
    const dim = abas["Dimensões"]!;
    // Os valores saem como número (percentual em fração).
    expect(dim[5]).toEqual([
      "Liderança",
      "58",
      "Atenção",
      "12",
      "4",
      "0.58",
      "0",
      "0.42",
    ]);
    expect(dim[6]!.slice(0, 3)).toEqual(["Score geral", "65", "Atenção"]);
    expect(dim.find((l) => l[0] === "eNPS · empresa")!.slice(0, 3)).toEqual([
      "eNPS · empresa",
      "0",
      "Em ajuste",
    ]);
    // Nada de média de 0 a 10.
    expect(JSON.stringify(abas)).not.toContain("0 a 10)");
  });

  it("resultados por pergunta: média de 1 a 5, as notas e a zona", async () => {
    const abas = await lerAbasXlsx(
      planilhaDosResultados(carregado().rel, detalhe, geral, null),
    );
    const linhas = abas["Resultados por pergunta"]!;
    expect(linhas[3]).toEqual([
      "#",
      "Afirmação",
      "Dimensão",
      "Respostas",
      "Média",
      "Favorável",
      "Neutro",
      "Desfavorável",
      "1",
      "2",
      "3",
      "4",
      "5",
      "Zona",
    ]);
    expect(linhas[4]![2]).toBe("Alinhamento e Estratégia");
    expect(linhas[4]!.slice(3)).toEqual([
      "3",
      "3.67",
      "0.67",
      "0",
      "0.33",
      "0",
      "1",
      "0",
      "1",
      "1",
      "Neutra",
    ]);
    // Sem as respostas completas, não há a aba Respondentes × perguntas.
    expect(abas["Respondentes x Perguntas"]).toBeUndefined();
    expect(linhas[1]![0]).toContain("Empresa Alfa");
    expect(JSON.stringify(linhas)).not.toContain("{empresa}");
  });

  it("respondentes × perguntas com a média e o % favorável", async () => {
    const abas = await lerAbasXlsx(
      planilhaDosResultados(carregado().rel, detalhe, geral, [
        resposta(2, 2),
        resposta(1, 5),
      ]),
    );
    const linhas = abas["Respondentes x Perguntas"]!;
    expect(linhas[4]![0]).toBe("Resposta #1");
    expect(linhas[4]![1]).toBe("5");
    expect(linhas[5]![0]).toBe("Resposta #2");
    expect(linhas.at(-2)![0]).toBe("Média por pergunta");
    expect(linhas.at(-1)![1]).toBe("0.67");
  });

  it("ranking, alertas e comentários", async () => {
    const abas = await lerAbasXlsx(
      planilhaDosResultados(carregado().rel, detalhe, geral, null),
    );
    const alertas = abas["Alertas"]!;
    expect(alertas[4]![0]).toBe("Alto");
    expect(alertas[4]![1]).toMatch(/^4\. /);
    // As outras 21 (33% desfavoráveis) ficam em atenção.
    expect(alertas.filter((l) => l[0] === "Atenção")).toHaveLength(21);
    const ranking = abas["Ranking"]!;
    const atencao = ranking.findIndex(
      (l) => l[0] === "5 pontos que mais pedem atenção",
    );
    expect(ranking[atencao + 2]!.slice(2, 4)).toEqual(["2.33", "0.67"]);
    expect(abas["Comentários"]![4]).toEqual([
      "Liderança",
      "11/2026",
      "Oculto",
      "Mais retorno",
    ]);
  });

  it("com recorte: o score de cada dimensão por grupo; oculto abaixo do mínimo", async () => {
    // O mapa do recorte, nas perguntas da pesquisa (média 1–5 × 2).
    const analises = {
      ...ANALISES,
      colunas: afirmacoes.map((p) => ({
        perguntaId: p.id,
        rotulo: p.rotulo ?? "",
      })),
      linhas: [
        {
          grupoId: null,
          nome: "Toda a empresa",
          respostas: 3,
          visivel: true,
          media: 7.33,
          medias: afirmacoes.map(() => 7.34),
        },
        {
          grupoId: "d-1",
          nome: "Operações",
          respostas: 1,
          visivel: false,
          media: null,
          medias: afirmacoes.map(() => null),
        },
      ],
    };
    const c = carregado({ analises });
    const abas = await lerAbasXlsx(
      planilhaDosResultados(c.rel, detalhe, geral, null),
    );
    const grupo = abas["Por departamento"]!;
    expect(grupo[3]!.slice(0, 5)).toEqual([
      "Departamento",
      "Respostas",
      "Score geral",
      "Classificação",
      "Alinhamento e Estratégia",
    ]);
    expect(grupo[4]!.slice(0, 5)).toEqual([
      "Toda a empresa",
      "3",
      "67",
      "Atenção",
      "67",
    ]);
    expect(grupo[5]).toEqual([
      "Operações",
      "1",
      "Oculto · menos de 3 respostas",
    ]);
  });

  it("sem o resultado do modelo ou com números ocultos: volta às abas comuns", () => {
    const c = carregado({ geral: { ...geral, modelo: null } });
    expect(planilhaPropriaDoModelo(c.rel, detalhe, c.geral, null)).toBeNull();
    const ocultos = { ...carregado().rel, numerosOcultos: true };
    expect(planilhaPropriaDoModelo(ocultos, detalhe, geral, null)).toBeNull();
    expect(
      planilhaPropriaDoModelo(carregado().rel, detalhe, geral, null),
    ).not.toBeNull();
  });

  it("confidencial: sem a aba Respondentes × perguntas, mesmo com respostas", async () => {
    const conf = { ...detalhe, identificacao: "confidencial" as const };
    const abas = await lerAbasXlsx(
      planilhaDosResultados(carregado().rel, conf, geral, [resposta(1, 5)]),
    );
    expect(abas["Respondentes x Perguntas"]).toBeUndefined();
    expect(abas["Dimensões"]).toBeDefined();
  });

  it("zona e alerta pelas regras do modelo", () => {
    expect([4, 3.99, 3, 2.99, null].map(zonaDaMedia)).toEqual([
      "Favorável",
      "Neutra",
      "Neutra",
      "Desfavorável",
      "—",
    ]);
    expect(alertaDaAfirmacao({ media: 4, desfavoravel: 50 })).toBe("alto");
    expect(alertaDaAfirmacao({ media: 2.49, desfavoravel: 0 })).toBe("alto");
    expect(alertaDaAfirmacao({ media: 4, desfavoravel: 30 })).toBe("atencao");
    expect(alertaDaAfirmacao({ media: 2.99, desfavoravel: 0 })).toBe("atencao");
    expect(alertaDaAfirmacao({ media: 3, desfavoravel: 29 })).toBeNull();
    expect(alertaDaAfirmacao({ media: null, desfavoravel: null })).toBeNull();
  });
});

describe("T216 — Pulso e Clima: relatório imprimível do modelo", () => {
  it("capa com score, eNPS e LNPS; dimensões da mais baixa para a mais alta", () => {
    render(<DocumentoPulsoClima carregado={carregado()} r={r} />);
    expect(
      screen.getByRole("heading", { level: 1, name: detalhe.nome }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("PULSO E CLIMA · NOVEMBRO DE 2026"),
    ).toBeInTheDocument();
    const dims = screen.getByRole("table", { name: "Resultado por dimensão" });
    expect(
      within(dims)
        .getAllByRole("row")
        .slice(1)
        .map((l) => l.textContent),
    ).toEqual([
      "Liderança58Atenção58%0%42%",
      "Alinhamento e Estratégia67Atenção67%0%33%",
    ]);
    expect(
      screen.getByRole("table", { name: "eNPS · empresa" }),
    ).toHaveTextContent("Índice (−100 a 100)0 · Em ajuste");
    expect(
      screen.getByRole("table", { name: "LNPS · liderança direta" }),
    ).toHaveTextContent("Promotores (9 e 10)2 · 67%");
    expect(screen.getByRole("table", { name: "Alertas" })).toHaveTextContent(
      "Alto",
    );
    expect(screen.getByRole("region", { name: "Liderança" })).toHaveTextContent(
      "“Mais retorno”",
    );
    expect(
      screen.getByText(/A média de 1 a 5 de cada afirmação vira score/),
    ).toBeInTheDocument();
    // Nunca a média de 0 a 10 ("/10"; "/100" é o score).
    expect(document.body).not.toHaveTextContent(/\/10(?!0)/);
  });

  it("sem o resultado do modelo, os números ficam ocultos", () => {
    render(<DocumentoPulsoClima carregado={carregado()} r={null} />);
    expect(screen.getAllByText("Números ocultos").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("table", { name: "Resultado por dimensão" }),
    ).toBeNull();
  });
});

describe("T216 — Pulso e Clima: PDF de uma resposta", () => {
  it("a capa traz o score 0–100, as dimensões e as notas de recomendação", () => {
    render(
      <DocumentoDaResposta
        detalhe={detalhe}
        resposta={{
          ...resposta(1, 4),
          modelo: {
            modelo: "pulso_clima",
            score: 73,
            faixa: "saudavel",
            scoreTime: 50,
            favoraveis: 21,
            neutras: 0,
            desfavoraveis: 1,
            dimensoes: [
              {
                chave: "lideranca",
                rotulo: "Liderança",
                score: 63,
                faixa: "atencao",
                scoreTime: 50,
              },
            ],
            distribuicao: [],
            enps: { nota: 9, indiceTime: 33 },
            lnps: { nota: null, indiceTime: 0 },
            comentarios: [],
          },
        }}
        empresa="Empresa Alfa"
        hoje={HOJE}
      />,
    );
    expect(screen.getByText("Score da resposta")).toBeInTheDocument();
    expect(
      screen.getByText("23 pontos acima do time (50)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Dimensões da resposta" }),
    ).toHaveTextContent("Liderançatime 5063");
    const rec = screen.getByRole("list", { name: "Recomendação da resposta" });
    expect(rec).toHaveTextContent("eNPS · empresaPromotor · time +339");
    expect(rec).toHaveTextContent("LNPS · liderança diretasem nota—");
    expect(screen.queryByText("Média das respostas")).toBeNull();
  });
});
