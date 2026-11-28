/**
 * T216 — 3ª revisão, exportações gerais (planilha e PDF da Personalizada e
 * do Pulso): quem emitiu e as horas do período, aba por departamento, eNPS
 * por departamento, alertas só críticos, participantes da anônima
 * embaralhados e vazios, rótulos de 1 a 10 e o rótulo do PDF sem partir
 * palavra. Dados sintéticos.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  AnalisesPesquisa,
  Pergunta,
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadosPesquisa,
} from "../../api/pesquisasClient";
import { lerAbasXlsx } from "../pessoas/importacao/planilhaXlsx";
import { carregarRelatorio } from "./carregarRelatorio";
import {
  ANALISES,
  DETALHE,
  RESPOSTA_DETALHE,
  RESPOSTAS,
  servicoFalso,
} from "./dadosDeTeste";
import { montarRelatorio } from "./dadosDoRelatorio";
import {
  embaralharDeFormaEstavel,
  planilhaDosResultados,
} from "./exportarResultados";
import { DocumentoDoRelatorio } from "./RelatorioImprimivel";

const HOJE = "2026-11-27";

const pergunta = (
  id: string,
  tipo: Pergunta["tipo"],
  texto: string,
  extra: Partial<Pergunta> = {},
): Pergunta => ({
  id,
  tipo,
  texto,
  descricao: null,
  obrigatoria: true,
  config: {},
  condicao: null,
  ...extra,
});

const escala10 = { minimo: 1, maximo: 10 };

const PULSO: PesquisaDetalhe = {
  ...DETALHE,
  id: "p-pulso",
  nome: "Pulso sintético",
  modelo: "pulso",
  identificacao: "anonima",
  participantes: null,
  respostas: 4,
  secoes: [
    {
      id: "s-1",
      titulo: null,
      descricao: null,
      perguntas: [
        pergunta("q1", "escala", "Pergunta um sobre permanência.", {
          rotulo: "Permanência",
          config: escala10,
        }),
        pergunta("q2", "escala", "Pergunta dois sobre clareza.", {
          rotulo: "Clareza",
          config: escala10,
        }),
        pergunta("q3", "escala", "Pergunta três sobre apoio.", {
          rotulo: "Apoio",
          config: escala10,
        }),
        pergunta(
          "q-enps",
          "nota_0_10",
          "Recomendaria como lugar para trabalhar?",
          {
            config: { enps: true },
          },
        ),
        pergunta("q-com", "paragrafo", "Algum comentário?", {
          obrigatoria: false,
        }),
      ],
    },
  ],
};

const distribuicao = (pares: [number, number][]) =>
  pares.map(([valor, quantidade]) => ({ valor, quantidade }));

const GERAL: ResultadosPesquisa = {
  pesquisaId: "p-pulso",
  respostas: 4,
  participantes: 0,
  departamentos: [],
  filtro: { departamentoId: null, visivel: true },
  perguntas: [
    {
      perguntaId: "q1",
      tipo: "escala",
      respondidas: 4,
      viram: 4,
      // Média abaixo de 6,5 e só 25% favorável: um alerta só.
      media: 6,
      distribuicao: distribuicao([
        [2, 1],
        [7, 2],
        [8, 1],
      ]),
    },
    {
      perguntaId: "q2",
      tipo: "escala",
      respondidas: 4,
      viram: 4,
      // Média de atenção, mas menos da metade favorável.
      media: 7.25,
      distribuicao: distribuicao([
        [7, 3],
        [8, 1],
      ]),
    },
    {
      perguntaId: "q3",
      tipo: "escala",
      respondidas: 4,
      viram: 4,
      // Média de atenção e metade favorável: sem alerta.
      media: 6.75,
      distribuicao: distribuicao([
        [3, 1],
        [6, 1],
        [9, 2],
      ]),
    },
    {
      perguntaId: "q-enps",
      tipo: "nota_0_10",
      respondidas: 4,
      viram: 4,
      enps: { promotores: 2, neutros: 0, detratores: 2, indice: 0 },
      media: 6.75,
      distribuicao: distribuicao([
        [2, 1],
        [6, 1],
        [9, 1],
        [10, 1],
      ]),
    },
    {
      perguntaId: "q-com",
      tipo: "paragrafo",
      respondidas: 2,
      viram: 4,
      textos: [
        { texto: "Comentário b", autor: null },
        { texto: "Comentário a", autor: null },
      ],
    },
  ],
};

const ANALISES_PULSO: AnalisesPesquisa = {
  campo: "departamento",
  colunas: [
    { perguntaId: "q1", rotulo: "Permanência" },
    { perguntaId: "q2", rotulo: "Clareza" },
    { perguntaId: "q3", rotulo: "Apoio" },
  ],
  linhas: [
    {
      grupoId: null,
      nome: "Toda a empresa",
      respostas: 4,
      visivel: true,
      media: 6.7,
      medias: [6, 7.3, 6.8],
    },
    {
      grupoId: "d-1",
      nome: "Marketing",
      respostas: 3,
      visivel: true,
      media: 7.9,
      medias: [7.7, 7.7, 8.3],
    },
    {
      grupoId: "d-2",
      nome: "Tecnologia",
      respostas: 1,
      visivel: false,
      oculto: "minimo",
      media: null,
      medias: [null, null, null],
    },
    {
      grupoId: "d-3",
      nome: "Vendas",
      respostas: 3,
      visivel: true,
      media: 5.7,
      medias: [5, 6, 6.1],
    },
  ],
  evolucao: [],
};

/** Os números do grupo Marketing (o servidor já filtrado). */
const DO_MARKETING: ResultadosPesquisa = {
  ...GERAL,
  respostas: 3,
  filtro: {
    campo: "departamento",
    grupoId: "d-1",
    departamentoId: null,
    respostas: 3,
    visivel: true,
  } as ResultadosPesquisa["filtro"],
  perguntas: [
    {
      perguntaId: "q1",
      tipo: "escala",
      respondidas: 3,
      viram: 3,
      media: 7.7,
      faixas: { baixa: 0, media: 1, alta: 2 },
      distribuicao: [],
    },
    {
      perguntaId: "q2",
      tipo: "escala",
      respondidas: 3,
      viram: 3,
      media: 7.7,
      faixas: { baixa: 0, media: 1, alta: 2 },
      distribuicao: [],
    },
    {
      perguntaId: "q3",
      tipo: "escala",
      respondidas: 3,
      viram: 3,
      media: 8.3,
      faixas: { baixa: 0, media: 0, alta: 3 },
      distribuicao: [],
    },
    {
      perguntaId: "q-enps",
      tipo: "nota_0_10",
      respondidas: 3,
      viram: 3,
      enps: { promotores: 2, neutros: 0, detratores: 1, indice: 33 },
    },
  ],
};

const relDoPulso = (
  extra: Partial<Parameters<typeof montarRelatorio>[0]> = {},
) =>
  montarRelatorio({
    detalhe: PULSO,
    geral: GERAL,
    empresa: "Empresa Alfa",
    hoje: HOJE,
    respostas: RESPOSTAS,
    analises: ANALISES_PULSO,
    emitidoPor: "Pessoa Emissora",
    porGrupo: new Map([["d-1", DO_MARKETING]]),
    ...extra,
  });

const individual = (
  numero: number,
  valores: [string, unknown][],
): RespostaDetalhe => ({
  ...RESPOSTA_DETALHE,
  id: `r-${numero}`,
  numero,
  nome: null,
  colaboradorId: null,
  departamento: null,
  valores: valores.map(([perguntaId, valor]) => ({
    perguntaId,
    valor: valor as never,
    mediaTime: null,
  })),
});

/** Cinco respostas, a 3ª sem a pergunta 2 (opcional em branco). */
const CINCO = [1, 2, 3, 4, 5].map((n) =>
  individual(
    n,
    n === 3
      ? [
          ["q1", n],
          ["q3", n],
        ]
      : [
          ["q1", n],
          ["q2", n],
          ["q3", n],
        ],
  ),
);

const abasDoPulso = (
  rel = relDoPulso(),
  respostas: RespostaDetalhe[] | null = CINCO,
) => lerAbasXlsx(planilhaDosResultados(rel, PULSO, GERAL, respostas));

describe("R3-A-13 — alertas: só as regras críticas, uma linha por pergunta", () => {
  it("pergunta abaixo de 6,5 (e pouco favorável) vira uma linha só; atenção não entra", () => {
    const perguntas = relDoPulso().alertas.filter((a) => a.onde === "Pergunta");
    expect(perguntas).toEqual([
      {
        severidade: "Alta",
        onde: "Pergunta",
        oQue: "Pergunta um sobre permanência.",
        departamento: "",
        media: 6,
        favoravel: 25,
        respostas: 4,
        motivo: "Média abaixo de 6,5.",
      },
      expect.objectContaining({
        oQue: "Pergunta dois sobre clareza.",
        severidade: "Alta",
        motivo: "Menos da metade das respostas é favorável.",
      }),
    ]);
    expect(relDoPulso().alertas.some((a) => a.severidade === "Média")).toBe(
      false,
    );
  });

  it("grupo: abaixo de 6,5 ou 1 ponto abaixo da empresa; oculto nunca", () => {
    const grupos = relDoPulso().alertas.filter(
      (a) => a.onde === "Departamento",
    );
    expect(grupos.map((a) => [a.oQue, a.motivo])).toEqual([
      ["Vendas", "Média do grupo abaixo de 6,5."],
    ]);
    const acima = (media: number) =>
      relDoPulso({
        analises: {
          ...ANALISES_PULSO,
          linhas: [
            { ...ANALISES_PULSO.linhas[0]!, media: 8.8 },
            { ...ANALISES_PULSO.linhas[1]!, media },
          ],
        },
      }).alertas.filter((a) => a.onde === "Departamento");
    // 8,8 − 7,8 é 1 ponto (sem o erro do ponto flutuante).
    expect(acima(7.8).map((a) => a.motivo)).toEqual([
      "Média do grupo 1 ponto ou mais abaixo da empresa.",
    ]);
    expect(acima(7.9)).toEqual([]);
    // 8,2 − 7,2 dá 0,999… no ponto flutuante: ainda é 1 ponto.
    const comEmpresa = (empresa: number, grupo: number) =>
      relDoPulso({
        analises: {
          ...ANALISES_PULSO,
          linhas: [
            { ...ANALISES_PULSO.linhas[0]!, media: empresa },
            { ...ANALISES_PULSO.linhas[1]!, media: grupo },
          ],
        },
      }).alertas.filter((a) => a.onde === "Departamento");
    expect(comEmpresa(8.2, 7.2)).toHaveLength(1);
    expect(comEmpresa(8.7, 7.7)).toHaveLength(1);
    expect(comEmpresa(8.7, 7.8)).toEqual([]);
  });

  it("planilha: texto da pergunta, departamento vazio e a regra na linha 2", async () => {
    const alertas = (await abasDoPulso())["Alertas"]!;
    expect(alertas[1]![0]).toContain("1 ponto abaixo da empresa");
    expect(alertas[3]![4]).toBe("Média (1 a 10)");
    expect(alertas[4]!.slice(0, 5)).toEqual([
      "Alta",
      "Pergunta",
      "Pergunta um sobre permanência.",
      "",
      "6",
    ]);
  });
});

describe("R3-A-21 e R3-A-20 — quem emitiu, horas no período e escala de 1 a 10", () => {
  it("linha 2 de toda aba: empresa, pesquisa, identificação, data e quem emitiu", async () => {
    const abas = await abasDoPulso();
    for (const nome of ["Resumo", "Perguntas", "eNPS", "Metodologia"])
      expect(abas[nome]![1]![0]).toBe(
        "Empresa Alfa · Pulso sintético · Anônima · emitido em 27/11/2026 por Pessoa Emissora",
      );
    const semNome = await abasDoPulso(relDoPulso({ emitidoPor: null }));
    expect(semNome["Resumo"]![1]![0]).toBe(
      "Empresa Alfa · Pulso sintético · Anônima · emitido em 27/11/2026",
    );
  });

  it("resumo: período com as horas e média de 1 a 10", async () => {
    const resumo = (await abasDoPulso())["Resumo"]!;
    const linha = (r: string) => resumo.find((l) => l[0] === r)!;
    expect(linha("Período das respostas")[1]).toBe(
      "20/11/2026 11:23 a 21/11/2026 09:00",
    );
    expect(linha("Média geral (1 a 10)")[1]).toBe("6.7");
    const perguntas = (await abasDoPulso())["Perguntas"]!;
    expect(perguntas[3]).toContain("Média (1 a 10)");
    expect(JSON.stringify(resumo)).not.toContain("0 a 10");
  });

  it("sem lista de respostas (confidencial), o período fica nos dias", () => {
    expect(relDoPulso({ respostas: null }).periodoComHoras).toMatch(
      /^\d{2}\/\d{2} – \d{2}\/\d{2}\/\d{4}$/,
    );
  });

  it("PDF: rodapé da capa com quem emitiu e as horas; médias de 1 a 10", () => {
    const { container } = render(<DocumentoDoRelatorio rel={relDoPulso()} />);
    const rodape = container.querySelector(".relatorio__capa-rodape")!;
    expect(rodape).toHaveTextContent("Emitido em27/11/2026 · Pessoa Emissora");
    expect(rodape).toHaveTextContent(
      "Período20/11/2026 11:23 a 21/11/2026 09:00",
    );
    expect(screen.getByText("Média de 1 a 10")).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/(média|escala) de 0 a 10/i);
  });

  it("PDF: o rótulo quebra entre palavras, nunca no meio de uma palavra", () => {
    const css = readFileSync(
      resolve(__dirname, "RelatorioImprimivel.css"),
      "utf8",
    );
    const bloco = /\.relatorio__rotulo \{([^}]*)\}/.exec(css)![1]!;
    expect(bloco).toContain("overflow-wrap: break-word");
    expect(bloco).not.toContain("anywhere");
  });
});

describe("R3-A-12 — por departamento e eNPS por departamento", () => {
  it("aba 'Por departamento': a empresa, os grupos e os ocultos", async () => {
    const abas = await abasDoPulso();
    expect(Object.keys(abas)).toEqual([
      "Resumo",
      "Perguntas",
      "eNPS",
      "Participantes",
      "Por departamento",
      "Comentários",
      "Alertas",
      "Metodologia",
    ]);
    const aba = abas["Por departamento"]!;
    expect(aba[0]![0]).toBe("Resultado por departamento");
    expect(aba[3]).toEqual([
      "Departamento",
      "Respostas",
      "Média geral",
      "Favorável",
      "eNPS",
      "Permanência",
      "Clareza",
      "Apoio",
    ]);
    // Favorável da empresa: 4 de 12 notas (33%); do Marketing: 7 de 9.
    expect(aba[4]).toEqual([
      "Toda a empresa",
      "4",
      "6.7",
      "0.33",
      "0",
      "6",
      "7.3",
      "6.8",
    ]);
    expect(aba[5]).toEqual([
      "Marketing",
      "3",
      "7.9",
      "0.78",
      "33",
      "7.7",
      "7.7",
      "8.3",
    ]);
    expect(aba[6]!.slice(0, 3)).toEqual([
      "Tecnologia",
      "1",
      "Oculto · menos de 3 respostas",
    ]);
    // Sem os números do grupo (falha ao carregar): só a média do mapa.
    expect(aba[7]!.slice(0, 5)).toEqual(["Vendas", "3", "5.7", "—", "—"]);
  });

  it("aba eNPS: a tabela por departamento (oculto abaixo do mínimo)", async () => {
    const enps = (await abasDoPulso())["eNPS"]!;
    const i = enps.findIndex(
      (l) => l[0] === "eNPS por departamento (grupos com 3+ respostas)",
    );
    expect(i).toBeGreaterThan(0);
    expect(enps[i + 1]).toEqual([
      "Departamento",
      "Respostas",
      "eNPS",
      "Promotores",
      "Neutros",
      "Detratores",
    ]);
    expect(enps[i + 2]).toEqual(["Marketing", "3", "33", "0.67", "0", "0.33"]);
    expect(enps[i + 3]!.slice(0, 3)).toEqual([
      "Tecnologia",
      "1",
      "Oculto · menos de 3 respostas",
    ]);
    expect(enps[i + 4]!.slice(0, 3)).toEqual(["Vendas", "3", "—"]);
  });

  it("o vizinho oculto para proteger um grupo menor não mostra nem a contagem", async () => {
    const protegido = relDoPulso({
      analises: {
        ...ANALISES_PULSO,
        linhas: ANALISES_PULSO.linhas.map((l) =>
          l.grupoId === "d-3"
            ? {
                ...l,
                visivel: false,
                oculto: "protege_grupo_menor" as const,
                media: null,
                medias: [null, null, null],
              }
            : l,
        ),
      },
    });
    const abas = await abasDoPulso(protegido);
    const vendas = abas["Por departamento"]!.find((l) => l[0] === "Vendas")!;
    expect(vendas.slice(0, 3)).toEqual([
      "Vendas",
      "—",
      "Oculto · protege um grupo menor",
    ]);
    const noEnps = abas["eNPS"]!.filter((l) => l[0] === "Vendas");
    expect(noEnps.map((l) => l.slice(0, 3))).toEqual([
      ["Vendas", "—", "Oculto · protege um grupo menor"],
    ]);
    // Abaixo do mínimo, a contagem aparece (como no mapa).
    expect(
      abas["Por departamento"]!.find((l) => l[0] === "Tecnologia")![1],
    ).toBe("1");
  });

  it("sem recorte, nem a aba nem a tabela por departamento", async () => {
    const abas = await abasDoPulso(relDoPulso({ analises: null }));
    expect(Object.keys(abas)).not.toContain("Por departamento");
    expect(JSON.stringify(abas["eNPS"])).not.toContain("por departamento");
  });

  it("carregar o relatório pede os números de cada grupo visível e quem emite", async () => {
    const servico = servicoFalso({
      quemEmite: vi.fn(() => Promise.resolve("Pessoa Emissora")),
    });
    const { rel } = await carregarRelatorio(servico, "p-1", HOJE);
    expect(rel.emitidoPor).toBe("Pessoa Emissora");
    expect(servico.resultadosDaPesquisa).toHaveBeenCalledWith("p-1", {
      campo: "departamento",
      grupoId: "d-1",
    });
    // O grupo oculto (Financeiro) não é pedido.
    expect(servico.resultadosDaPesquisa).not.toHaveBeenCalledWith("p-1", {
      campo: "departamento",
      grupoId: "d-2",
    });
    expect(rel.grupos?.linhas.map((l) => l.nome)).toEqual(
      ANALISES.linhas.map((l) => l.nome),
    );
  });

  it("sem quem emite (falha), o relatório sai sem o nome", async () => {
    const servico = servicoFalso({
      quemEmite: vi.fn(() => Promise.reject(new Error("falhou"))),
    });
    const { rel } = await carregarRelatorio(servico, "p-1", HOJE);
    expect(rel.emitidoPor).toBeNull();
  });
});

describe("R3-A-19 — participantes da anônima: embaralhados e sem 'Sem resposta'", () => {
  it("ordem estável pela pesquisa, numerada na nova ordem", async () => {
    const linhas = (await abasDoPulso())["Participantes"]!.slice(4);
    expect(linhas.map((l) => l[0])).toEqual([
      "Participante 1",
      "Participante 2",
      "Participante 3",
      "Participante 4",
      "Participante 5",
    ]);
    const ordem = linhas.map((l) => l[2]);
    // A nota da pergunta 1 é o número de chegada: a ordem não é a de chegada.
    expect(ordem).not.toEqual(["1", "2", "3", "4", "5"]);
    expect([...ordem].sort()).toEqual(["1", "2", "3", "4", "5"]);
    const deNovo = (await abasDoPulso())["Participantes"]!.slice(4);
    expect(deNovo.map((l) => l[2])).toEqual(ordem);
  });

  it("o que não foi respondido fica vazio", async () => {
    // Uma resposta com a pergunta 3 gravada vazia também fica vazia.
    const comVazio = CINCO.map((r) =>
      r.numero === 1
        ? {
            ...r,
            valores: r.valores.map((v) =>
              v.perguntaId === "q3" ? { ...v, valor: null as never } : v,
            ),
          }
        : r,
    );
    const vazia = (await abasDoPulso(relDoPulso(), comVazio))["Participantes"]!;
    expect(vazia.slice(4).find((l) => l[2] === "1")![4] ?? "").toBe("");
    const aba = (await abasDoPulso())["Participantes"]!;
    expect(JSON.stringify(aba)).not.toContain("Sem resposta");
    const terceira = aba.slice(4).find((l) => l[2] === "3")!;
    expect(terceira[3] ?? "").toBe("");
    expect(terceira[4]).toBe("3");
    expect(aba[1]![0]).toContain("ordem embaralhada");
  });

  it("embaralhar: permutação, a mesma para a mesma pesquisa", () => {
    const itens = Array.from({ length: 12 }, (_, i) => i);
    const a = embaralharDeFormaEstavel(itens, "pesquisa-a");
    expect(embaralharDeFormaEstavel(itens, "pesquisa-a")).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(itens);
    expect(a).not.toEqual(itens);
    expect(embaralharDeFormaEstavel(itens, "pesquisa-b")).not.toEqual(a);
  });

  it("identificada mantém a ordem e o nome", async () => {
    const ident = { ...PULSO, identificacao: "identificada" as const };
    const rel = montarRelatorio({
      detalhe: ident,
      geral: GERAL,
      empresa: "Empresa Alfa",
      hoje: HOJE,
    });
    const abas = await lerAbasXlsx(
      planilhaDosResultados(
        rel,
        ident,
        GERAL,
        CINCO.map((r) => ({ ...r, nome: `Pessoa ${r.numero}` })),
      ),
    );
    expect(abas["Participantes"]!.slice(4).map((l) => l[0])).toEqual([
      "Pessoa 1",
      "Pessoa 2",
      "Pessoa 3",
      "Pessoa 4",
      "Pessoa 5",
    ]);
  });
});
