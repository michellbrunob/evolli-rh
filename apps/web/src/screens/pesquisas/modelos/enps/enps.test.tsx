/**
 * T216 — eNPS: o catálogo (principal fixa, complementares de 0 a 10,
 * abertas obrigatórias, nome por trimestre, resumo), a Visão geral, as
 * Respostas com pílulas por grupo, o resultado individual, as Análises, a
 * planilha e o relatório imprimível, e a página "Sobre o modelo".
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  RespostaResumo,
  ResultadoDoEnps,
  ResultadoIndividualDoEnps,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { lerAbasXlsx } from "../../../pessoas/importacao/planilhaXlsx";
import { AssistenteDoModelo } from "../../AssistenteDoModelo";
import type { RelatorioCarregado } from "../../carregarRelatorio";
import { DETALHE, RESULTADOS, servicoFalso } from "../../dadosDeTeste";
import { montarRelatorio } from "../../dadosDoRelatorio";
import { estadoDoModelo, perguntasEmOrdem } from "../../estadoDaPesquisa";
import { planilhaDosResultados } from "../../exportarResultados";
import { modeloDaGaleria } from "../../modelosDePesquisa";
import { PaginaDoModelo } from "../PaginaDoModelo";
import { ResultadosDaPesquisa } from "../../ResultadosDaPesquisa";
import { PaginaDaResposta } from "../../ResultadoIndividual";
import {
  analisesDoModelo,
  listaDeRespostasDoModelo,
  visaoGeralDoModelo,
  visaoIndividualDoModelo,
} from "../resultados";
import {
  CHAVE_PRINCIPAL_DO_ENPS,
  ENPS,
  resumoDasPerguntasDoEnps,
  trimestreDe,
} from "./catalogo";
import { DocumentoEnps } from "./RelatorioEnps";

const detalhe: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "enps",
  identificacao: "anonima",
  respostas: 4,
  secoes: [...estadoDoModelo("enps").secoes],
};
const todas = perguntasEmOrdem(detalhe.secoes);
const id = (chave: string) => todas.find((p) => p.chave === chave)!.id;

/** O caso real: 4 respostas, principais 10, 7, 3 e 9 → eNPS 25. */
const R: ResultadoDoEnps = {
  modelo: "enps",
  perguntaId: id(CHAVE_PRINCIPAL_DO_ENPS),
  respostas: 4,
  promotores: 2,
  neutros: 1,
  detratores: 1,
  indice: 25,
  zona: "aperfeicoamento",
  distribuicao: Array.from({ length: 11 }, (_, valor) => ({
    valor,
    quantidade: [3, 7, 9, 10].includes(valor) ? 1 : 0,
  })),
  complementares: [
    ["enps_ambiente", 7.8, 1, 1, 2, 0.95],
    ["enps_satisfacao", 7.3, 1, 1, 2, 0.98],
    ["enps_lideranca", 6.8, 1, 2, 1, 0.9],
    ["enps_crescimento", 5.5, 2, 2, 0, 0.7],
    ["enps_reconhecimento", 4.5, 3, 1, 0, null],
  ].map(([chave, media, d, n, p, peso]) => ({
    perguntaId: id(chave as string),
    respostas: 4,
    media: media as number,
    detratores: d as number,
    neutros: n as number,
    promotores: p as number,
    peso: peso as number | null,
  })),
};

const TEXTOS = ["Ambiente", "Benefícios", "Colegas", "Diálogo", "Equipe"];

const geral: ResultadosPesquisa = {
  ...RESULTADOS,
  respostas: 4,
  perguntas: [
    {
      perguntaId: id("enps_gosta"),
      tipo: "paragrafo",
      respondidas: 4,
      viram: 4,
      textos: TEXTOS.slice(0, 3).map((texto) => ({ texto, autor: null })),
    },
    {
      perguntaId: id("enps_melhoraria"),
      tipo: "paragrafo",
      respondidas: 2,
      viram: 4,
      textos: TEXTOS.slice(3).map((texto) => ({ texto, autor: null })),
    },
  ],
  modelo: R,
};

describe("T216 — eNPS: catálogo", () => {
  it("1 principal fixa, 5 complementares de 0 a 10 com as pontas da principal e 2 abertas obrigatórias", () => {
    const e = estadoDoModelo("enps");
    expect(e.secoes.map((s) => s.perguntas.length)).toEqual([1, 5, 2]);
    const [principal, complementares, abertas] = e.secoes;
    expect(principal!.perguntas[0]).toMatchObject({
      tipo: "nota_0_10",
      config: { enps: true },
    });
    for (const p of complementares!.perguntas) {
      expect(p.tipo).toBe("escala");
      expect(p.config).toMatchObject({
        minimo: 0,
        maximo: 10,
        rotuloMinimo: principal!.perguntas[0]!.config.rotuloMinimo,
        rotuloMaximo: principal!.perguntas[0]!.config.rotuloMaximo,
      });
    }
    expect(abertas!.perguntas.every((p) => p.obrigatoria)).toBe(true);
    expect(ENPS.chavesFixas).toEqual([CHAVE_PRINCIPAL_DO_ENPS]);
  });

  it("nome padrão por trimestre", () => {
    expect(trimestreDe("2026-01-05")).toBe("1º trimestre 2026");
    expect(trimestreDe("2026-03-31")).toBe("1º trimestre 2026");
    expect(trimestreDe("2026-04-01")).toBe("2º trimestre 2026");
    expect(trimestreDe("2026-09-30")).toBe("3º trimestre 2026");
    expect(trimestreDe("2026-12-31")).toBe("4º trimestre 2026");
    expect(estadoDoModelo("enps", "2026-11-28").nome).toBe(
      "eNPS – 4º trimestre 2026",
    );
  });

  it("resumo das perguntas com plural pela quantidade", () => {
    expect(resumoDasPerguntasDoEnps(todas)).toBe(
      "1 principal · 5 complementares · 2 abertas",
    );
    expect(
      resumoDasPerguntasDoEnps([todas[0]!, todas[1]!, todas.at(-1)!]),
    ).toBe("1 principal · 1 complementar · 1 aberta");
    expect(resumoDasPerguntasDoEnps([todas[0]!])).toBe("1 principal");
  });
});

describe("T216 — eNPS: assistente", () => {
  function montar() {
    const servico = servicoFalso();
    render(
      <AssistenteDoModelo
        servico={servico}
        modeloId="enps"
        hoje="2026-11-28"
        agora={() => new Date(2026, 10, 28, 9, 5)}
        atrasoDoRascunho={0}
        onCancelar={vi.fn()}
        onConcluir={vi.fn()}
        onVerResultados={vi.fn()}
        onEditarGerada={vi.fn()}
      />,
    );
    return servico;
  }

  it("a principal não sai nem se edita (somente leitura); as outras saem; a nota explica por quê", () => {
    montar();
    expect(screen.getByLabelText("Nome da pesquisa")).toHaveValue(
      "eNPS – 4º trimestre 2026",
    );
    expect(
      screen.queryByRole("button", { name: "Excluir pergunta 1" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Editar pergunta 1" }),
    ).toBeNull();
    expect(screen.queryByDisplayValue(/\{empresa\}/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Editar pergunta 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Excluir pergunta 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A pergunta principal é fixa: é ela que calcula o eNPS/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/A pergunta de eNPS pode sair/)).toBeNull();
    const linhas = screen.getAllByRole("listitem", { name: /^Pergunta \d+$/ });
    expect(linhas[0]).not.toHaveAttribute("draggable", "true");
    expect(linhas[1]).toHaveAttribute("draggable", "true");
  });

  it("adicionar oferece escala de 0 a 10 ou texto livre", async () => {
    const servico = montar();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar pergunta/ }));
    const tipos = screen.getByRole("radiogroup", {
      name: "Tipo da nova pergunta",
    });
    expect(
      within(tipos)
        .getAllByRole("radio")
        .map((r) => r.closest("label")!.textContent),
    ).toEqual(["Escala de 0 a 10", "Texto livre"]);
    fireEvent.click(within(tipos).getByRole("radio", { name: "Texto livre" }));
    fireEvent.change(screen.getByLabelText("Nova pergunta"), {
      target: { value: "O que mudou desde a última pesquisa?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => {
      const fn =
        servico.alterarPesquisa.mock.calls.length > 0
          ? servico.alterarPesquisa
          : servico.criarPesquisa;
      const chamada = fn.mock.calls.at(-1)!;
      const entrada = (chamada.length === 1 ? chamada[0] : chamada[1]) as {
        secoes: PesquisaDetalhe["secoes"];
      };
      const nova = perguntasEmOrdem(entrada.secoes).find(
        (p) => p.texto === "O que mudou desde a última pesquisa?",
      );
      expect(nova).toMatchObject({ tipo: "paragrafo" });
    });
  });

  it("escala padrão da nova pergunta: 0 a 10", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar pergunta/ }));
    expect(
      screen.getByRole("radio", { name: "Escala de 0 a 10" }),
    ).toBeChecked();
    expect(
      screen.getByText("0 = Nada provável · 10 = Muito provável"),
    ).toBeInTheDocument();
  });

  it("a etapa Enviar resume: 1 principal · 5 complementares · 2 abertas", async () => {
    montar();
    fireEvent.click(screen.getByRole("radio", { name: /Anônima/ }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo: Enviar/ }));
    const resumo = await screen.findByRole("region", {
      name: "Revise antes de gerar",
    });
    expect(resumo).toHaveTextContent(
      "1 principal · 5 complementares · 2 abertas",
    );
  });
});

describe("T216 — eNPS: Visão geral", () => {
  it("medidor, zona, a conta e quem respondeu o quê", () => {
    render(<>{visaoGeralDoModelo(detalhe, geral)}</>);
    const cartao = screen.getByRole("region", { name: "eNPS do time" });
    expect(cartao).toHaveTextContent("+25");
    expect(cartao).toHaveTextContent("Zona de aperfeiçoamento");
    expect(cartao).toHaveTextContent("50% promotores − 25% detratores = 25");
    expect(within(cartao).getByRole("img")).toHaveAccessibleName(
      /eNPS 25, de −100 a 100/,
    );
    const grupos = screen.getByRole("region", { name: "Quem respondeu o quê" });
    const itens = within(grupos).getAllByRole("listitem");
    expect(itens.map((i) => i.textContent)).toEqual([
      "50%PromotoresNotas 9–102 pessoas",
      "25%NeutrosNotas 7–81 pessoa",
      "25%DetratoresNotas 0–61 pessoa",
    ]);
  });

  it("histograma 0–10 com as cores por grupo", () => {
    render(<>{visaoGeralDoModelo(detalhe, geral)}</>);
    const fig = screen.getByRole("figure", {
      name: /Distribuição das notas de 0 a 10/,
    });
    const barras = fig.querySelectorAll(".modelo-histograma__barra");
    expect(barras).toHaveLength(11);
    expect(barras[6]).toHaveAttribute("data-grupo", "detrator");
    expect(barras[7]).toHaveAttribute("data-grupo", "neutro");
    expect(barras[8]).toHaveAttribute("data-grupo", "neutro");
    expect(barras[9]).toHaveAttribute("data-grupo", "promotor");
  });

  it("complementares da maior para a menor, média com uma casa e o ponto de atenção", () => {
    render(<>{visaoGeralDoModelo(detalhe, geral)}</>);
    const tabela = screen.getByRole("table", {
      name: "Perguntas complementares",
    });
    const linhas = within(tabela)
      .getAllByRole("row")
      .slice(1) as HTMLTableRowElement[];
    expect(linhas.map((l) => l.cells[2]!.textContent)).toEqual([
      "7,8",
      "7,3",
      "6,8",
      "5,5",
      "4,5",
    ]);
    expect(linhas[0]).toHaveTextContent("Ambiente");
    expect(
      within(linhas[4]!).getByRole("img", { name: /Reconhecimento/ }),
    ).toHaveAccessibleName(
      "Reconhecimento: 3 notas de 0 a 6, 1 nota de 7 a 8, 0 notas de 9 a 10",
    );
    expect(
      screen.getByRole("region", { name: "Perguntas complementares" }),
    ).toHaveTextContent(
      "Reconhecimento é o ponto que mais pede atenção (média 4,5).",
    );
  });

  it("respostas abertas: 3 e o botão para ver todas", () => {
    render(<>{visaoGeralDoModelo(detalhe, geral)}</>);
    const abertas = screen.getByRole("region", { name: "Respostas abertas" });
    expect(abertas).toHaveTextContent("Respostas abertas · 5");
    expect(within(abertas).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(
      within(abertas).getByRole("button", { name: "Ver as 5 respostas" }),
    );
    expect(within(abertas).getAllByRole("listitem")).toHaveLength(5);
  });

  it("sem notas na principal: aviso no lugar do medidor", () => {
    render(
      <>
        {visaoGeralDoModelo(detalhe, {
          ...geral,
          modelo: { ...R, indice: null, zona: null, respostas: 0 },
        })}
      </>,
    );
    expect(
      screen.getByText("Ainda sem notas na pergunta principal."),
    ).toBeInTheDocument();
  });
});

const resumo = (
  n: number,
  nota: number | null,
  grupo: "promotor" | "neutro" | "detrator",
): RespostaResumo => ({
  id: `r${n}`,
  numero: n,
  colaboradorId: null,
  nome: null,
  departamento: null,
  respondidaEm: `2026-11-2${n}T12:00:00.000Z`,
  media: 7,
  grupos: [],
  enps: nota === null ? null : { nota, grupo },
});

describe("T216 — eNPS: Respostas", () => {
  const lista = [
    resumo(4, 9, "promotor"),
    resumo(3, 3, "detrator"),
    resumo(2, 7, "neutro"),
    resumo(1, 10, "promotor"),
  ];

  it("pílulas por grupo com a contagem e a coluna da nota principal", () => {
    const onAbrir = vi.fn();
    render(
      <>
        {listaDeRespostasDoModelo({
          detalhe,
          geral,
          respostas: lista,
          onAbrir,
        })}
      </>,
    );
    const pilulas = screen.getByRole("group", { name: "Respostas" });
    expect(
      within(pilulas)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Todos4", "Promotores2", "Neutros1", "Detratores1"]);
    const tabela = screen.getByRole("table", { name: "Respostas" });
    expect(
      within(tabela).getByRole("columnheader", { name: "Nota principal" }),
    ).toBeInTheDocument();
    expect(within(tabela).queryByText(/Média das respostas/)).toBeNull();
    const linhas = within(tabela)
      .getAllByRole("row")
      .slice(1) as HTMLTableRowElement[];
    expect(linhas[0]).toHaveTextContent("9Promotor");
    fireEvent.click(
      within(pilulas).getByRole("button", { name: /Detratores/ }),
    );
    const filtradas = within(tabela).getAllByRole("row").slice(1);
    expect(filtradas).toHaveLength(1);
    expect(filtradas[0]).toHaveTextContent("Resposta anônima #3");
    expect(filtradas[0]).toHaveTextContent("3Detrator");
    fireEvent.click(filtradas[0]!);
    expect(onAbrir).toHaveBeenCalledWith("r3");
  });

  it("outros modelos usam a lista comum", () => {
    expect(
      listaDeRespostasDoModelo({
        detalhe: { ...detalhe, modelo: "pulso" },
        geral,
        respostas: lista,
        onAbrir: vi.fn(),
      }),
    ).toBeNull();
  });
});

describe("T216 — eNPS: resultado individual", () => {
  const p: ResultadoIndividualDoEnps = {
    modelo: "enps",
    nota: 7,
    grupo: "neutro",
    enpsTime: 25,
    promotoresTime: 50,
    zonaTime: "aperfeicoamento",
    complementares: [
      { perguntaId: id("enps_satisfacao"), nota: 8, time: 7.3, diferenca: 0.8 },
      { perguntaId: id("enps_ambiente"), nota: 2, time: 7.8, diferenca: -5.3 },
      {
        perguntaId: id("enps_lideranca"),
        nota: null,
        time: 6.8,
        diferenca: null,
      },
      { perguntaId: id("enps_crescimento"), nota: 5, time: 8, diferenca: -3 },
      { perguntaId: id("enps_reconhecimento"), nota: 9, time: 9, diferenca: 0 },
    ],
  };
  const resposta = {
    id: "r2",
    valores: [
      { perguntaId: id("enps_gosta"), valor: "As pessoas", mediaTime: null },
    ],
    modelo: p,
  } as unknown as RespostaDetalhe;

  it("nota com grupo e frase, eNPS do time e as complementares com a diferença", () => {
    render(<>{visaoIndividualDoModelo(resposta, detalhe.secoes)}</>);
    const nota = screen.getByRole("region", { name: "Nota principal" });
    expect(nota).toHaveTextContent("7Neutro");
    expect(nota).toHaveTextContent(
      "eNPS do time: +25 (zona de aperfeiçoamento) · 50% são promotores",
    );
    const tabela = screen.getByRole("table", {
      name: "Complementares comparadas com o time",
    });
    const linhas = within(tabela)
      .getAllByRole("row")
      .slice(1) as HTMLTableRowElement[];
    expect(linhas.map((l) => [...l.cells].map((c) => c.textContent))).toEqual([
      ["Satisfação geral", "8", "7,3", "+0,8"],
      ["Ambiente", "2", "7,8", "−5,3"],
      ["Liderança direta", "—", "6,8", "—"],
      // Inteiro sem casa ("−3", nunca "−3,0"); igual ao time: "0".
      ["Crescimento", "5", "8,0", "−3"],
      ["Reconhecimento", "9", "9,0", "0"],
    ]);
    const abertas = screen.getByRole("region", { name: "Respostas abertas" });
    expect(abertas).toHaveTextContent("As pessoas");
    expect(abertas).toHaveTextContent("Sem resposta.");
    expect(screen.queryByText(/Média nos últimos pulsos/)).toBeNull();
  });

  it("sem o resultado do eNPS: a visão comum", () => {
    expect(
      visaoIndividualDoModelo(
        { ...resposta, modelo: null } as RespostaDetalhe,
        detalhe.secoes,
      ),
    ).toBeNull();
  });
});

describe("T216 — eNPS: Análises", () => {
  const comGrupos: ResultadosPesquisa = {
    ...geral,
    recortes: ["departamento"],
    grupos: {
      departamento: [
        {
          id: "d1",
          nome: "Comercial",
          respostas: 3,
          visivel: true,
          oculto: null,
        },
        {
          id: "d2",
          nome: "Financeiro",
          respostas: 1,
          visivel: false,
          oculto: "minimo",
        },
      ],
    },
  };

  const EVOLUCAO = [
    {
      pesquisaId: "a",
      nome: "eNPS – 3º trimestre 2026",
      publicadaEm: "2026-08-01T12:00:00.000Z",
      mediaGeral: 7,
      enps: -10,
    },
    {
      pesquisaId: "b",
      nome: "eNPS – 4º trimestre 2026",
      publicadaEm: "2026-11-01T12:00:00.000Z",
      mediaGeral: 7,
      enps: 25,
    },
  ];

  function montar(
    identificacao: PesquisaDetalhe["identificacao"],
    resultadosGerais: ResultadosPesquisa = comGrupos,
  ) {
    const servico = servicoFalso({
      resultadosDaPesquisa: vi.fn(async () => ({
        ...comGrupos,
        modelo: { ...R, indice: 67, zona: "qualidade" as const },
      })),
      evolucaoDaPesquisa: vi.fn(async () => ({ evolucao: EVOLUCAO })),
    });
    render(
      <>
        {analisesDoModelo({
          servico,
          detalhe: { ...detalhe, identificacao, minimoPorGrupo: 3 },
          geral: resultadosGerais,
          respostas: null,
        })}
      </>,
    );
    return servico;
  }

  it("eNPS por departamento (oculto abaixo do mínimo) e a evolução", async () => {
    const servico = montar("anonima");
    const tabela = await screen.findByRole("table", {
      name: "eNPS por departamento",
    });
    const linhas = within(tabela)
      .getAllByRole("row")
      .slice(1) as HTMLTableRowElement[];
    expect(linhas[0]).toHaveTextContent("Comercial+67Zona de qualidade3");
    expect(linhas[1]).toHaveTextContent(
      "Financeiro Oculto · menos de 3 respostas",
    );
    expect(servico.resultadosDaPesquisa).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("img", { name: /Evolução do eNPS/ }),
    ).toHaveAccessibleName(
      "Evolução do eNPS: eNPS – 3º trimestre 2026 · 01/08/2026 -10; eNPS – 4º trimestre 2026 · 01/11/2026 25",
    );
  });

  it("anônima sem recorte: a evolução carrega mesmo sem grupo para agrupar", async () => {
    const servico = montar("anonima", { ...geral, recortes: [], grupos: {} });
    expect(
      await screen.findByRole("img", { name: /Evolução do eNPS/ }),
    ).toHaveAccessibleName(
      "Evolução do eNPS: eNPS – 3º trimestre 2026 · 01/08/2026 -10; eNPS – 4º trimestre 2026 · 01/11/2026 25",
    );
    expect(servico.evolucaoDaPesquisa).toHaveBeenCalledWith(detalhe.id);
    expect(servico.analisesDaPesquisa).not.toHaveBeenCalled();
    expect(
      screen.queryByText(
        "A evolução aparece a partir da segunda pesquisa eNPS.",
      ),
    ).toBeNull();
  });

  it("o que mais pesa na nota: só na identificada, do maior peso para o menor", async () => {
    montar("anonima");
    expect(
      await screen.findByText(/Disponível só na pesquisa identificada/),
    ).toBeInTheDocument();
  });

  it("identificada: a lista dos pesos", async () => {
    montar("identificada");
    const lista = await screen.findByRole("list", {
      name: "Peso de cada complementar",
    });
    expect(
      within(lista)
        .getAllByRole("listitem")
        .map((l) => l.textContent),
    ).toEqual([
      "Satisfação geral98%",
      "Ambiente95%",
      "Liderança direta90%",
      "Crescimento70%",
    ]);
  });
});

describe("T216 — eNPS: planilha e relatório", () => {
  const rel = (identificacao: PesquisaDetalhe["identificacao"]) =>
    montarRelatorio({
      detalhe: { ...detalhe, identificacao },
      geral,
      empresa: "Empresa Exemplo",
      hoje: "2026-11-28",
    });

  it("as abas do modelo no lugar das genéricas, sem a contagem errada de respondentes", async () => {
    const abas = await lerAbasXlsx(
      planilhaDosResultados(rel("anonima"), detalhe, geral, null),
    );
    expect(Object.keys(abas)).toEqual([
      "Visão geral",
      "Gráficos",
      "Complementares",
      "Respostas abertas",
    ]);
    const visao = abas["Visão geral"]!.map((l) => l.join("|"));
    expect(visao).toContain("Respondentes|4");
    expect(visao).toContain("eNPS (de −100 a 100)|25");
    expect(visao).toContain("Zona|Zona de aperfeiçoamento");
    expect(visao).toContain("Promotores (notas 9 e 10)|2 (50%)");
    expect(visao).toContain("Detratores (notas 0 a 6)|1 (25%)");
    const comp = abas["Complementares"]!;
    expect(comp[3]).toEqual([
      "Pergunta",
      "Respostas",
      "Média (0 a 10)",
      "Detratores (0 a 6)",
      "Neutros (7 e 8)",
      "Promotores (9 e 10)",
    ]);
    expect(comp[4]!.slice(1)).toEqual(["4", "7.8", "1", "1", "2"]);
    expect(abas["Respostas abertas"]!.slice(4).map((l) => l[1])).toEqual(
      TEXTOS,
    );
  });

  it("respostas individuais com a nota principal e o grupo (nunca na confidencial)", async () => {
    const r1 = {
      id: "r1",
      numero: 1,
      nome: "Ana Exemplo",
      departamento: "Comercial",
      respondidaEm: "2026-11-27T12:00:00.000Z",
      valores: [
        { perguntaId: id(CHAVE_PRINCIPAL_DO_ENPS), valor: 9, mediaTime: null },
      ],
    } as unknown as RespostaDetalhe;
    const ident = await lerAbasXlsx(
      planilhaDosResultados(
        rel("identificada"),
        { ...detalhe, identificacao: "identificada" },
        geral,
        [r1],
      ),
    );
    const linhas = ident["Respostas individuais"]!;
    expect(linhas[4]!.slice(0, 4)).toEqual([
      "Ana Exemplo",
      "Comercial",
      "9",
      "Promotor",
    ]);
    const conf = await lerAbasXlsx(
      planilhaDosResultados(
        rel("confidencial"),
        { ...detalhe, identificacao: "confidencial" },
        geral,
        [r1],
      ),
    );
    expect(Object.keys(conf)).not.toContain("Respostas individuais");
    expect(JSON.stringify(conf)).not.toContain("Ana Exemplo");
  });

  it("números ocultos: nenhuma nota sai", async () => {
    const oculto = { ...rel("confidencial"), numerosOcultos: true };
    const abas = await lerAbasXlsx(
      planilhaDosResultados(
        oculto,
        { ...detalhe, identificacao: "confidencial" },
        geral,
        null,
      ),
    );
    expect(JSON.stringify(abas)).not.toContain("Zona de aperfeiçoamento");
    expect(JSON.stringify(abas)).toContain("Números ocultos");
  });

  it("o relatório imprimível próprio: capa, resultado, distribuição, complementares e abertas", () => {
    const carregado: RelatorioCarregado = {
      detalhe,
      geral,
      empresa: "Empresa Exemplo",
      lista: null,
      rel: rel("anonima"),
    };
    render(<DocumentoEnps carregado={carregado} />);
    expect(
      screen.getByRole("heading", { level: 1, name: detalhe.nome }),
    ).toBeInTheDocument();
    const resultado = screen.getByRole("region", { name: "01 Resultado" });
    expect(resultado).toHaveTextContent("50% promotores − 25% detratores = 25");
    expect(
      screen.getByRole("region", { name: "03 Perguntas complementares" }),
    ).toHaveTextContent("Reconhecimento é o ponto que mais pede atenção");
    expect(
      screen.getByRole("region", { name: "04 Respostas abertas" }),
    ).toHaveTextContent("Diálogo");
    expect(screen.queryByText(/Média geral/)).toBeNull();
  });
});

describe("T216 — eNPS: Sobre o modelo", () => {
  it("cabeçalho com selo, 4 números, as 11 notas e a fórmula; sem 'O que você recebe' nem ficha técnica", () => {
    const m = modeloDaGaleria("enps");
    render(
      <PaginaDoModelo
        modelo={m}
        pagina={m.pagina!}
        onVoltar={vi.fn()}
        onUsar={vi.fn()}
      />,
    );
    expect(screen.getByText("8 perguntas")).toBeInTheDocument();
    const numeros = document.querySelector(".sobre__numeros") as HTMLElement;
    expect(within(numeros).getAllByRole("term")).toHaveLength(4);
    expect(numeros).toHaveTextContent("−100 a 100");
    const notas = screen.getByRole("list", {
      name: "As notas de 0 a 10 por grupo",
    });
    const itens = within(notas).getAllByRole("listitem");
    expect(itens).toHaveLength(11);
    expect(itens[6]).toHaveAttribute("data-grupo", "detrator");
    expect(itens[8]).toHaveAttribute("data-grupo", "neutro");
    expect(itens[10]).toHaveAttribute("data-grupo", "promotor");
    expect(
      screen.getByLabelText("eNPS = % de promotores − % de detratores"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Zonas do eNPS/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("O que você recebe")).toBeNull();
    expect(screen.queryByText("Ficha técnica")).toBeNull();
  });
});

describe("T216 — eNPS: ligado às telas de resultado", () => {
  const lista = [resumo(2, 7, "neutro"), resumo(1, 10, "promotor")];
  const servico = () =>
    servicoFalso({
      obterPesquisa: vi.fn(async () => detalhe),
      resultadosDaPesquisa: vi.fn(async () => geral),
      respostasDaPesquisa: vi.fn(async () => lista),
    });

  it("Visão geral e Respostas próprias nos resultados da pesquisa", async () => {
    render(
      <ResultadosDaPesquisa
        servico={servico()}
        pesquisaId={detalhe.id}
        podeEditar
        abaInicial="respostas"
        hoje="2026-11-28"
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    const tabela = await screen.findByRole("table", { name: "Respostas" });
    expect(
      within(tabela).getByRole("columnheader", { name: "Nota principal" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Visão geral" }));
    expect(
      await screen.findByRole("region", { name: "eNPS do time" }),
    ).toHaveTextContent("+25");
  });

  it("o resultado individual usa a visão do eNPS", async () => {
    const resposta = {
      ...resumo(2, 7, "neutro"),
      anteriorId: null,
      proximaId: null,
      posicao: 1,
      total: 1,
      valores: [],
      indicadores: {
        media: 7,
        mediaTime: 7,
        recomendacao: 7,
        enpsTime: 25,
        maior: null,
        menor: null,
        mediaUltimosPulsos: null,
      },
      modelo: {
        modelo: "enps",
        nota: 7,
        grupo: "neutro",
        enpsTime: 25,
        promotoresTime: 50,
        zonaTime: "aperfeicoamento",
        complementares: [],
      },
    } as RespostaDetalhe;
    render(
      <PaginaDaResposta
        nomeDaPesquisa={detalhe.nome}
        identificacao="anonima"
        secoes={detalhe.secoes}
        respostaId="r2"
        carregar={async () => resposta}
        rotuloVoltar="Voltar"
        onVoltar={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("region", { name: "Nota principal" }),
    ).toHaveTextContent("7Neutro");
    expect(screen.queryByText("Média geral")).toBeNull();
    expect(screen.queryByText("Média nos últimos pulsos")).toBeNull();
  });
});
